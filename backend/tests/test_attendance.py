"""Tests for attendance scanning, manual marking, dashboard, and offline sync."""
import pytest
from datetime import date, datetime, time, timedelta
from tests.conftest import auth


def test_scan_valid_qr(client, admin_token, student, branch):
    r = client.post("/attendance/scan", json={
        "qr_token": student.qr_token,
        "branch_id": branch.id,
    }, headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["student_name"] == "Ali Khan"
    assert data["already_scanned"] is False
    assert data["status"] in ("present", "late")


def test_scan_duplicate_same_day(client, admin_token, student, branch):
    # First scan may have already happened — either way second should flag duplicate
    client.post("/attendance/scan", json={
        "qr_token": student.qr_token, "branch_id": branch.id,
    }, headers=auth(admin_token))

    r = client.post("/attendance/scan", json={
        "qr_token": student.qr_token, "branch_id": branch.id,
    }, headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["already_scanned"] is True


def test_scan_invalid_qr(client, admin_token, branch):
    r = client.post("/attendance/scan", json={
        "qr_token": "00000000-0000-0000-0000-000000000000",
        "branch_id": branch.id,
    }, headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["success"] is False


def test_today_dashboard(client, teacher_token, branch, student):
    r = client.get(f"/attendance/dashboard/today?branch_id={branch.id}",
                   headers=auth(teacher_token))
    assert r.status_code == 200
    data = r.json()
    assert "total_students" in data
    assert "present" in data
    assert "absent" in data
    assert data["total_students"] >= 1


def test_class_summary(client, teacher_token, branch):
    r = client.get(f"/attendance/dashboard/classes?branch_id={branch.id}",
                   headers=auth(teacher_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_class_records(client, teacher_token, branch, student):
    r = client.get(
        f"/attendance/class-records?branch_id={branch.id}&class_name=5&section=A",
        headers=auth(teacher_token),
    )
    assert r.status_code == 200
    records = r.json()
    assert isinstance(records, list)
    assert any(rec["student_name"] == "Ali Khan" for rec in records)


def test_manual_mark(client, admin_token, db, branch, student):
    # Use a past date to avoid conflict with today's scan test
    past = (date.today() - timedelta(days=3)).isoformat()
    r = client.post("/attendance/manual", json={
        "student_id": student.id,
        "status": "absent",
        "date": past,
        "note": "Sick leave",
    }, headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "absent"
    assert data["is_manual"] is True
    assert data["note"] == "Sick leave"


def test_manual_mark_overrides_existing(client, admin_token, db, branch, student):
    past = (date.today() - timedelta(days=4)).isoformat()
    # Create present record
    client.post("/attendance/manual", json={
        "student_id": student.id, "status": "present", "date": past,
    }, headers=auth(admin_token))
    # Override to absent
    r = client.post("/attendance/manual", json={
        "student_id": student.id, "status": "absent", "date": past,
    }, headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["status"] == "absent"


def test_student_history(client, teacher_token, student):
    r = client.get(f"/attendance/student/{student.id}", headers=auth(teacher_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_offline_sync(client, admin_token, db, branch):
    from app.models.student import Student
    from app.services.qr import generate_qr_token

    # Create a fresh student for offline sync
    token = generate_qr_token()
    s = Student(branch_id=branch.id, name="Offline Kid", roll_number="OFF1",
                class_name="4", qr_token=token)
    db.add(s); db.commit(); db.refresh(s)

    yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
    r = client.post("/attendance/offline-sync", json={
        "branch_id": branch.id,
        "scans": [{"qr_token": token, "scanned_at": yesterday}],
    }, headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["processed"] == 1
    assert data["skipped"] == 0


def test_holiday_crud(client, admin_token, branch):
    holiday_date = (date.today() + timedelta(days=10)).isoformat()
    # Add
    r = client.post(
        f"/attendance/holidays?branch_id={branch.id}&holiday_date={holiday_date}&reason=Eid",
        headers=auth(admin_token),
    )
    assert r.status_code == 200

    # List
    r = client.get(f"/attendance/holidays?branch_id={branch.id}", headers=auth(admin_token))
    assert r.status_code == 200
    assert any(h["date"] == holiday_date for h in r.json())

    # Delete
    r = client.delete(
        f"/attendance/holidays?branch_id={branch.id}&holiday_date={holiday_date}",
        headers=auth(admin_token),
    )
    assert r.status_code == 200


def test_scan_on_holiday(client, admin_token, db, branch):
    from app.models.student import Student
    from app.models.attendance import Holiday
    from app.services.qr import generate_qr_token

    today = date.today()
    # Create holiday for today
    h = Holiday(branch_id=branch.id, date=today, reason="Test holiday")
    db.add(h); db.commit()

    token = generate_qr_token()
    s = Student(branch_id=branch.id, name="Holiday Kid", roll_number="HOL1",
                class_name="2", qr_token=token)
    db.add(s); db.commit(); db.refresh(s)

    r = client.post("/attendance/scan",
                    json={"qr_token": token, "branch_id": branch.id},
                    headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["success"] is False
    assert "holiday" in r.json()["message"].lower()

    # Cleanup
    db.delete(h); db.commit()
