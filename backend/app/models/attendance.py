import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class NotificationType(str, enum.Enum):
    arrival = "arrival"
    late = "late"
    absent = "absent"
    custom = "custom"


class NotificationStatus(str, enum.Enum):
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    leave = "leave"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(AttendanceStatus), nullable=False, default=AttendanceStatus.present)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_manual = Column(Boolean, default=False)
    note = Column(Text, nullable=True)
    whatsapp_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="attendance_records")
    branch = relationship("Branch", back_populates="attendance_records")
    scanned_by_user = relationship("User", back_populates="attendance_records")


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    recipient_phone = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(NotificationStatus), nullable=False)
    twilio_sid = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")
    branch = relationship("Branch")


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    branch = relationship("Branch", back_populates="holidays")
