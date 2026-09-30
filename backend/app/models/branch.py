from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    timezone = Column(String(50), default="Asia/Karachi")
    school_start_time = Column(Time, nullable=True)
    late_cutoff_time = Column(Time, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    school = relationship("School", back_populates="branches")
    users = relationship("User", back_populates="branch")
    students = relationship("Student", back_populates="branch", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="branch")
    holidays = relationship("Holiday", back_populates="branch", cascade="all, delete-orphan")
