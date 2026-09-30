"""Tests for Super Admin endpoints."""
from tests.conftest import auth
from datetime import date


def test_system_stats(client, admin_token, school, branch, student):
    r = client.get("/admin/stats", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "total_schools" in data
    assert "total_students" in data
    assert data["total_schools"] >= 1
    assert data["total_students"] >= 1


def test_schools_overview(client, admin_token, school, branch, student):
    r = client.get("/admin/schools/overview", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(s["name"] == "Test School" for s in data)
    test_school = next(s for s in data if s["name"] == "Test School")
    assert test_school["branch_count"] >= 1
    assert test_school["student_count"] >= 1


def test_cross_branch(client, admin_token, school, branch, student):
    r = client.get(f"/admin/cross-branch?school_id={school.id}", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["school_id"] == school.id
    assert isinstance(data["branches"], list)
    assert any(b["branch_name"] == "Main Branch" for b in data["branches"])


def test_weekly_trend(client, admin_token, branch):
    r = client.get(f"/admin/trend/weekly?branch_id={branch.id}", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "labels" in data
    assert "pcts" in data
    assert len(data["labels"]) == 7
    assert all(0 <= p <= 100 for p in data["pcts"])


def test_monthly_trend(client, admin_token, branch):
    r = client.get(f"/admin/trend/monthly?branch_id={branch.id}", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert len(data["labels"]) == 6
    assert all(0 <= p <= 100 for p in data["pcts"])


def test_list_users(client, admin_token, super_admin, teacher):
    r = client.get("/admin/users", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(u["email"] == "admin@test.com" for u in data)


def test_non_super_admin_blocked_from_stats(client, teacher_token):
    r = client.get("/admin/stats", headers=auth(teacher_token))
    assert r.status_code == 403


def test_non_super_admin_blocked_from_schools_overview(client, teacher_token):
    r = client.get("/admin/schools/overview", headers=auth(teacher_token))
    assert r.status_code == 403


def test_school_crud(client, admin_token):
    # Create
    r = client.post("/schools/", json={"name": "New Academy", "phone": "0300777"},
                    headers=auth(admin_token))
    assert r.status_code == 200
    sid = r.json()["id"]

    # Read
    r = client.get(f"/schools/{sid}", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["name"] == "New Academy"

    # Update
    r = client.put(f"/schools/{sid}", json={"name": "New Academy Updated"},
                   headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["name"] == "New Academy Updated"


def test_branch_crud(client, admin_token, school):
    # Create
    r = client.post("/schools/branches/", json={
        "school_id": school.id, "name": "North Branch",
        "phone": "0300888", "timezone": "Asia/Karachi",
    }, headers=auth(admin_token))
    assert r.status_code == 200
    bid = r.json()["id"]

    # Update
    r = client.put(f"/schools/branches/{bid}", json={"name": "North Campus"},
                   headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["name"] == "North Campus"


def test_user_crud(client, admin_token, school, branch):
    # Create
    r = client.post("/users/", json={
        "name": "New Teacher", "email": "newt@test.com",
        "password": "Pass@123", "role": "teacher",
        "school_id": school.id, "branch_id": branch.id,
    }, headers=auth(admin_token))
    assert r.status_code == 200
    uid = r.json()["id"]

    # Update — deactivate
    r = client.put(f"/users/{uid}", json={"is_active": False}, headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["is_active"] is False
