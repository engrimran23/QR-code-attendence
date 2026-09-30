from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    name = Column(String(150), nullable=False)
    roll_number = Column(String(50), nullable=False)
    class_name = Column(String(50), nullable=False)
    section = Column(String(10), nullable=True)
    parent_name = Column(String(150), nullable=True)
    parent_phone = Column(String(20), nullable=True)
    photo_url = Column(String(500), nullable=True)
    qr_token = Column(String(100), unique=True, index=True, nullable=False)
    qr_image_url = Column(String(500), nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    branch = relationship("Branch", back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
