@echo off
cd /d "%~dp0"
echo ====================================================
echo  Starting Inklly Frontend Web App on Port 3000
echo ====================================================
npm.cmd run dev:web
pause
