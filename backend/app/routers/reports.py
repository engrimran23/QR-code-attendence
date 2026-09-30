from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, timedelta
import calendar
import io

from app.database import get_db
from app.models.student import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus, Holiday
from app.models.branch import Branch
from app.models.school import School
from app.models.user import User, UserRole
from app.services.auth import get_current_user, require_roles

router = APIRouter(prefix="/reports", tags=["Reports"])

staff_roles = require_roles(
    UserRole.super_admin, UserRole.school_admin,
    UserRole.branch_admin, UserRole.teacher,
)


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_school_branch(db: Session, branch_id: int):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    school = db.query(School).filter(School.id == branch.school_id).first()
    return school, branch


def _working_days(db: Session, branch_id: int, from_date: date, to_date: date) -> List[date]:
    holidays = {
        h.date for h in db.query(Holiday).filter(
            Holiday.branch_id == branch_id,
            Holiday.date >= from_date,
            Holiday.date <= to_date,
        ).all()
    }
    days = []
    d = from_date
    while d <= to_date:
        if d.weekday() < 5 and d not in holidays:  # Mon–Fri, not holiday
            days.append(d)
        d += timedelta(days=1)
    return days


def _build_daily_rows(db: Session, branch_id: int, target_date: date,
                      class_name: str = None, section: str = None):
    query = db.query(Student).filter(Student.branch_id == branch_id, Student.is_active == True)
    if class_name:
        query = query.filter(Student.class_name == class_name)
    if section:
        query = query.filter(Student.section == section)
    students = query.order_by(Student.class_name, Student.roll_number).all()

    recs = {
        r.student_id: r for r in db.query(AttendanceRecord).filter(
            AttendanceRecord.branch_id == branch_id,
            AttendanceRecord.date == target_date,
        ).all()
    }

    rows, present, late, absent = [], 0, 0, 0
    for s in students:
        rec = recs.get(s.id)
        status = rec.status if rec else "absent"
        if status == "present": present += 1
        elif status == "late":  late += 1
        else: absent += 1
        rows.append({
            "student_id": s.id, "roll_number": s.roll_number,
            "student_name": s.name, "class_name": s.class_name,
            "section": s.section, "status": status,
            "check_in_time": rec.check_in_time if rec else None,
            "is_manual": rec.is_manual if rec else False,
            "note": rec.note if rec else None,
        })

    total = len(students)
    pct = round((present + late) / total * 100, 1) if total else 0
    summary = {"total": total, "present": present, "late": late, "absent": absent, "pct": pct}
    return rows, summary


# ── JSON endpoints (used by the dashboard UI) ────────────────────────────────

@router.get("/daily")
def daily_report_json(
    branch_id: int,
    report_date: Optional[date] = Query(default=None),
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    target = report_date or date.today()
    rows, summary = _build_daily_rows(db, branch_id, target, class_name, section)
    return {"date": str(target), "summary": summary, "records": rows}


@router.get("/monthly")
def monthly_report_json(
    branch_id: int,
    year: int,
    month: int,
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1–12")

    first_day = date(year, month, 1)
    last_day  = date(year, month, calendar.monthrange(year, month)[1])
    work_days = _working_days(db, branch_id, first_day, last_day)

    query = db.query(Student).filter(Student.branch_id == branch_id, Student.is_active == True)
    if class_name: query = query.filter(Student.class_name == class_name)
    if section:    query = query.filter(Student.section == section)
    students = query.order_by(Student.roll_number).all()

    recs = db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date >= first_day,
        AttendanceRecord.date <= last_day,
    ).all()
    rec_map: dict = {}
    for r in recs:
        rec_map.setdefault(r.student_id, {})[str(r.date)] = r.status

    result = []
    for s in students:
        days = rec_map.get(s.id, {})
        present = sum(1 for d in work_days if days.get(str(d)) in ("present",))
        late    = sum(1 for d in work_days if days.get(str(d)) in ("late",))
        absent  = len(work_days) - present - late
        pct     = round((present + late) / len(work_days) * 100, 1) if work_days else 0
        result.append({
            "student_id": s.id, "roll_number": s.roll_number,
            "student_name": s.name, "class_name": s.class_name,
            "section": s.section, "working_days": len(work_days),
            "present": present, "late": late, "absent": absent,
            "pct": pct, "days": {str(d): days.get(str(d), "absent") for d in work_days},
        })

    return {
        "year": year, "month": month, "branch_id": branch_id,
        "working_days": len(work_days), "students": result,
    }


@router.get("/student/{student_id}")
def student_report_json(
    student_id: int,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    today = date.today()
    fd = from_date or date(today.year, today.month, 1)
    td = to_date or today

    work_days = _working_days(db, student.branch_id, fd, td)
    recs = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.date >= fd,
        AttendanceRecord.date <= td,
    ).order_by(AttendanceRecord.date).all()

    rec_map = {str(r.date): r for r in recs}
    records = []
    for d in work_days:
        r = rec_map.get(str(d))
        records.append({
            "date": d, "status": r.status if r else "absent",
            "check_in_time": r.check_in_time if r else None,
            "is_manual": r.is_manual if r else False,
            "note": r.note if r else None,
        })

    present = sum(1 for r in records if r["status"] == "present")
    late    = sum(1 for r in records if r["status"] == "late")
    absent  = len(work_days) - present - late
    pct     = round((present + late) / len(work_days) * 100, 1) if work_days else 0

    return {
        "student": {
            "id": student.id, "name": student.name,
            "roll_number": student.roll_number, "class_name": student.class_name,
            "section": student.section, "parent_phone": student.parent_phone,
        },
        "from_date": str(fd), "to_date": str(td),
        "stats": {"total": len(work_days), "present": present, "late": late, "absent": absent, "pct": pct},
        "records": records,
    }


@router.get("/low-attendance")
def low_attendance_report(
    branch_id: int,
    threshold: float = Query(default=75.0, ge=0, le=100),
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    data = monthly_report_json(branch_id=branch_id, year=y, month=m, db=db, _=_)
    flagged = [s for s in data["students"] if s["pct"] < threshold]
    flagged.sort(key=lambda x: x["pct"])
    return {
        "threshold": threshold, "year": y, "month": m,
        "flagged_count": len(flagged), "students": flagged,
    }


@router.get("/class-summary")
def class_summary_range(
    branch_id: int,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    today = date.today()
    fd = from_date or date(today.year, today.month, 1)
    td = to_date or today
    work_days = _working_days(db, branch_id, fd, td)

    students = db.query(Student).filter(
        Student.branch_id == branch_id, Student.is_active == True
    ).all()
    recs = db.query(AttendanceRecord).filter(
        AttendanceRecord.branch_id == branch_id,
        AttendanceRecord.date >= fd,
        AttendanceRecord.date <= td,
    ).all()
    rec_map: dict = {}
    for r in recs:
        rec_map.setdefault(r.student_id, {})[str(r.date)] = r.status

    class_map: dict = {}
    for s in students:
        key = (s.class_name, s.section or "")
        if key not in class_map:
            class_map[key] = {"total_student_days": 0, "present_days": 0, "late_days": 0, "count": 0}
        days = rec_map.get(s.id, {})
        class_map[key]["count"] += 1
        for d in work_days:
            class_map[key]["total_student_days"] += 1
            st = days.get(str(d))
            if st == "present": class_map[key]["present_days"] += 1
            elif st == "late":  class_map[key]["late_days"] += 1

    result = []
    for (cls, sec), v in sorted(class_map.items()):
        total = v["total_student_days"]
        pct = round((v["present_days"] + v["late_days"]) / total * 100, 1) if total else 0
        result.append({
            "class_name": cls, "section": sec, "students": v["count"],
            "working_days": len(work_days), "present_days": v["present_days"],
            "late_days": v["late_days"],
            "absent_days": total - v["present_days"] - v["late_days"],
            "avg_attendance_pct": pct,
        })
    return {"from_date": str(fd), "to_date": str(td), "classes": result}


# ── Excel downloads ───────────────────────────────────────────────────────────

@router.get("/export/daily/excel")
def export_daily_excel(
    branch_id: int,
    report_date: Optional[date] = Query(default=None),
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    from app.services.reports import daily_report_excel
    target = report_date or date.today()
    school, branch = _get_school_branch(db, branch_id)
    rows, summary = _build_daily_rows(db, branch_id, target, class_name, section)
    data = daily_report_excel(school.name, branch.name, target, rows, summary)
    fname = f"daily_{target}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.get("/export/monthly/excel")
def export_monthly_excel(
    branch_id: int,
    year: int,
    month: int,
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    from app.services.reports import monthly_report_excel
    school, branch = _get_school_branch(db, branch_id)
    data_json = monthly_report_json(
        branch_id=branch_id, year=year, month=month,
        class_name=class_name, section=section, db=db, _=_,
    )
    first_day = date(year, month, 1)
    last_day  = date(year, month, calendar.monthrange(year, month)[1])
    work_days = _working_days(db, branch_id, first_day, last_day)

    data = monthly_report_excel(
        school.name, branch.name, year, month,
        class_name or "All", section or "",
        data_json["working_days"], data_json["students"], work_days,
    )
    fname = f"monthly_{year}_{month:02d}_{class_name or 'all'}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ── PDF downloads ─────────────────────────────────────────────────────────────

@router.get("/export/daily/pdf")
def export_daily_pdf(
    branch_id: int,
    report_date: Optional[date] = Query(default=None),
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    from app.services.reports import daily_report_pdf
    target = report_date or date.today()
    school, branch = _get_school_branch(db, branch_id)
    rows, summary = _build_daily_rows(db, branch_id, target, class_name, section)
    data = daily_report_pdf(school.name, branch.name, target, rows, summary)
    fname = f"daily_{target}.pdf"
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.get("/export/student/{student_id}/pdf")
def export_student_pdf(
    student_id: int,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    from app.services.reports import student_report_pdf
    report = student_report_json(student_id=student_id, from_date=from_date, to_date=to_date, db=db, _=_)
    s = report["student"]
    school = db.query(School).join(Branch, Branch.school_id == School.id).join(
        Student, Student.branch_id == Branch.id
    ).filter(Student.id == student_id).first()
    school_name = school.name if school else "School"

    data = student_report_pdf(
        school_name, s["name"], s["roll_number"], s["class_name"],
        date.fromisoformat(report["from_date"]), date.fromisoformat(report["to_date"]),
        report["records"], report["stats"],
    )
    fname = f"student_{s['roll_number']}_report.pdf"
    return StreamingResponse(
        io.BytesIO(data), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )
