@echo off
cd /d "%~dp0"
echo ====================================================
echo  Running Inklly Full Automated Test Suite (32 Tests)
echo ====================================================
npm.cmd run test
pause
