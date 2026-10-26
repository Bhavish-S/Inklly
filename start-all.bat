@echo off
cd /d "%~dp0"
echo ====================================================
echo  Launching Inklly Complete Ecosystem
echo ====================================================
echo  1. Starting Backend API Server (Port 4000)...
start "Inklly Server (Port 4000)" cmd /k npm.cmd run dev:server

timeout /t 2 /nobreak >nul

echo  2. Starting Desktop Edge Print Agent (Port 8765)...
start "Inklly Desktop Agent (Port 8765)" cmd /k npm.cmd run dev:agent

timeout /t 2 /nobreak >nul

echo  3. Starting Web Frontend App (Port 3000)...
start "Inklly Web App (Port 3000)" cmd /k npm.cmd run dev:web

echo ====================================================
echo  All services launched in separate windows!
echo  Open http://localhost:3000 in your browser.
echo ====================================================
pause
