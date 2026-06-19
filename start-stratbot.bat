@echo off
setlocal

title StratBot Launcher

echo ========================================
echo   StratBot Easy Launcher (P80F25)
echo   AI-assisted F1 Race Strategy Sim
echo ========================================
echo.
echo Using shared venv at: J:\FYP_Project\.venv
echo Repo root: %~dp0
echo.

:: Run with cmd /k "..." if it closes too fast.

set "VENV_PY=J:\FYP_Project\.venv\Scripts\python.exe"
set "VENV_PIP=J:\FYP_Project\.venv\Scripts\pip.exe"

cd /d "%~dp0"

echo [DEBUG] Dir: %CD%
echo [DEBUG] VENV_PY = %VENV_PY%

if not exist "%VENV_PY%" (
    echo ERROR: venv not found.
    pause
    exit /b 1
)

%VENV_PY% --version
if errorlevel 1 (
    echo ERROR: venv python not runnable.
    pause
    exit /b 1
)

echo [1/4] Checking backend...
if not exist "backend\requirements.txt" (
    echo ERROR: requirements.txt missing.
    pause
    exit /b 1
)
echo requirements.txt OK.

echo [2/4] Model check: assuming present (delete the .joblib in backend\data\models\ to force retrain on next run).
echo (Training step skipped for speed in this launcher.)

echo [3/4] Starting backend in new window...
start "StratBot Backend" cmd /k "cd /d %~dp0\backend\api && %VENV_PY% app.py"

timeout /t 3 >nul

echo [4/4] Starting frontend in new window...
if not exist "frontend\node_modules" (
    echo Installing node deps...
    cd frontend
    call npm install
    cd ..
)
start "StratBot Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo Launcher complete.
echo Backend: http://127.0.0.1:5000
echo Frontend: http://localhost:5173
echo.
echo Try the Model Variant and Compound options in the Setup screen.
echo Look for the ML comparison table after the race in Post-Race Summary.
echo.
echo Press key to close this window (other windows stay open)...
pause >nul
exit /b 0