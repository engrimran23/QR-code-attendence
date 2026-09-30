from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.models.attendance import AttendanceStatus


LEAVE_TYPES = {"sick", "urgent", "other"}


class LeaveMarkRequest(BaseModel):
    student_id: int
    date: date
    leave_type: str   # sick | urgent | other
    reason: Optional[str] = None

    def formatted_note(self) -> str:
        lt = self.leave_type.lower() if self.leave_type in LEAVE_TYPES else "other"
        labels = {"sick": "Sick Leave", "urgent": "Urgent Work", "other": "Other Leave"}
        return f"[{labels[lt]}] {self.reason or ''}".strip()


class LeaveOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    class_name: Optional[str] = None
    date: date
    leave_type: str
    reason: Optional[str]
    marked_by: Optional[str] = None

    class Config:
        from_attributes = True


class ScanRequest(BaseModel):
    qr_token: str
    branch_id: int


class ScanResult(BaseModel):
    success: bool
    message: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    class_name: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[AttendanceStatus] = None
    check_in_time: Optional[datetime] = None
    already_scanned: bool = False


class OfflineScanEntry(BaseModel):
    qr_token: str
    scanned_at: datetime


class OfflineSyncRequest(BaseModel):
    branch_id: int
    scans: List[OfflineScanEntry]


class OfflineSyncResult(BaseModel):
    processed: int
    skipped: int
    errors: List[str] = []


class ManualAttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus
    date: date
    note: Optional[str] = None


class BulkManualRequest(BaseModel):
    branch_id: int
    entries: List[ManualAttendanceEntry]


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    class_name: Optional[str] = None
    branch_id: int
    date: date
    check_in_time: Optional[datetime]
    status: AttendanceStatus
    is_manual: bool
    note: Optional[str]
    whatsapp_sent: bool

    class Config:
        from_attributes = True


class DailySummary(BaseModel):
    date: date
    branch_id: int
    total_students: int
    present: int
    absent: int
    late: int
    on_leave: int
    attendance_percentage: float


class ClassSummary(BaseModel):
    class_name: str
    section: Optional[str]
    total: int
    present: int
    absent: int
    late: int
    attendance_percentage: float


class StudentAttendanceRecord(BaseModel):
    student_id: int
    student_name: str
    roll_number: str
    class_name: str
    section: Optional[str]
    status: AttendanceStatus
    check_in_time: Optional[datetime]
    is_manual: bool
    note: Optional[str]
