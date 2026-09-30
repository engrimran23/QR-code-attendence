from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StudentCreate(BaseModel):
    branch_id: int
    name: str
    roll_number: str
    class_name: str
    section: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    roll_number: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class StudentOut(BaseModel):
    id: int
    branch_id: int
    name: str
    roll_number: str
    class_name: str
    section: Optional[str]
    parent_name: Optional[str]
    parent_phone: Optional[str]
    photo_url: Optional[str]
    qr_token: str
    qr_image_url: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBulkRow(BaseModel):
    name: str
    roll_number: str
    class_name: str
    section: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None


class BulkImportResult(BaseModel):
    created: int
    failed: int
    errors: List[str] = []
