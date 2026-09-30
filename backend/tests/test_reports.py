"""Tests for report endpoints and file exports."""
from datetime import date, timedelta
from tests.conftest import auth


def test_daily_report_json(client, teacher_token, branch, student):
    r = client.get(
        f"/reports/daily?branch_id={branch.id}&report_date={date.today().isoformat()}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert "records" in data
    assert data["summary"]["total"] >= 1


def test_monthly_report_json(client, teacher_token, branch, student):
    today = date.today()
    r = client.get(
        f"/reports/monthly?branch_id={branch.id}&year={today.year}&month={today.month}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert "students" in data
    assert "working_days" in data
    assert isinstance(data["students"], list)


def test_student_report(client, teacher_token, student):
    r = client.get(f"/reports/student/{student.id}", headers=auth(teacher_token))
    assert r.status_code == 200
    data = r.json()
    assert data["student"]["id"] == student.id
    assert "stats" in data
    assert "records" in data


def test_student_report_not_found(client, teacher_token):
    r = client.get("/reports/student/99999", headers=auth(teacher_token))
    assert r.status_code == 404


def test_low_attendance_report(client, teacher_token, branch):
    today = date.today()
    r = client.get(
        f"/reports/low-attendance?branch_id={branch.id}"
        f"&year={today.year}&month={today.month}&threshold=75",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert "threshold" in data
    assert "students" in data
    assert isinstance(data["students"], list)


def test_class_summary_range(client, teacher_token, branch):
    today = date.today()
    r = client.get(
        f"/reports/class-summary?branch_id={branch.id}"
        f"&from_date={(today - timedelta(days=30)).isoformat()}"
        f"&to_date={today.isoformat()}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert "classes" in r.json()


def test_export_daily_excel(client, teacher_token, branch):
    r = client.get(
        f"/reports/export/daily/excel?branch_id={branch.id}&report_date={date.today().isoformat()}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    ct = r.headers["content-type"]
    assert "spreadsheetml" in ct or "excel" in ct
    assert len(r.content) > 100


def test_export_daily_pdf(client, teacher_token, branch):
    r = client.get(
        f"/reports/export/daily/pdf?branch_id={branch.id}&report_date={date.today().isoformat()}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_export_monthly_excel(client, teacher_token, branch):
    today = date.today()
    r = client.get(
        f"/reports/export/monthly/excel?branch_id={branch.id}&year={today.year}&month={today.month}",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]


def test_export_student_pdf(client, teacher_token, student):
    r = client.get(
        f"/reports/export/student/{student.id}/pdf",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"


def test_report_requires_auth(client, branch):
    r = client.get(f"/reports/daily?branch_id={branch.id}")
    assert r.status_code in (401, 403)  # FastAPI version-dependent


def test_gate_staff_cannot_access_reports(client, db, school, branch):
    from app.models.user import User, UserRole
    from app.utils.security import hash_password
    gate = db.query(User).filter(User.email == "gate@test.com").first()
    if not gate:
        gate = User(name="Gate", email="gate@test.com",
                    password_hash=hash_password("Gate@123"),
                    role=UserRole.gate_staff,
                    school_id=school.id, branch_id=branch.id, is_active=True)
        db.add(gate); db.commit()

    login = client.post("/auth/login", json={"email": "gate@test.com", "password": "Gate@123"})
    gate_token = login.json()["access_token"]
    r = client.get(f"/reports/daily?branch_id={branch.id}",
                   headers={"Authorization": f"Bearer {gate_token}"})
    assert r.status_code == 403
