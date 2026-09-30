"""Tests for student CRUD and QR code generation."""
import pytest
import io
from tests.conftest import auth


def test_create_student(client, admin_token, branch):
    r = client.post("/students/", json={
        "branch_id": branch.id,
        "name": "New Student",
        "roll_number": "999",
        "class_name": "3",
        "section": "B",
        "parent_phone": "03009999999",
    }, headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "New Student"
    assert data["roll_number"] == "999"
    assert data["qr_token"] is not None
    assert len(data["qr_token"]) == 36  # UUID


def test_create_duplicate_roll_same_class(client, admin_token, student, branch):
    r = client.post("/students/", json={
        "branch_id": branch.id,
        "name": "Duplicate", "roll_number": "001",
        "class_name": "5", "section": "A",
    }, headers=auth(admin_token))
    assert r.status_code == 400


def test_list_students(client, teacher_token, student):
    r = client.get("/students/", headers=auth(teacher_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    names = [s["name"] for s in r.json()]
    assert "Ali Khan" in names


def test_list_students_search(client, teacher_token, student):
    r = client.get("/students/?search=Ali", headers=auth(teacher_token))
    assert r.status_code == 200
    assert any(s["name"] == "Ali Khan" for s in r.json())


def test_get_student(client, teacher_token, student):
    r = client.get(f"/students/{student.id}", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["id"] == student.id


def test_get_student_not_found(client, teacher_token):
    r = client.get("/students/99999", headers=auth(teacher_token))
    assert r.status_code == 404


def test_update_student(client, admin_token, student):
    r = client.put(f"/students/{student.id}",
        json={"parent_phone": "03001234567"},
        headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["parent_phone"] == "03001234567"


def test_download_qr(client, teacher_token, student):
    r = client.get(f"/students/{student.id}/qr", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert len(r.content) > 100  # actual PNG bytes


def test_regenerate_qr(client, admin_token, student):
    old_token = student.qr_token
    r = client.post(f"/students/regenerate-qr/{student.id}", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["qr_token"] != old_token


def test_teacher_cannot_delete_student(client, teacher_token, student):
    r = client.delete(f"/students/{student.id}", headers=auth(teacher_token))
    assert r.status_code == 403


def test_admin_can_deactivate_student(client, admin_token, db, branch):
    from app.models.student import Student
    from app.services.qr import generate_qr_token
    s = Student(branch_id=branch.id, name="Temp", roll_number="TMP1",
                class_name="1", qr_token=generate_qr_token())
    db.add(s); db.commit(); db.refresh(s)

    r = client.delete(f"/students/{s.id}", headers=auth(admin_token))
    assert r.status_code == 200
    db.refresh(s)
    assert s.is_active is False


def test_bulk_import_excel(client, admin_token, branch):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["name", "roll_number", "class_name", "section", "parent_phone"])
    ws.append(["Bulk Student A", "B001", "6", "A", "0300111"])
    ws.append(["Bulk Student B", "B002", "6", "A", "0300222"])
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)

    r = client.post(
        f"/students/bulk-import/{branch.id}",
        files={"file": ("students.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == 2
    assert data["failed"] == 0
