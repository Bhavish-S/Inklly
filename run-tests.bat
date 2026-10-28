@echo off
cd /d "%~dp0"
echo ====================================================
echo  Running Inklly Full Automated Workspace Test Suite
echo ====================================================
npm.cmd run test
pause
