@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  TechBench Windows Build Script
REM  Builds the Tauri application and optional NSIS installer
REM ============================================================

echo.
echo  ====================================
echo   TechBench Windows Build Script
echo  ====================================
echo.

REM --- Check prerequisites ---
echo [1/8] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    exit /b 1
)
echo   [OK] Node.js: & node --version

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found.
    exit /b 1
)
echo   [OK] npm: & npm --version

where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Rust/Cargo not found. Install from https://rustup.rs
    exit /b 1
)
echo   [OK] Rust: & cargo --version

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Python not found. Some features may not work.
) else (
    echo   [OK] Python: & python --version
)

REM --- Install GUI dependencies ---
echo.
echo [2/8] Installing GUI dependencies...
cd /d "%~dp0gui"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    exit /b 1
)

REM --- Typecheck ---
echo.
echo [3/8] Running TypeScript typecheck...
call npm run typecheck
if %errorlevel% neq 0 (
    echo WARNING: Typecheck failed, continuing anyway...
)

REM --- Run tests ---
echo.
echo [4/8] Running tests...
call npx vitest run 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Some tests failed, continuing anyway...
)

REM --- Build frontend ---
echo.
echo [5/8] Building frontend assets...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed
    exit /b 1
)

REM --- Build Rust HAL ---
echo.
echo [6/8] Building Rust HAL...
cd /d "%~dp0hal"
cargo build --release 2>nul
if %errorlevel% neq 0 (
    echo WARNING: HAL build failed (optional, skipping)
) else (
    echo   [OK] HAL built successfully
)

REM --- Build Tauri application ---
echo.
echo [7/8] Building Tauri application...
cd /d "%~dp0gui"
call npx tauri build --bundles nsis
if %errorlevel% neq 0 (
    echo ERROR: Tauri build failed
    echo.
    echo Make sure you have the Windows SDK and WebView2 installed.
    echo See: https://v2.tauri.app/start/prerequisites/
    exit /b 1
)

REM --- Copy installer ---
echo.
echo [8/8] Copying output files...
if not exist "%~dp0dist" mkdir "%~dp0dist"
copy "src-tauri\target\release\bundle\nsis\*.exe" "%~dp0dist\" >nul 2>&1
copy "src-tauri\target\release\bundle\msi\*.msi" "%~dp0dist\" >nul 2>&1
copy "src-tauri\target\release\techbench.exe" "%~dp0dist\" >nul 2>&1

echo.
echo  ====================================
echo   Build Complete!
echo  ====================================
echo.
echo  Output files:
dir /b "%~dp0dist\*.exe" 2>nul
dir /b "%~dp0dist\*.msi" 2>nul
echo.
echo  Install with:
echo    dist\TechBench-Setup-0.1.0.exe
echo.
echo  Or run directly:
echo    dist\techbench.exe
echo.

endlocal
