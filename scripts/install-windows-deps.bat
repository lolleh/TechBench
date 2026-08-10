@echo off
REM ============================================================
REM  TechBench - Windows Dependency Installer
REM  Installs required tools for mobile device servicing
REM ============================================================

echo.
echo  ====================================
echo   TechBench - Installing Dependencies
echo  ====================================
echo.

REM --- Check for admin privileges ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Running without admin privileges. Some installs may fail.
    echo Right-click and "Run as administrator" for full installation.
    echo.
)

REM --- Python ---
echo [1/6] Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   Python not found. Please install Python 3.10+ from:
    echo   https://www.python.org/downloads/
    echo   IMPORTANT: Check "Add Python to PATH" during installation!
    pause
    exit /b 1
)
echo   [OK] Python found

REM --- Python packages ---
echo.
echo [2/6] Installing Python packages...
python -m pip install --upgrade pip
python -m pip install pyudev pyusb pyserial pillow onnxruntime
echo   [OK] Python packages installed

REM --- Docker Desktop ---
echo.
echo [3/6] Checking Docker Desktop...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo   Docker Desktop not found.
    echo   Download from: https://www.docker.com/products/docker-desktop/
    echo   After installing, restart this script.
) else (
    echo   [OK] Docker found: & docker --version
)

REM --- Android SDK Platform Tools ---
echo.
echo [4/6] Installing Android SDK Platform Tools...
where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo   Downloading Android SDK Platform Tools...
    powershell -Command ^
        "$url = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';" ^
        "$zip = '$env:TEMP\platform-tools.zip';" ^
        "$dest = '$env:LOCALAPPDATA\Android\Sdk\platform-tools';" ^
        "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
        "Expand-Archive -Path $zip -DestinationPath '$env:LOCALAPPDATA\Android\Sdk' -Force;" ^
        "Remove-Item $zip"
    echo   Added to PATH: %LOCALAPPDATA%\Android\Sdk\platform-tools
    setx PATH "%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"
) else (
    echo   [OK] adb found: & adb version
)

REM --- Fastboot ---
echo.
echo [5/6] Checking fastboot...
where fastboot >nul 2>&1
if %errorlevel% neq 0 (
    echo   fastboot not found (usually bundled with Android SDK Platform Tools)
    echo   If adb was just installed, restart your terminal and run this again.
) else (
    echo   [OK] fastboot found
)

REM --- WinUSB / Zadig ---
echo.
echo [6/6] USB Driver Setup...
echo.
echo   For USB device access, you may need WinUSB drivers.
echo   Download Zadig from: https://zadig.akeo.ie/
echo.
echo   Recommended drivers to install via Zadig:
echo     - Qualcomm HS-USB QDLoader 9008 (VID:05C6 PID:9008)
echo     - MediaTek USB VCOM (VID:0E8D PID:0003)
echo     - Samsung Galaxy MTP / ADB (VID:04E8 PID:6860)
echo     - Apple DFU (VID:05AC PID:1227)
echo     - Android ADB Interface (VID:18D1)
echo     - FTDI FT2232H (for JTAG/SWD/I2C/SPI)
echo     - ST-Link V2 (for ARM debugging)
echo     - CP210x / CH340 / FT232R (for UART serial)
echo.

echo  ====================================
echo   Dependency Installation Complete!
echo  ====================================
echo.
echo  Next steps:
echo    1. Restart your terminal
echo    2. Run: techbench
echo    3. Connect a device via USB
echo.
pause
