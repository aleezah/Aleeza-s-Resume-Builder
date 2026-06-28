@echo off
title Job Application Tool
color 0A

echo Starting Job Application Tool...
echo.

:: Start the server in the background
start /B cmd /C "npm run dev > nul 2>&1"

:: Wait for server to be ready then open browser
echo Waiting for app to start...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo App is running at http://localhost:5173
echo Close this window to stop the app.
echo.

:: Keep the server alive
npm run dev
