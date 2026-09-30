@echo off
echo ========================================
echo  Running Test Suite
echo ========================================
cd backend
call venv\Scripts\activate
pytest tests\ -v --tb=short
pause
