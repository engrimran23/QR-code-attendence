from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import pandas as pd

from app.database import get_db
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut, BulkImportResult
from app.services.auth import get_current_user, require_roles
from app.services.qr import (
    generate_qr_token, generate_qr_image, generate_qr_card,
    save_qr_locally, generate_bulk_zip,
)

router = APIRouter(prefix="/students", tags=["Students"])

staff_roles = require_roles(
    UserRole.super_admin, UserRole.school_admin, UserRole.branch_admin, UserRole.teacher
)
admin_roles = require_roles(UserRole.super_admin, UserRole.school_admin, UserRole.branch_admin)


@router.post("/", response_model=StudentOut)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    existing = db.query(Student).filter(
        Student.branch_id == payload.branch_id,
        Student.roll_number == payload.roll_number,
        Student.class_name == payload.class_name,
        Student.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Roll number already exists in this class")

    token = generate_qr_token()
    student = Student(**payload.model_dump(), qr_token=token)
    db.add(student)
    db.commit()
    db.refresh(student)

    qr_path = save_qr_locally(token, student.name, student.roll_number, student.class_name, student.section)
    student.qr_image_url = qr_path
    db.commit()
    db.refresh(student)
    return student


@router.get("/template")
def download_template(_: User = Depends(admin_roles)):
    """Download Excel template for bulk student import."""
    df = pd.DataFrame(columns=["name", "roll_number", "class_name", "section", "parent_name", "parent_phone"])
    sample = [
        {"name": "Ali Ahmed", "roll_number": "001", "class_name": "10", "section": "A", "parent_name": "Mr Ahmed", "parent_phone": "03001234567"},
        {"name": "Sara Khan",  "roll_number": "002", "class_name": "10", "section": "A", "parent_name": "Mrs Khan",  "parent_phone": "03009876543"},
    ]
    df = pd.DataFrame(sample)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Students")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_import_template.xlsx"},
    )


@router.get("/", response_model=List[StudentOut])
def list_students(
    branch_id: Optional[int] = None,
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_roles),
):
    query = db.query(Student).filter(Student.is_active == True)

    if current_user.role not in (UserRole.super_admin, UserRole.school_admin):
        query = query.filter(Student.branch_id == current_user.branch_id)
    elif branch_id:
        query = query.filter(Student.branch_id == branch_id)

    if class_name:
        query = query.filter(Student.class_name == class_name)
    if section:
        query = query.filter(Student.section == section)
    if search:
        query = query.filter(
            Student.name.ilike(f"%{search}%") | Student.roll_number.ilike(f"%{search}%")
        )

    return query.order_by(Student.class_name, Student.roll_number).all()


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(student, key, val)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_active = False
    db.commit()
    return {"message": "Student deactivated"}


@router.get("/{student_id}/qr")
def download_qr(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(staff_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    image_bytes = generate_qr_card(
        student.qr_token, student.name, student.roll_number,
        student.class_name, student.section, student.parent_name,
    )
    return StreamingResponse(
        io.BytesIO(image_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={student.roll_number}_qr_card.png"},
    )


@router.post("/regenerate-qr/{student_id}", response_model=StudentOut)
def regenerate_qr(
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.qr_token = generate_qr_token()
    qr_path = save_qr_locally(student.qr_token, student.name, student.roll_number, student.class_name, student.section)
    student.qr_image_url = qr_path
    db.commit()
    db.refresh(student)
    return student


@router.get("/bulk-qr/{branch_id}")
def download_bulk_qr(
    branch_id: int,
    class_name: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    """Download ZIP of QR cards for all students in a branch (optionally filtered by class)."""
    query = db.query(Student).filter(Student.branch_id == branch_id, Student.is_active == True)
    if class_name:
        query = query.filter(Student.class_name == class_name)
    students = query.order_by(Student.class_name, Student.roll_number).all()

    if not students:
        raise HTTPException(status_code=404, detail="No students found")

    payload = [
        {
            "token": s.qr_token,
            "name": s.name,
            "roll_number": s.roll_number,
            "class_name": s.class_name,
            "section": s.section,
            "parent_name": s.parent_name,
        }
        for s in students
    ]
    zip_bytes = generate_bulk_zip(payload)
    fname = f"qr_cards_branch{branch_id}" + (f"_class{class_name}" if class_name else "") + ".zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.post("/bulk-import/{branch_id}", response_model=BulkImportResult)
async def bulk_import(
    branch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse Excel file")

    required_cols = {"name", "roll_number", "class_name"}
    if not required_cols.issubset(set(df.columns.str.lower())):
        raise HTTPException(status_code=400, detail=f"Excel must have columns: {required_cols}")

    df.columns = df.columns.str.lower()
    created, failed = 0, 0
    errors = []

    for idx, row in df.iterrows():
        try:
            existing = db.query(Student).filter(
                Student.branch_id == branch_id,
                Student.roll_number == str(row["roll_number"]),
                Student.class_name == str(row["class_name"]),
                Student.is_active == True,
            ).first()
            if existing:
                errors.append(f"Row {idx+2}: Roll {row['roll_number']} in class {row['class_name']} already exists")
                failed += 1
                continue

            token = generate_qr_token()
            sec = str(row.get("section", "")).strip() or None
            pname = str(row.get("parent_name", "")).strip() or None
            pphone = str(row.get("parent_phone", "")).strip() or None
            student = Student(
                branch_id=branch_id,
                name=str(row["name"]),
                roll_number=str(row["roll_number"]),
                class_name=str(row["class_name"]),
                section=sec,
                parent_name=pname,
                parent_phone=pphone,
                qr_token=token,
            )
            db.add(student)
            db.flush()
            qr_path = save_qr_locally(token, student.name, student.roll_number, student.class_name, sec)
            student.qr_image_url = qr_path
            created += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx+2}: {str(e)}")

    db.commit()
    return BulkImportResult(created=created, failed=failed, errors=errors)
