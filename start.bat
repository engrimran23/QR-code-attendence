@echo off
echo ========================================
echo  QR Attendance System — Local Start
echo ========================================

REM Start backend
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt --quiet
echo Starting backend on http://localhost:8000 ...
start "Backend" cmd /k "venv\Scripts\activate && python run.py"

REM Start frontend
cd ..\frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)
echo Starting frontend on http://localhost:3000 ...
start "Frontend" cmd /k "npm run dev"

echo.
echo Backend  : http://localhost:8000
echo Frontend : http://localhost:3000
echo API Docs : http://localhost:8000/docs
echo Scanner  : http://localhost:8000/scanner
echo.
pause
