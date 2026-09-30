"""
Shared test fixtures.
Uses an in-memory SQLite database so no PostgreSQL is needed to run tests.
"""
import os
# Set SQLite URL BEFORE any app module is imported so settings reads it correctly
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY",   "test-secret-key-not-for-production-use")
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.school import School
from app.models.branch import Branch
from app.models.student import Student
from app.utils.security import hash_password
from app.services.qr import generate_qr_token

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

@pytest.fixture()
def super_admin(db):
    existing = db.query(User).filter(User.email == "admin@test.com").first()
    if existing:
        return existing
    u = User(
        name="Super Admin", email="admin@test.com",
        password_hash=hash_password("Admin@123"),
        role=UserRole.super_admin, is_active=True,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture()
def school(db):
    existing = db.query(School).filter(School.name == "Test School").first()
    if existing:
        return existing
    s = School(name="Test School", phone="03001234567", email="school@test.com")
    db.add(s); db.commit(); db.refresh(s)
    return s


@pytest.fixture()
def branch(db, school):
    existing = db.query(Branch).filter(Branch.name == "Main Branch").first()
    if existing:
        return existing
    b = Branch(school_id=school.id, name="Main Branch", timezone="Asia/Karachi")
    db.add(b); db.commit(); db.refresh(b)
    return b


@pytest.fixture()
def teacher(db, school, branch):
    existing = db.query(User).filter(User.email == "teacher@test.com").first()
    if existing:
        return existing
    u = User(
        name="Teacher One", email="teacher@test.com",
        password_hash=hash_password("Teacher@123"),
        role=UserRole.teacher,
        school_id=school.id, branch_id=branch.id, is_active=True,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture()
def student(db, branch):
    existing = db.query(Student).filter(Student.roll_number == "001").first()
    if existing:
        return existing
    token = generate_qr_token()
    s = Student(
        branch_id=branch.id, name="Ali Khan",
        roll_number="001", class_name="5", section="A",
        parent_phone="03001111111", qr_token=token,
    )
    db.add(s); db.commit(); db.refresh(s)
    return s


# ── Auth token helpers ────────────────────────────────────────────────────────

@pytest.fixture()
def admin_token(client, super_admin):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "Admin@123"})
    return r.json()["access_token"]


@pytest.fixture()
def teacher_token(client, teacher):
    r = client.post("/auth/login", json={"email": "teacher@test.com", "password": "Teacher@123"})
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}
