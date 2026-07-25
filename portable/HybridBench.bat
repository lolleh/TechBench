@echo off
title TechBench - Electronics ^& Mobile Repair Platform
color 0A

echo.
echo   ====================================
echo    TechBench - Starting...
echo   ====================================
echo.

REM --- Check Python ---
python --version >nul 2>&1
if %errorlevel% neq 0 (
    python3 --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo   ERROR: Python 3 is required but not found.
        echo.
        echo   Install Python from: https://python.org/downloads/
        echo   IMPORTANT: Check "Add Python to PATH" during install!
        echo.
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

REM --- Check pyserial (optional) ---
%PYTHON% -c "import serial" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Installing pyserial...
    %PYTHON% -m pip install pyserial --quiet 2>nul
)

REM --- Start server ---
echo   Starting TechBench server...
echo.

cd /d "%~dp0"
%PYTHON% server.py

pause
