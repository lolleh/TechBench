@echo off
title TechBench
cd /d "%~dp0"
echo.
echo   TechBench starting...
echo   Browser will open automatically.
echo.
python server.py
pause
