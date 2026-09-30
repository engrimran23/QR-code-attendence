from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class SchoolCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class SchoolOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str]
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BranchCreate(BaseModel):
    school_id: int
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "Asia/Karachi"
    school_start_time: Optional[str] = None
    late_cutoff_time: Optional[str] = None


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    school_start_time: Optional[str] = None
    late_cutoff_time: Optional[str] = None
    is_active: Optional[bool] = None


class BranchOut(BaseModel):
    id: int
    school_id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    timezone: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
