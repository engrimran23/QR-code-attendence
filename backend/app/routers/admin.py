"""
Super Admin only: system-wide stats, cross-branch/school analytics, user management.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, timedelta
import calendar

from app.database import get_db
from app.models.school import School
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus, NotificationLog
from app.services.auth import require_roles

router = APIRouter(prefix="/admin", tags=["Super Admin"])

super_only  = require_roles(UserRole.super_admin)
admin_roles = require_roles(UserRole.super_admin, UserRole.school_admin, UserRole.branch_admin)


# ── System-wide stats ────────────────────────────────────────────────────────

@router.get("/stats")
def system_stats(db: Session = Depends(get_db), _: User = Depends(super_only)):
    today = date.today()
    total_schools   = db.query(School).filter(School.is_active == True).count()
    total_branches  = db.query(Branch).filter(Branch.is_active == True).count()
    total_students  = db.query(Student).filter(Student.is_active == True).count()
    total_users     = db.query(User).filter(User.is_active == True).count()
    scans_today     = db.query(AttendanceRecord).filter(AttendanceRecord.date == today).count()
    notifs_today    = db.query(NotificationLog).filter(
        func.date(NotificationLog.sent_at) == today
    ).count()

    return {
        "total_schools":  total_schools,
        "total_branches": total_branches,
        "total_students": total_students,
        "total_users":    total_users,
        "scans_today":    scans_today,
        "notifications_today": notifs_today,
        "date": str(today),
    }


# ── All schools with counts ──────────────────────────────────────────────────

@router.get("/schools/overview")
def schools_overview(db: Session = Depends(get_db), _: User = Depends(super_only)):
    schools = db.query(School).all()
    result = []
    today = date.today()

    for s in schools:
        branch_ids = [b.id for b in db.query(Branch).filter(Branch.school_id == s.id).all()]
        student_count = db.query(Student).filter(
            Student.branch_id.in_(branch_ids), Student.is_active == True
        ).count() if branch_ids else 0

        present_today = db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id.in_(branch_ids),
            AttendanceRecord.date == today,
            AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late]),
        ).count() if branch_ids else 0

        pct = round(present_today / student_count * 100, 1) if student_count else 0

        result.append({
            "id": s.id, "name": s.name, "email": s.email,
            "phone": s.phone, "is_active": s.is_active,
            "branch_count": len(branch_ids),
            "student_count": student_count,
            "present_today": present_today,
            "attendance_pct_today": pct,
        })
    return result


# ── Cross-branch attendance comparison ──────────────────────────────────────

@router.get("/cross-branch")
def cross_branch_comparison(
    school_id: int,
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    today = target_date or date.today()
    branches = db.query(Branch).filter(Branch.school_id == school_id, Branch.is_active == True).all()
    result = []
    for b in branches:
        total = db.query(Student).filter(Student.branch_id == b.id, Student.is_active == True).count()
        recs  = db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id == b.id, AttendanceRecord.date == today
        ).all()
        present = sum(1 for r in recs if r.status in (AttendanceStatus.present, AttendanceStatus.late))
        absent  = total - present
        pct     = round(present / total * 100, 1) if total else 0
        result.append({
            "branch_id": b.id, "branch_name": b.name,
            "total": total, "present": present, "absent": absent, "pct": pct,
        })
    return {"school_id": school_id, "date": str(today), "branches": result}


# ── Weekly trend (last 7 working days) for a branch ─────────────────────────

@router.get("/trend/weekly")
def weekly_trend(
    branch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    today = date.today()
    total = db.query(Student).filter(Student.branch_id == branch_id, Student.is_active == True).count()
    days, labels, pcts = [], [], []
    d = today
    while len(days) < 7:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    days.reverse()

    for day in days:
        present = db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id == branch_id,
            AttendanceRecord.date == day,
            AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late]),
        ).count()
        pct = round(present / total * 100, 1) if total else 0
        labels.append(day.strftime("%a %d"))
        pcts.append(pct)

    return {"branch_id": branch_id, "labels": labels, "pcts": pcts}


# ── Monthly trend (last 6 months) for a branch ───────────────────────────────

@router.get("/trend/monthly")
def monthly_trend(
    branch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    today = date.today()
    labels, pcts = [], []

    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m < 1:
            m += 12; y -= 1
        first = date(y, m, 1)
        last  = date(y, m, calendar.monthrange(y, m)[1])

        total_students = db.query(Student).filter(
            Student.branch_id == branch_id, Student.is_active == True
        ).count()
        if total_students == 0:
            labels.append(first.strftime("%b %Y")); pcts.append(0); continue

        working = sum(
            1 for d in (first + timedelta(n) for n in range((last - first).days + 1))
            if d.weekday() < 5
        )
        if working == 0:
            labels.append(first.strftime("%b %Y")); pcts.append(0); continue

        present_days = db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id == branch_id,
            AttendanceRecord.date >= first,
            AttendanceRecord.date <= last,
            AttendanceRecord.status.in_([AttendanceStatus.present, AttendanceStatus.late]),
        ).count()

        pct = round(present_days / (working * total_students) * 100, 1)
        labels.append(first.strftime("%b %Y"))
        pcts.append(pct)

    return {"branch_id": branch_id, "labels": labels, "pcts": pcts}


# ── Users list for a school ──────────────────────────────────────────────────

@router.get("/users")
def list_all_users(
    school_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_roles),
):
    query = db.query(User)
    if current_user.role == UserRole.super_admin:
        if school_id:
            query = query.filter(User.school_id == school_id)
    else:
        query = query.filter(User.school_id == current_user.school_id)
    users = query.order_by(User.role, User.name).all()
    return [
        {
            "id": u.id, "name": u.name, "email": u.email,
            "role": u.role, "school_id": u.school_id,
            "branch_id": u.branch_id, "is_active": u.is_active,
        }
        for u in users
    ]
