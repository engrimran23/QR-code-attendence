from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel

from app.database import get_db
from app.models.attendance import NotificationLog, NotificationType, NotificationStatus
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.attendance import AttendanceStatus
from app.services.auth import get_current_user, require_roles
from app.services.whatsapp import send_whatsapp, build_custom_message, notify_absent

router = APIRouter(prefix="/notifications", tags=["Notifications"])

admin_roles = require_roles(UserRole.super_admin, UserRole.school_admin, UserRole.branch_admin)


class NotificationLogOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    branch_id: int
    notification_type: NotificationType
    recipient_phone: str
    message: str
    status: NotificationStatus
    twilio_sid: Optional[str]
    error_message: Optional[str]
    sent_at: datetime

    class Config:
        from_attributes = True


class CustomMessageRequest(BaseModel):
    branch_id: int
    student_ids: List[int]
    message_body: str


class TestMessageRequest(BaseModel):
    phone: str
    message: str = "This is a test message from QR Attendance System. ✅"


# ── Notification logs ────────────────────────────────────────────────────────

@router.get("/logs", response_model=List[NotificationLogOut])
def list_logs(
    branch_id: int,
    notification_type: Optional[NotificationType] = None,
    status: Optional[NotificationStatus] = None,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    query = db.query(NotificationLog).filter(NotificationLog.branch_id == branch_id)
    if notification_type:
        query = query.filter(NotificationLog.notification_type == notification_type)
    if status:
        query = query.filter(NotificationLog.status == status)
    if from_date:
        query = query.filter(NotificationLog.sent_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.filter(NotificationLog.sent_at <= datetime.combine(to_date, datetime.max.time()))

    logs = query.order_by(NotificationLog.sent_at.desc()).limit(limit).all()

    result = []
    student_cache = {}
    for log in logs:
        if log.student_id not in student_cache:
            s = db.query(Student).filter(Student.id == log.student_id).first()
            student_cache[log.student_id] = s.name if s else "Unknown"
        out = NotificationLogOut.model_validate(log)
        out.student_name = student_cache[log.student_id]
        result.append(out)
    return result


# ── Send absent alerts manually (for a specific date) ───────────────────────

@router.post("/send-absent-alerts")
def send_absent_alerts_manual(
    branch_id: int,
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    from app.models.attendance import AttendanceRecord, Holiday
    from app.models.school import School
    from app.models.branch import Branch

    today = target_date or date.today()

    is_holiday = db.query(Holiday).filter(
        Holiday.branch_id == branch_id,
        Holiday.date == today,
    ).first()
    if is_holiday:
        raise HTTPException(status_code=400, detail="Cannot send absent alerts on a holiday")

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    school = db.query(School).filter(School.id == branch.school_id).first()
    school_name = school.name if school else "School"

    present_ids = {
        r.student_id for r in db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id == branch_id,
            AttendanceRecord.date == today,
        ).all()
    }

    absent_students = db.query(Student).filter(
        Student.branch_id == branch_id,
        Student.is_active == True,
        ~Student.id.in_(present_ids) if present_ids else True,
    ).all()

    sent, skipped = 0, 0
    for student in absent_students:
        if not student.parent_phone:
            skipped += 1
            continue
        notify_absent(db, student, school_name)
        sent += 1

    return {"sent": sent, "skipped_no_phone": skipped, "date": str(today)}


# ── Send custom message to selected students ─────────────────────────────────

@router.post("/send-custom")
def send_custom_message(
    payload: CustomMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    from app.models.school import School
    from app.models.branch import Branch

    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    school = db.query(School).filter(School.id == branch.school_id).first()
    school_name = school.name if school else "School"

    sent, failed, skipped = 0, 0, 0
    for sid in payload.student_ids:
        student = db.query(Student).filter(Student.id == sid).first()
        if not student or not student.parent_phone:
            skipped += 1
            continue
        msg = build_custom_message(student.name, school_name, payload.message_body)
        log = send_whatsapp(db, student.id, payload.branch_id, student.parent_phone,
                            NotificationType.custom, msg)
        if log.status == NotificationStatus.sent:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed, "skipped_no_phone": skipped}


# ── Test WhatsApp connection ──────────────────────────────────────────────────

@router.post("/test")
def test_whatsapp(
    payload: TestMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.super_admin, UserRole.school_admin)),
):
    from app.services.whatsapp import _normalize_phone
    from app.config import settings

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=400, detail="Twilio credentials not configured in .env")

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        to = _normalize_phone(payload.phone)
        msg = client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=to,
            body=payload.message,
        )
        return {"status": "sent", "sid": msg.sid, "to": to}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Summary stats ─────────────────────────────────────────────────────────────

@router.get("/stats")
def notification_stats(
    branch_id: int,
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    today = target_date or date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    query = db.query(NotificationLog).filter(
        NotificationLog.branch_id == branch_id,
        NotificationLog.sent_at >= start,
        NotificationLog.sent_at <= end,
    )
    logs = query.all()

    stats = {
        "date": str(today),
        "total": len(logs),
        "sent": sum(1 for l in logs if l.status == NotificationStatus.sent),
        "failed": sum(1 for l in logs if l.status == NotificationStatus.failed),
        "skipped": sum(1 for l in logs if l.status == NotificationStatus.skipped),
        "by_type": {
            "arrival": sum(1 for l in logs if l.notification_type == NotificationType.arrival),
            "late": sum(1 for l in logs if l.notification_type == NotificationType.late),
            "absent": sum(1 for l in logs if l.notification_type == NotificationType.absent),
            "custom": sum(1 for l in logs if l.notification_type == NotificationType.custom),
        },
    }
    return stats
