from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import date, datetime

from app.database import get_db
from app.models.student import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus, Holiday
from app.models.user import User, UserRole
from app.schemas.attendance import (
    ScanRequest, ScanResult,
    OfflineSyncRequest, OfflineSyncResult,
    ManualAttendanceEntry, BulkManualRequest,
    AttendanceOut, DailySummary, ClassSummary, StudentAttendanceRecord,
    LeaveMarkRequest, LeaveOut,
)
from app.services.auth import get_current_user, require_roles
from app.services.attendance import process_scan, get_today_record, is_holiday

router = APIRouter(prefix="/attendance", tags=["Attendance"])

all_staff = require_roles(
    UserRole.super_admin, UserRole.school_admin,
    UserRole.branch_admin, UserRole.teacher, UserRole.gate_staff
)
admin_roles = require_roles(
    UserRole.super_admin, UserRole.school_admin, UserRole.branch_admin
)
teacher_and_above = require_roles(
    UserRole.super_admin, UserRole.school_admin,
    UserRole.branch_admin, UserRole.teacher
)


# ---------------------------------------------------------------------------
# SCAN
# ---------------------------------------------------------------------------

@router.post("/scan", response_model=ScanResult)
def scan_qr(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    result = process_scan(
        db=db,
        qr_token=payload.qr_token,
        branch_id=payload.branch_id,
        scanned_by_user_id=current_user.id,
    )
    return ScanResult(**result)


# ---------------------------------------------------------------------------
# OFFLINE SYNC  (gate tablet was offline — batch submit on reconnect)
# ---------------------------------------------------------------------------

@router.post("/offline-sync", response_model=OfflineSyncResult)
def offline_sync(
    payload: OfflineSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    processed, skipped = 0, 0
    errors = []

    for entry in payload.scans:
        try:
            result = process_scan(
                db=db,
                qr_token=entry.qr_token,
                branch_id=payload.branch_id,
                scanned_by_user_id=current_user.id,
                scanned_at=entry.scanned_at,
            )
            if result["already_scanned"] or not result["success"]:
                skipped += 1
            else:
                processed += 1
        except Exception as e:
            skipped += 1
            errors.append(f"{entry.qr_token}: {str(e)}")

    return OfflineSyncResult(processed=processed, skipped=skipped, errors=errors)


# ---------------------------------------------------------------------------
# MANUAL MARK (single student)
# ---------------------------------------------------------------------------

@router.post("/manual", response_model=AttendanceOut)
def manual_mark(
    entry: ManualAttendanceEntry,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    student = db.query(Student).filter(Student.id == entry.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = get_today_record(db, entry.student_id, entry.date)
    if existing:
        existing.status = entry.status
        existing.note = entry.note
        existing.is_manual = True
        db.commit()
        db.refresh(existing)
        return _enrich(existing, student)

    record = AttendanceRecord(
        student_id=entry.student_id,
        branch_id=student.branch_id,
        date=entry.date,
        check_in_time=datetime.combine(entry.date, datetime.min.time()) if entry.status == AttendanceStatus.present else None,
        status=entry.status,
        scanned_by=current_user.id,
        is_manual=True,
        note=entry.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _enrich(record, student)


# ---------------------------------------------------------------------------
# BULK MANUAL (mark entire class absent/present at once)
# ---------------------------------------------------------------------------

@router.post("/bulk-manual", response_model=dict)
def bulk_manual(
    payload: BulkManualRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    updated, created = 0, 0
    for entry in payload.entries:
        student = db.query(Student).filter(Student.id == entry.student_id).first()
        if not student:
            continue
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == entry.student_id,
            AttendanceRecord.date == entry.date,
        ).first()
        if existing:
            existing.status = entry.status
            existing.note = entry.note
            existing.is_manual = True
            updated += 1
        else:
            record = AttendanceRecord(
                student_id=entry.student_id,
                branch_id=payload.branch_id,
                date=entry.date,
                status=entry.status,
                scanned_by=current_user.id,
                is_manual=True,
                note=entry.note,
            )
            db.add(record)
            created += 1
    db.commit()
    return {"updated": updated, "created": created}


# ---------------------------------------------------------------------------
# TODAY DASHBOARD SUMMARY
# ---------------------------------------------------------------------------

@router.get("/dashboard/today", response_model=DailySummary)
def today_summary(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    today = date.today()
    total_students = db.query(Student).filter(
        Student.branch_id == branch_id,
        Student.is_active == True,
    ).count()

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date == today,
    ).all()

    status_counts = {s: 0 for s in AttendanceStatus}
    for r in records:
        status_counts[r.status] += 1

    present = status_counts[AttendanceStatus.present]
    late = status_counts[AttendanceStatus.late]
    on_leave = status_counts[AttendanceStatus.leave]
    absent = total_students - present - late - on_leave
    pct = round((present + late) / total_students * 100, 1) if total_students else 0.0

    return DailySummary(
        date=today,
        branch_id=branch_id,
        total_students=total_students,
        present=present,
        absent=absent,
        late=late,
        on_leave=on_leave,
        attendance_percentage=pct,
    )


# ---------------------------------------------------------------------------
# CLASS-WISE SUMMARY FOR TODAY
# ---------------------------------------------------------------------------

@router.get("/dashboard/classes", response_model=List[ClassSummary])
def class_summary(
    branch_id: int,
    attendance_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    target_date = attendance_date or date.today()

    students = db.query(Student).filter(
        Student.branch_id == branch_id,
        Student.is_active == True,
    ).all()

    records_map: dict = {}
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date == target_date,
    ).all()
    for r in records:
        records_map[r.student_id] = r.status

    class_data: dict = {}
    for s in students:
        key = (s.class_name, s.section)
        if key not in class_data:
            class_data[key] = {"total": 0, "present": 0, "absent": 0, "late": 0}
        class_data[key]["total"] += 1
        status = records_map.get(s.id)
        if status == AttendanceStatus.present:
            class_data[key]["present"] += 1
        elif status == AttendanceStatus.late:
            class_data[key]["late"] += 1
        elif status is None:
            class_data[key]["absent"] += 1

    result = []
    for (class_name, section), counts in sorted(class_data.items()):
        total = counts["total"]
        present = counts["present"]
        late = counts["late"]
        pct = round((present + late) / total * 100, 1) if total else 0.0
        result.append(ClassSummary(
            class_name=class_name,
            section=section,
            total=total,
            present=present,
            absent=counts["absent"],
            late=late,
            attendance_percentage=pct,
        ))
    return result


# ---------------------------------------------------------------------------
# LIST RECORDS FOR A CLASS ON A DATE
# ---------------------------------------------------------------------------

@router.get("/class-records", response_model=List[StudentAttendanceRecord])
def class_attendance_records(
    branch_id: int,
    class_name: str,
    section: Optional[str] = None,
    attendance_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    target_date = attendance_date or date.today()

    query = db.query(Student).filter(
        Student.branch_id == branch_id,
        Student.class_name == class_name,
        Student.is_active == True,
    )
    if section:
        query = query.filter(Student.section == section)
    students = query.order_by(Student.roll_number).all()

    records_map = {}
    for r in db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date == target_date,
    ).all():
        records_map[r.student_id] = r

    result = []
    for s in students:
        rec = records_map.get(s.id)
        result.append(StudentAttendanceRecord(
            student_id=s.id,
            student_name=s.name,
            roll_number=s.roll_number,
            class_name=s.class_name,
            section=s.section,
            status=rec.status if rec else AttendanceStatus.absent,
            check_in_time=rec.check_in_time if rec else None,
            is_manual=rec.is_manual if rec else False,
            note=rec.note if rec else None,
        ))
    return result


# ---------------------------------------------------------------------------
# STUDENT HISTORY
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}", response_model=List[AttendanceOut])
def student_history(
    student_id: int,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(all_staff),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    query = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id)
    if from_date:
        query = query.filter(AttendanceRecord.date >= from_date)
    if to_date:
        query = query.filter(AttendanceRecord.date <= to_date)

    records = query.order_by(AttendanceRecord.date.desc()).all()
    return [_enrich(r, student) for r in records]


# ---------------------------------------------------------------------------
# LEAVE MANAGEMENT  (teachers can mark leave)
# ---------------------------------------------------------------------------

@router.post("/leave", response_model=AttendanceOut)
def mark_leave(
    payload: LeaveMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(teacher_and_above),
):
    if payload.leave_type not in ("sick", "urgent", "other"):
        raise HTTPException(status_code=400, detail="leave_type must be sick, urgent, or other")

    student = db.query(Student).filter(Student.id == payload.student_id, Student.is_active == True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    note = payload.formatted_note()

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == payload.student_id,
        AttendanceRecord.date == payload.date,
    ).first()

    if existing:
        existing.status = AttendanceStatus.leave
        existing.note = note
        existing.is_manual = True
        existing.scanned_by = current_user.id
        db.commit()
        db.refresh(existing)
        return _enrich(existing, student)

    record = AttendanceRecord(
        student_id=payload.student_id,
        branch_id=student.branch_id,
        date=payload.date,
        status=AttendanceStatus.leave,
        scanned_by=current_user.id,
        is_manual=True,
        note=note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _enrich(record, student)


@router.get("/leave", response_model=List[AttendanceOut])
def list_leave(
    branch_id: int,
    leave_date: Optional[date] = Query(default=None),
    class_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(teacher_and_above),
):
    target = leave_date or date.today()
    query = db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date == target,
        AttendanceRecord.status == AttendanceStatus.leave,
    )
    records = query.all()
    result = []
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        if student:
            if class_name and student.class_name != class_name:
                continue
            result.append(_enrich(r, student))
    return result


# ---------------------------------------------------------------------------
# HOLIDAYS
# ---------------------------------------------------------------------------

@router.post("/holidays", response_model=dict)
def add_holiday(
    branch_id: int,
    holiday_date: date,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    existing = db.query(Holiday).filter(
        Holiday.branch_id == branch_id,
        Holiday.date == holiday_date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    h = Holiday(branch_id=branch_id, date=holiday_date, reason=reason)
    db.add(h)
    db.commit()
    return {"message": "Holiday added", "date": str(holiday_date)}


@router.delete("/holidays")
def remove_holiday(
    branch_id: int,
    holiday_date: date,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    h = db.query(Holiday).filter(
        Holiday.branch_id == branch_id,
        Holiday.date == holiday_date,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(h)
    db.commit()
    return {"message": "Holiday removed"}


@router.get("/holidays", response_model=List[dict])
def list_holidays(
    branch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(all_staff),
):
    holidays = db.query(Holiday).filter(Holiday.branch_id == branch_id).order_by(Holiday.date).all()
    return [{"id": h.id, "date": str(h.date), "reason": h.reason} for h in holidays]


# ---------------------------------------------------------------------------
# HELPER
# ---------------------------------------------------------------------------

def _enrich(record: AttendanceRecord, student: Student) -> AttendanceOut:
    out = AttendanceOut.model_validate(record)
    out.student_name = student.name
    out.roll_number = student.roll_number
    out.class_name = student.class_name
    return out
