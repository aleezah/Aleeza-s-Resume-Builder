@echo off
setlocal enabledelayedexpansion
title Job Application Tool — Setup
color 0A

echo ================================================
echo   Job Application Tool — First-Time Setup
echo ================================================
echo.
echo   NOTE: This setup requires approximately 300-400 MB
echo   of free disk space. Make sure you have enough room
echo   before continuing.
echo.
pause

:: ── Step 1: Ensure Node.js is installed ──────────────────────────────────────

where node >nul 2>&1
if %errorlevel% equ 0 goto node_found

echo [!] Node.js is not installed. Installing now...
echo     This may take a few minutes. Please wait.
echo.

:: Try winget (built into Windows 10 1709+ and all Windows 11)
where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo     Using Windows Package Manager to install Node.js...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    if !errorlevel! equ 0 (
        echo     [OK] Node.js installed via winget.
        goto refresh_path
    )
    echo     winget install did not complete, trying alternative...
)

:: Fallback: download and run the official Node.js installer
echo     Downloading Node.js installer from nodejs.org...
set NODE_INSTALLER=%TEMP%\node-installer.msi
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile '%NODE_INSTALLER%' -UseBasicParsing; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Could not download Node.js automatically.
    echo.
    echo   Please install it manually:
    echo   1. Open this website: https://nodejs.org
    echo   2. Click "Download Node.js (LTS)"
    echo   3. Run the downloaded file and click Next through all steps
    echo   4. Run this setup file again when done
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

echo     Running Node.js installer (follow the prompts)...
msiexec /i "%NODE_INSTALLER%" /qb ADDLOCAL=ALL
if %errorlevel% neq 0 (
    echo     Trying with full installer window...
    msiexec /i "%NODE_INSTALLER%"
)
del /q "%NODE_INSTALLER%" >nul 2>&1

:refresh_path
:: Refresh PATH from registry so node is available in this session
for /f "delims=" %%i in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\") + \";\" + [System.Environment]::GetEnvironmentVariable(\"PATH\",\"User\")"') do set "PATH=%%i"

:: Final check
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js installed but not detected yet.
    echo     Please close this window and run the installer again.
    echo     (Windows sometimes needs a restart to recognise new programs.)
    echo.
    pause
    exit /b 1
)

:node_found
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER% found.
echo.

:: ── Step 2: Install dependencies ─────────────────────────────────────────────

echo [1/2] Installing app components (this may take a minute)...
echo       Please wait — do not close this window.
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation failed. See the error above.
    pause
    exit /b 1
)
call npm install --prefix client
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation failed. See the error above.
    pause
    exit /b 1
)
echo.
echo [OK] App components installed.
echo.

:: ── Step 3: Create desktop shortcut ──────────────────────────────────────────

echo [2/2] Creating desktop shortcut...
set "SCRIPT_DIR=%~dp0"
set "SHORTCUT=%USERPROFILE%\Desktop\Job Application Tool.lnk"
set "ICON_PATH=%SCRIPT_DIR%icon.ico"

powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%'); $s.TargetPath='%SCRIPT_DIR%start.bat'; $s.WorkingDirectory='%SCRIPT_DIR%'; $s.WindowStyle=1; if (Test-Path '%ICON_PATH%') { $s.IconLocation='%ICON_PATH%' }; $s.Description='Launch Job Application Tool'; $s.Save()"

if exist "%SHORTCUT%" (
    echo [OK] Shortcut created on your Desktop.
) else (
    echo [!] Could not create shortcut — you can launch the app by running start.bat directly.
)
echo.

echo ================================================
echo   Setup complete!
echo.
echo   Double-click "Job Application Tool" on your
echo   Desktop to open the app anytime.
echo ================================================
echo.
pause
