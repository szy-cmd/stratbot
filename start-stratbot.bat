@echo off
setlocal enabledelayedexpansion

title StratBot Launcher

echo ========================================
echo   StratBot Easy Launcher (P80F25)
echo   AI-assisted F1 Race Strategy Sim
echo ========================================
echo.
echo Repo root: %~dp0
echo.

cd /d "%~dp0"

set "ENVFILE=backend\env.txt"
set "MSG_RESOLVING=[2/4] Resolving dataset location (STRATBOT_DATASET or %ENVFILE%)..."
set "MSG_USING=[INFO] Using dataset from '%ENVFILE%': "
set "MSG_NO=[INFO] No '%ENVFILE%' found or no STRATBOT_DATASET."
set "MSG_DEFAULT=        Will use default from config (may be J: path)."
set "MSG_DATA=        For your own data: copy '%ENVFILE%.example' to '%ENVFILE%'"
set "MSG_EDIT=        and edit STRATBOT_DATASET to point to your parquet file."
set "MSG_MODEL=(delete backend\data\models\lap_delta_model.joblib to force retrain on next manual run)"

:: =====================================================
:: PORTABLE VENV DETECTION (for sharing with friends)
:: =====================================================
:: 1. Try a venv next to the stratbot folder (..\.venv)
:: 2. Try venv inside stratbot (.\.venv) -- not usual
:: 3. Fall back to asking user or the old J: path (for original machine)

set "VENV_PY="
set "VENV_PIP="

:: Try sibling .venv (recommended for zip + own data)
if exist "..\.venv\Scripts\python.exe" (
    set "VENV_PY=..\.venv\Scripts\python.exe"
    set "VENV_PIP=..\.venv\Scripts\pip.exe"
    echo [INFO] Using sibling venv: ..\.venv
    goto :venv_found
)

:: Try local .venv inside stratbot (uncommon)
if exist ".venv\Scripts\python.exe" (
    set "VENV_PY=.venv\Scripts\python.exe"
    set "VENV_PIP=.venv\Scripts\pip.exe"
    echo [INFO] Using local venv: .\.venv
    goto :venv_found
)

:: Last resort: the original J: path (your machine only)
if exist "J:\FYP_Project\.venv\Scripts\python.exe" (
    set "VENV_PY=J:\FYP_Project\.venv\Scripts\python.exe"
    set "VENV_PIP=J:\FYP_Project\.venv\Scripts\pip.exe"
    echo [INFO] Using original J: venv (J:\FYP_Project\.venv)
    goto :venv_found
)

echo.
echo ERROR: Could not find a Python venv.
echo.
echo For a friend with his own data:
echo   1. Create a venv anywhere (recommended: next to this stratbot folder)
echo      Example in PowerShell / cmd:
echo        cd ..
echo        python -m venv .venv
echo        .\.venv\Scripts\pip.exe install -r stratbot\backend\requirements.txt
echo   2. Or point this bat manually by editing the paths below.
echo.
pause
exit /b 1

:venv_found
for %%i in ("%VENV_PY%") do set "VENV_PY=%%~fi"
for %%i in ("%VENV_PIP%") do set "VENV_PIP=%%~fi"
echo Using venv: %VENV_PY%
echo.

%VENV_PY% --version >nul 2>&1
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

:: =====================================================
:: DATASET PATH (supports your friend's own parquet location)
:: =====================================================
echo !MSG_RESOLVING!

set "DATASET_ENV="
for /f "tokens=1* delims==" %%a in ('findstr /b /i "STRATBOT_DATASET=" "%ENVFILE%" 2^>nul') do (
  set "DATASET_ENV=%%b"
  for /f "tokens=* delims= " %%t in ("!DATASET_ENV!") do set "DATASET_ENV=%%t"
)

if defined DATASET_ENV (
    set "STRATBOT_DATASET=%DATASET_ENV%"
    echo !MSG_USING! %STRATBOT_DATASET%
) else (
    echo !MSG_NO!
    echo !MSG_DEFAULT!
    echo.
    echo !MSG_DATA!
    echo !MSG_EDIT!
)

echo Model check: if the .joblib is missing you will need to retrain with your dataset.
echo !MSG_MODEL!

echo [3/4] Starting backend in new window...
if defined STRATBOT_DATASET (
    start "StratBot Backend" cmd /k ^"cd /d %~dp0\backend\api ^&^& set ^"STRATBOT_DATASET=%STRATBOT_DATASET%^" ^&^& %VENV_PY% app.py^"
) else (
    start "StratBot Backend" cmd /k "cd /d %~dp0\backend\api && %VENV_PY% app.py"
)

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
echo IMPORTANT FOR FRIENDS / OWN DATA:
echo   - Put your f1_model_ready_2018_2025.parquet anywhere.
echo   - Copy '%ENVFILE%.example' -^> '%ENVFILE%' and set STRATBOT_DATASET= full path to your .parquet
echo   - The model (.joblib) should be next to the parquet or retrain using the venv + your data.
echo.
echo Try the Model Variant and Compound options in the Setup screen.
echo Look for the ML comparison table and your custom car stats in Post-Race Summary.
echo.
echo Press key to close this window (other windows stay open)...
pause >nul
exit /b 0
