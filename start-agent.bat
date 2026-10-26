@echo off
cd /d "%~dp0"
echo ====================================================
echo  Starting Inklly Desktop Edge Print Agent (Port 8765)
echo ====================================================
npm.cmd run dev:agent
pause
