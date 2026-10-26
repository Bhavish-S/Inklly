@echo off
cd /d "%~dp0"
echo ====================================================
echo  Starting Inklly Backend API Server on Port 4000
echo ====================================================
npm.cmd run dev:server
pause
