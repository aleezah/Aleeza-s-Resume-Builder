@echo off
setlocal enabledelayedexpansion
title Job Application Tool — Setup
color 0A

echo ================================================
echo   Job Application Tool — First-Time Setup
echo ================================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js is not installed.
    echo.
    echo     Opening the Node.js download page...
    echo     Please download and install the LTS version,
    echo     then run this installer again.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js found: %NODE_VER%
echo.

:: Install dependencies
echo [1/2] Installing dependencies (this may take a minute)...
call npm run install:all
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Dependency installation failed. Check the output above.
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed.
echo.

:: Create desktop shortcut
echo [2/2] Creating desktop shortcut...
set SCRIPT_DIR=%~dp0
set SHORTCUT=%USERPROFILE%\Desktop\Job Application Tool.lnk
powershell -NoProfile -Command ^
  "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath='%SCRIPT_DIR%start.bat';" ^
  "$s.WorkingDirectory='%SCRIPT_DIR%';" ^
  "$s.WindowStyle=1;" ^
  "$s.IconLocation='%SCRIPT_DIR%icon.ico';" ^
  "$s.Description='Launch Job Application Tool';" ^
  "$s.Save()"
echo [OK] Shortcut created on your Desktop.
echo.

echo ================================================
echo   Setup complete!
echo.
echo   Double-click "Job Application Tool" on your Desktop
echo   to launch the app anytime.
echo ================================================
echo.
pause
