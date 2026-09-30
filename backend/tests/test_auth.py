"""Tests for authentication endpoints."""
from tests.conftest import auth


def test_login_success(client, super_admin):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "Admin@123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "admin@test.com"
    assert data["user"]["role"] == "super_admin"


def test_login_wrong_password(client, super_admin):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@test.com", "password": "x"})
    assert r.status_code == 401


def test_get_me(client, admin_token):
    r = client.get("/auth/me", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["role"] == "super_admin"


def test_get_me_no_token(client):
    r = client.get("/auth/me")
    assert r.status_code in (401, 403)  # FastAPI version-dependent


def test_get_me_bad_token(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert r.status_code == 401


def test_refresh_token(client, super_admin):
    login = client.post("/auth/login", json={"email": "admin@test.com", "password": "Admin@123"})
    refresh_token = login.json()["refresh_token"]
    r = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_refresh_with_access_token_fails(client, admin_token):
    r = client.post("/auth/refresh", json={"refresh_token": admin_token})
    assert r.status_code == 401
