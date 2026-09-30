from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import os
import logging

from app.config import settings
from app.database import engine, Base
from app.routers import auth, schools, users, students, attendance, notifications, reports, admin

logging.basicConfig(level=logging.INFO)

# Create all tables on startup
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Skip scheduler in test environment
    if os.environ.get("TESTING") == "1":
        yield
        return
    from app.scheduler import start_scheduler
    scheduler = start_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="QR Code Attendance System for Schools",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(schools.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(attendance.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve the gate scanner HTML page
SCANNER_DIR   = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "scanner")
DASHBOARD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "dashboard")

@app.get("/scanner", response_class=FileResponse)
def scanner_page():
    return FileResponse(os.path.join(SCANNER_DIR, "index.html"))

@app.get("/dashboard", response_class=FileResponse)
def dashboard_page():
    return FileResponse(os.path.join(DASHBOARD_DIR, "index.html"))

@app.get("/launcher", response_class=FileResponse)
def launcher_page():
    return FileResponse(os.path.join(DASHBOARD_DIR, "launcher.html"))

# Serve the built React app (after npm run build)
REACT_BUILD = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "backend", "static_frontend")
if os.path.isdir(REACT_BUILD):
    app.mount("/app", StaticFiles(directory=REACT_BUILD, html=True), name="react")

    @app.get("/app/{full_path:path}", response_class=HTMLResponse)
    def react_catch_all(full_path: str):
        index = os.path.join(REACT_BUILD, "index.html")
        return FileResponse(index)
