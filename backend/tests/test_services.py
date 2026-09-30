"""Unit tests for core service functions (no HTTP layer)."""
import pytest
from datetime import datetime, time, date
from unittest.mock import MagicMock, patch


# ── QR service ────────────────────────────────────────────────────────────────

def test_generate_qr_token_is_uuid():
    from app.services.qr import generate_qr_token
    token = generate_qr_token()
    assert len(token) == 36
    assert token.count("-") == 4


def test_generate_qr_tokens_are_unique():
    from app.services.qr import generate_qr_token
    tokens = {generate_qr_token() for _ in range(100)}
    assert len(tokens) == 100


def test_generate_qr_image_returns_png():
    from app.services.qr import generate_qr_image
    data = generate_qr_image("test-token-123", "Ali Khan", "001")
    assert isinstance(data, bytes)
    assert data[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic bytes


def test_qr_image_has_student_info():
    from app.services.qr import generate_qr_image
    data = generate_qr_image("abc-token", "Zain Ahmed", "042")
    assert len(data) > 500  # non-trivial image


# ── Security utils ────────────────────────────────────────────────────────────

def test_hash_and_verify_password():
    from app.utils.security import hash_password, verify_password
    hashed = hash_password("MySecret@123")
    assert verify_password("MySecret@123", hashed) is True
    assert verify_password("wrongpass",    hashed) is False


def test_create_and_decode_access_token():
    from app.utils.security import create_access_token, decode_token
    token = create_access_token({"sub": "42", "role": "teacher"})
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    from app.utils.security import create_refresh_token, decode_token
    token = create_refresh_token({"sub": "7"})
    payload = decode_token(token)
    assert payload["sub"] == "7"
    assert payload["type"] == "refresh"


def test_expired_token_raises():
    from datetime import timedelta
    from jose import JWTError
    from app.utils.security import create_access_token, decode_token
    token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(JWTError):
        decode_token(token)


# ── Attendance service ────────────────────────────────────────────────────────

def test_resolve_status_on_time():
    from app.services.attendance import resolve_status
    from app.models.attendance import AttendanceStatus

    branch = MagicMock()
    branch.late_cutoff_time = time(8, 30)
    check_in = datetime(2024, 9, 1, 8, 0)   # 08:00 — before cutoff
    assert resolve_status(branch, check_in) == AttendanceStatus.present


def test_resolve_status_late():
    from app.services.attendance import resolve_status
    from app.models.attendance import AttendanceStatus

    branch = MagicMock()
    branch.late_cutoff_time = time(8, 30)
    check_in = datetime(2024, 9, 1, 9, 15)  # 09:15 — after cutoff
    assert resolve_status(branch, check_in) == AttendanceStatus.late


def test_resolve_status_no_cutoff_always_present():
    from app.services.attendance import resolve_status
    from app.models.attendance import AttendanceStatus

    branch = MagicMock()
    branch.late_cutoff_time = None
    assert resolve_status(branch, datetime(2024, 9, 1, 11, 0)) == AttendanceStatus.present


# ── WhatsApp message templates ────────────────────────────────────────────────

def test_arrival_message_contains_name_and_school():
    from app.services.whatsapp import build_arrival_message
    msg = build_arrival_message("Ali", "Star School", datetime(2024, 9, 1, 8, 15))
    assert "Ali" in msg
    assert "Star School" in msg
    assert "08:15 AM" in msg


def test_late_message_contains_late_keyword():
    from app.services.whatsapp import build_late_message
    msg = build_late_message("Zain", "Model School", datetime(2024, 9, 1, 9, 30))
    assert "late" in msg.lower()
    assert "Zain" in msg


def test_absent_message_not_arrived():
    from app.services.whatsapp import build_absent_message
    msg = build_absent_message("Sara", "City School")
    assert "Sara" in msg
    assert "NOT" in msg or "not" in msg.lower()


def test_normalize_phone_with_leading_zero():
    from app.services.whatsapp import _normalize_phone
    assert _normalize_phone("03001234567") == "whatsapp:+923001234567"


def test_normalize_phone_already_has_plus():
    from app.services.whatsapp import _normalize_phone
    assert _normalize_phone("+923001234567") == "whatsapp:+923001234567"


# ── Report service ────────────────────────────────────────────────────────────

def test_daily_excel_returns_bytes():
    from app.services.reports import daily_report_excel
    from datetime import date
    data = daily_report_excel(
        "Test School", "Main Branch", date.today(),
        [{"roll_number": "001", "student_name": "Ali", "class_name": "5",
          "section": "A", "status": "present", "check_in_time": None, "is_manual": False}],
        {"total": 1, "present": 1, "late": 0, "absent": 0, "pct": 100},
    )
    assert isinstance(data, bytes)
    assert data[:4] == b"PK\x03\x04"  # ZIP/XLSX magic bytes


def test_daily_pdf_returns_pdf():
    from app.services.reports import daily_report_pdf
    from datetime import date
    data = daily_report_pdf(
        "Test School", "Main Branch", date.today(), [], {"total": 0, "present": 0, "late": 0, "absent": 0, "pct": 0},
    )
    assert isinstance(data, bytes)
    assert data[:4] == b"%PDF"
