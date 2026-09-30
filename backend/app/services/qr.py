import qrcode
import uuid
import io
import os
import zipfile
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, List


CARD_W = 400
CARD_H = 560
BANNER_H = 80
FOOTER_H = 50
BRAND_COLOR = (31, 78, 121)   # #1F4E79
ACCENT_COLOR = (255, 140, 0)  # orange
WHITE = (255, 255, 255)
DARK  = (30, 30, 30)
GRAY  = (120, 120, 120)


def _font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()


def generate_qr_token() -> str:
    return str(uuid.uuid4())


def generate_qr_card(
    token: str,
    student_name: str,
    roll_number: str,
    class_name: str,
    section: Optional[str] = None,
    parent_name: Optional[str] = None,
    school_name: str = "School Attendance System",
) -> bytes:
    card = Image.new("RGB", (CARD_W, CARD_H), WHITE)
    draw = ImageDraw.Draw(card)

    # ── top banner ──────────────────────────────────────────────────────────
    draw.rectangle([0, 0, CARD_W, BANNER_H], fill=BRAND_COLOR)
    # school name
    f_school = _font(15)
    draw.text((CARD_W // 2, 22), school_name, font=f_school, fill=WHITE, anchor="mm")
    # sub-label
    f_sub = _font(11)
    draw.text((CARD_W // 2, 44), "STUDENT IDENTITY CARD", font=f_sub, fill=ACCENT_COLOR, anchor="mm")
    draw.text((CARD_W // 2, 62), "QR Attendance System", font=_font(10), fill=(180, 200, 220), anchor="mm")

    # ── orange accent line ───────────────────────────────────────────────────
    draw.rectangle([0, BANNER_H, CARD_W, BANNER_H + 4], fill=ACCENT_COLOR)

    # ── QR code ─────────────────────────────────────────────────────────────
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=2,
    )
    qr.add_data(token)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    qr_size = 200
    qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)
    qr_x = (CARD_W - qr_size) // 2
    qr_y = BANNER_H + 20
    card.paste(qr_img, (qr_x, qr_y))

    # QR border
    draw.rectangle(
        [qr_x - 2, qr_y - 2, qr_x + qr_size + 2, qr_y + qr_size + 2],
        outline=BRAND_COLOR, width=2,
    )

    # ── student info ─────────────────────────────────────────────────────────
    info_y = qr_y + qr_size + 16
    draw.rectangle([20, info_y, CARD_W - 20, info_y + 1], fill=(230, 230, 230))
    info_y += 10

    def info_row(label: str, value: str, y: int) -> int:
        draw.text((30, y), label, font=_font(10), fill=GRAY)
        draw.text((30, y + 14), value or "—", font=_font(13), fill=DARK)
        return y + 38

    class_display = class_name + (f" — {section}" if section else "")
    info_y = info_row("STUDENT NAME", student_name.upper(), info_y)
    info_y = info_row("ROLL NUMBER", roll_number, info_y)
    info_y = info_row("CLASS / SECTION", class_display, info_y)
    if parent_name:
        info_y = info_row("PARENT / GUARDIAN", parent_name, info_y)

    # ── footer ───────────────────────────────────────────────────────────────
    footer_y = CARD_H - FOOTER_H
    draw.rectangle([0, footer_y, CARD_W, CARD_H], fill=BRAND_COLOR)
    draw.text(
        (CARD_W // 2, footer_y + FOOTER_H // 2),
        "Scan QR code at entrance for attendance",
        font=_font(10), fill=(180, 200, 220), anchor="mm",
    )

    # ── card border ──────────────────────────────────────────────────────────
    draw.rectangle([0, 0, CARD_W - 1, CARD_H - 1], outline=BRAND_COLOR, width=3)

    buf = io.BytesIO()
    card.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


# kept for backward compat — routers still call this
def generate_qr_image(token: str, student_name: str, roll_number: str) -> bytes:
    return generate_qr_card(token, student_name, roll_number, class_name="")


def save_qr_locally(
    token: str,
    student_name: str,
    roll_number: str,
    class_name: str = "",
    section: Optional[str] = None,
    save_dir: str = "qr_codes",
) -> str:
    os.makedirs(save_dir, exist_ok=True)
    image_bytes = generate_qr_card(token, student_name, roll_number, class_name, section)
    filename = f"{token}.png"
    filepath = os.path.join(save_dir, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return filepath


def generate_bulk_zip(students: List[dict]) -> bytes:
    """
    students: list of dicts with keys token, name, roll_number, class_name, section, parent_name
    Returns ZIP bytes containing one PNG per student.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for s in students:
            card_bytes = generate_qr_card(
                token=s["token"],
                student_name=s["name"],
                roll_number=s["roll_number"],
                class_name=s.get("class_name", ""),
                section=s.get("section"),
                parent_name=s.get("parent_name"),
            )
            safe_name = s["roll_number"].replace("/", "_").replace("\\", "_")
            zf.writestr(f"{safe_name}_{s['name']}.png", card_bytes)
    buf.seek(0)
    return buf.read()
