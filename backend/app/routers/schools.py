from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.school import School
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolOut, BranchCreate, BranchUpdate, BranchOut
from app.services.auth import get_current_user, require_roles

router = APIRouter(prefix="/schools", tags=["Schools & Branches"])

super_admin_only = require_roles(UserRole.super_admin)
admin_roles = require_roles(UserRole.super_admin, UserRole.school_admin)


# --- Schools ---

@router.post("/", response_model=SchoolOut)
def create_school(
    payload: SchoolCreate,
    db: Session = Depends(get_db),
    _: User = Depends(super_admin_only),
):
    school = School(**payload.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@router.get("/", response_model=List[SchoolOut])
def list_schools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.super_admin:
        return db.query(School).all()
    return db.query(School).filter(School.id == current_user.school_id).all()


@router.get("/{school_id}", response_model=SchoolOut)
def get_school(school_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.put("/{school_id}", response_model=SchoolOut)
def update_school(
    school_id: int,
    payload: SchoolUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(school, key, val)
    db.commit()
    db.refresh(school)
    return school


# --- Branches ---

@router.post("/branches/", response_model=BranchOut)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    school = db.query(School).filter(School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    branch = Branch(**payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.get("/branches/", response_model=List[BranchOut])
def list_branches(
    school_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Branch)
    if current_user.role == UserRole.super_admin:
        if school_id:
            query = query.filter(Branch.school_id == school_id)
    else:
        query = query.filter(Branch.school_id == current_user.school_id)
    return query.all()


@router.get("/branches/{branch_id}", response_model=BranchOut)
def get_branch(branch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.put("/branches/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_roles),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(branch, key, val)
    db.commit()
    db.refresh(branch)
    return branch
