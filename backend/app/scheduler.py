"""
APScheduler jobs:
  - Every minute: check each active branch — if now >= school_start + delay, send absent alerts
  - Runs at startup alongside FastAPI
"""
from datetime import date, datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import pytz
import logging

log = logging.getLogger("scheduler")


def send_absent_alerts():
    from app.database import SessionLocal
    from app.models.branch import Branch
    from app.models.school import School
    from app.models.student import Student
    from app.models.attendance import AttendanceRecord, AttendanceStatus, Holiday, NotificationLog, NotificationType
    from app.services.whatsapp import notify_absent
    from app.config import settings

    db = SessionLocal()
    try:
        today = date.today()
        branches = db.query(Branch).filter(Branch.is_active == True).all()

        for branch in branches:
            if branch.school_start_time is None:
                continue

            tz = pytz.timezone(branch.timezone or "Asia/Karachi")
            now_local = datetime.now(tz)
            cutoff_dt = tz.localize(datetime.combine(today, branch.school_start_time)) + \
                        timedelta(minutes=settings.ABSENT_ALERT_DELAY_MINUTES)

            if now_local < cutoff_dt:
                continue  # Too early — haven't hit the alert window yet

            # Skip if today is a holiday
            is_holiday = db.query(Holiday).filter(
                Holiday.branch_id == branch.id,
                Holiday.date == today,
            ).first()
            if is_holiday:
                continue

            school = db.query(School).filter(School.id == branch.school_id).first()
            school_name = school.name if school else "School"

            # Find all active students who have NO attendance record today
            present_ids = {
                r.student_id for r in db.query(AttendanceRecord).filter(
                    AttendanceRecord.branch_id == branch.id,
                    AttendanceRecord.date == today,
                ).all()
            }

            absent_students = db.query(Student).filter(
                Student.branch_id == branch.id,
                Student.is_active == True,
                Student.id.notin_(present_ids) if present_ids else True,
            ).all()

            for student in absent_students:
                if not student.parent_phone:
                    continue

                # Only send absent alert once per day per student
                already_notified = db.query(NotificationLog).filter(
                    NotificationLog.student_id == student.id,
                    NotificationLog.notification_type == NotificationType.absent,
                ).filter(
                    NotificationLog.sent_at >= datetime.combine(today, datetime.min.time())
                ).first()

                if already_notified:
                    continue

                # Create absent attendance record
                absent_record = AttendanceRecord(
                    student_id=student.id,
                    branch_id=branch.id,
                    date=today,
                    status=AttendanceStatus.absent,
                    is_manual=False,
                )
                db.add(absent_record)
                db.commit()

                notify_absent(db, student, school_name)
                log.info(f"Absent alert sent: {student.name} | branch {branch.id}")

    except Exception as e:
        log.error(f"Scheduler error: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        send_absent_alerts,
        trigger=IntervalTrigger(minutes=1),
        id="absent_alerts",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    log.info("Scheduler started — checking absent alerts every minute")
    return scheduler
