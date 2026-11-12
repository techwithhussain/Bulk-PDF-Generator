@echo off
title Local PDF Studio
color 0A
cls

cd /d "%~dp0"

echo ==========================================
echo   Local PDF Studio v1.0
echo ==========================================
echo.

:: Kill any old Electron instances
taskkill /F /IM electron.exe /T >nul 2>&1

:: Unset ELECTRON_RUN_AS_NODE (critical fix!)
set ELECTRON_RUN_AS_NODE=
set NODE_ENV=development
set VITE_DEV_SERVER_URL=http://localhost:5173

:: Check if Vite already running on 5173
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Vite server already running.
    goto launch_electron
)

:: Start Vite in background
echo [1/2] Starting Vite server...
start "Vite Server" /min cmd /c "set ELECTRON_RUN_AS_NODE= && cd /d "%~dp0" && npx vite --port 5173"

:: Wait for Vite to be ready
echo [2/2] Waiting for server...
:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto wait_loop
timeout /t 2 /nobreak >nul

:launch_electron
echo.
echo [OK] Launching app...
echo.
echo  TIP: Ctrl+Shift+I = DevTools
echo  TIP: Ctrl+S = Save
echo  TIP: Ctrl+H = Find and Replace
echo.
echo  Is window ko band na karein!
echo ==========================================

npx electron .

echo.
echo App band ho gaya. Enter press karein...
pause >nul
