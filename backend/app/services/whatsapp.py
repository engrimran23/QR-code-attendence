from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.config import settings
from app.models.attendance import NotificationLog, NotificationType, NotificationStatus


# ── Message templates ────────────────────────────────────────────────────────

def _fmt_time(dt: datetime) -> str:
    return dt.strftime("%I:%M %p") if dt else ""


def build_arrival_message(student_name: str, school_name: str, check_in_time: datetime) -> str:
    return (
        f"✅ *Attendance Alert*\n\n"
        f"*{student_name}* has arrived at *{school_name}*.\n"
        f"🕐 Check-in time: *{_fmt_time(check_in_time)}*\n\n"
        f"_This is an automated message from {school_name}._"
    )


def build_late_message(student_name: str, school_name: str, check_in_time: datetime) -> str:
    return (
        f"⚠️ *Late Arrival Alert*\n\n"
        f"*{student_name}* arrived *late* at *{school_name}*.\n"
        f"🕐 Arrived at: *{_fmt_time(check_in_time)}*\n\n"
        f"_This is an automated message from {school_name}._"
    )


def build_absent_message(student_name: str, school_name: str) -> str:
    return (
        f"❌ *Absence Alert*\n\n"
        f"*{student_name}* has *NOT arrived* at *{school_name}* today.\n\n"
        f"If this is unexpected, please contact the school immediately.\n\n"
        f"_This is an automated message from {school_name}._"
    )


def build_custom_message(student_name: str, school_name: str, body: str) -> str:
    return f"📢 *{school_name}*\n\n{body.replace('{name}', student_name)}"


# ── Send via Twilio ──────────────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+92" + phone.lstrip("0")
    return f"whatsapp:{phone}"


def send_whatsapp(
    db: Session,
    student_id: int,
    branch_id: int,
    recipient_phone: str,
    notification_type: NotificationType,
    message: str,
) -> NotificationLog:
    twilio_sid = None
    error_msg = None
    status = NotificationStatus.failed

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        status = NotificationStatus.skipped
        error_msg = "Twilio credentials not configured"
    else:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            to = _normalize_phone(recipient_phone)
            msg = client.messages.create(
                from_=settings.TWILIO_WHATSAPP_FROM,
                to=to,
                body=message,
            )
            twilio_sid = msg.sid
            status = NotificationStatus.sent
        except Exception as e:
            error_msg = str(e)

    log = NotificationLog(
        student_id=student_id,
        branch_id=branch_id,
        notification_type=notification_type,
        recipient_phone=recipient_phone,
        message=message,
        status=status,
        twilio_sid=twilio_sid,
        error_message=error_msg,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ── High-level helpers called by attendance service ─────────────────────────

def notify_arrival(db: Session, student, school_name: str, check_in_time: datetime):
    if not student.parent_phone:
        return
    msg = build_arrival_message(student.name, school_name, check_in_time)
    send_whatsapp(db, student.id, student.branch_id, student.parent_phone,
                  NotificationType.arrival, msg)


def notify_late(db: Session, student, school_name: str, check_in_time: datetime):
    if not student.parent_phone:
        return
    msg = build_late_message(student.name, school_name, check_in_time)
    send_whatsapp(db, student.id, student.branch_id, student.parent_phone,
                  NotificationType.late, msg)


def notify_absent(db: Session, student, school_name: str):
    if not student.parent_phone:
        return
    msg = build_absent_message(student.name, school_name)
    send_whatsapp(db, student.id, student.branch_id, student.parent_phone,
                  NotificationType.absent, msg)
