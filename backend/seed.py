import os
os.environ["DATABASE_URL"] = "sqlite:///./qr_attendance.db"
os.environ["SECRET_KEY"]   = "change-this-secret-key-before-going-live-use-32-chars"

from datetime import time, datetime, date
from app.database import SessionLocal, engine, Base
from app.models.school import School
from app.models.branch import Branch
from app.models.student import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.services.qr import generate_qr_token

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# School
if db.query(School).count() == 0:
    s = School(name="Star Public School", phone="03001234567",
               email="info@star.edu.pk", address="Model Town, Lahore")
    db.add(s); db.commit(); db.refresh(s)
    print(f"School created: {s.name} (id={s.id})")
else:
    s = db.query(School).first()
    print(f"School exists: {s.name} (id={s.id})")

# Branch
if db.query(Branch).count() == 0:
    b = Branch(school_id=s.id, name="Main Campus", timezone="Asia/Karachi",
               school_start_time=time(8, 0), late_cutoff_time=time(8, 30))
    db.add(b); db.commit(); db.refresh(b)
    print(f"Branch created: {b.name} (id={b.id})")
else:
    b = db.query(Branch).first()
    print(f"Branch exists: {b.name} (id={b.id})")

# Students
students_data = [
    ("Ali Ahmed",     "001", "5", "A", "03001111111"),
    ("Sara Khan",     "002", "5", "A", "03002222222"),
    ("Usman Malik",   "003", "5", "A", "03003333333"),
    ("Fatima Sheikh", "004", "5", "B", "03004444444"),
    ("Hamza Raza",    "005", "5", "B", "03005555555"),
    ("Zara Butt",     "006", "6", "A", "03006666666"),
    ("Omar Qureshi",  "007", "6", "A", "03007777777"),
    ("Ayesha Noor",   "008", "6", "B", "03008888888"),
]

tokens = []
if db.query(Student).count() == 0:
    for name, roll, cls, sec, phone in students_data:
        tok = generate_qr_token()
        st = Student(branch_id=b.id, name=name, roll_number=roll,
                     class_name=cls, section=sec, parent_phone=phone, qr_token=tok)
        db.add(st); db.commit(); db.refresh(st)
        tokens.append(tok)
        print(f"  Student: {name}")
else:
    tokens = [st.qr_token for st in db.query(Student).order_by(Student.id).all()]
    print(f"Students exist ({len(tokens)})")

# Attendance for today
today = date.today()
existing = db.query(AttendanceRecord).filter(AttendanceRecord.date == today).count()
if existing == 0:
    for i, tok in enumerate(tokens[:6]):
        st = db.query(Student).filter(Student.qr_token == tok).first()
        status = AttendanceStatus.late if i == 5 else AttendanceStatus.present
        rec = AttendanceRecord(
            student_id=st.id, branch_id=b.id, date=today,
            check_in_time=datetime.now(), status=status, is_manual=False,
        )
        db.add(rec)
    db.commit()
    print("Attendance: 5 present, 1 late, 2 absent for today")
else:
    print(f"Attendance already exists ({existing} records)")

db.close()
print("\nAll done! Branch ID =", b.id)
