from datetime import date, datetime, time
from typing import Optional
from sqlalchemy.orm import Session
from app.models.student import Student
from app.models.branch import Branch
from app.models.school import School
from app.models.attendance import AttendanceRecord, AttendanceStatus, Holiday


def get_today_record(db: Session, student_id: int, attendance_date: date) -> Optional[AttendanceRecord]:
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.date == attendance_date,
    ).first()


def is_holiday(db: Session, branch_id: int, attendance_date: date) -> bool:
    return db.query(Holiday).filter(
        Holiday.branch_id == branch_id,
        Holiday.date == attendance_date,
    ).first() is not None


def resolve_status(branch: Branch, check_in_time: datetime) -> AttendanceStatus:
    if branch.late_cutoff_time is None:
        return AttendanceStatus.present

    cutoff = datetime.combine(check_in_time.date(), branch.late_cutoff_time)
    if check_in_time.replace(tzinfo=None) > cutoff.replace(tzinfo=None):
        return AttendanceStatus.late
    return AttendanceStatus.present


def process_scan(
    db: Session,
    qr_token: str,
    branch_id: int,
    scanned_by_user_id: Optional[int],
    scanned_at: Optional[datetime] = None,
) -> dict:
    now = scanned_at or datetime.utcnow()
    today = now.date()

    student = db.query(Student).filter(
        Student.qr_token == qr_token,
        Student.branch_id == branch_id,
        Student.is_active == True,
    ).first()

    if not student:
        return {
            "success": False,
            "message": "Invalid QR code or student not found in this branch",
            "already_scanned": False,
        }

    if is_holiday(db, branch_id, today):
        return {
            "success": False,
            "message": "Today is a holiday — attendance not recorded",
            "student_id": student.id,
            "student_name": student.name,
            "already_scanned": False,
        }

    existing = get_today_record(db, student.id, today)
    if existing:
        return {
            "success": True,
            "message": f"{student.name} already marked {existing.status} today",
            "student_id": student.id,
            "student_name": student.name,
            "roll_number": student.roll_number,
            "class_name": student.class_name,
            "photo_url": student.photo_url,
            "status": existing.status,
            "check_in_time": existing.check_in_time,
            "already_scanned": True,
        }

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    status = resolve_status(branch, now)

    record = AttendanceRecord(
        student_id=student.id,
        branch_id=branch_id,
        date=today,
        check_in_time=now,
        status=status,
        scanned_by=scanned_by_user_id,
        is_manual=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Send WhatsApp notification to parent
    try:
        from app.services.whatsapp import notify_arrival, notify_late
        school = db.query(School).join(Branch, Branch.school_id == School.id).filter(Branch.id == branch_id).first()
        school_name = school.name if school else "School"
        if status == AttendanceStatus.late:
            notify_late(db, student, school_name, now)
        else:
            notify_arrival(db, student, school_name, now)
        record.whatsapp_sent = True
        db.commit()
    except Exception:
        pass  # Never fail a scan because of a notification error

    msg = f"{student.name} marked {status}"
    if status == AttendanceStatus.late:
        msg += " (arrived late)"

    return {
        "success": True,
        "message": msg,
        "student_id": student.id,
        "student_name": student.name,
        "roll_number": student.roll_number,
        "class_name": student.class_name,
        "photo_url": student.photo_url,
        "status": status,
        "check_in_time": record.check_in_time,
        "already_scanned": False,
    }
