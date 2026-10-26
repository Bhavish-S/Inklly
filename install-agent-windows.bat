@echo off
chcp 65001 >nul
title Inklly Edge Print Agent - Windows Installation & Diagnostic Tool
cls
echo ==============================================================================
echo       ██╗███╗   ██╗██╗  ██╗██╗     ██╗  ██╗   ██╗
echo       ██║████╗  ██║██║ ██╔╝██║     ██║  ╚██╗ ██╔╝
echo       ██║██╔██╗ ██║█████═╝ ██║     ██║   ╚████╔╝ 
echo       ██║██║╚██╗██║██╔═██╗ ██║     ██║    ╚██╔╝  
echo       ██║██║ ╚████║██║  ██╗███████╗███████╗██║   
echo       ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝   
echo        Inklly Desktop Edge Print Agent — Windows Spooler Connector
echo ==============================================================================
echo.
echo [1/5] Verifying Windows Print Spooler (winspool.drv)...
powershell -NoProfile -Command "Get-Service -Name Spooler | Select-Object Status, DisplayName, StartType"
if %errorlevel% neq 0 (
    echo [ERROR] Windows Print Spooler is not running. Please start the Spooler service.
    pause
    exit /b 1
)
echo.

echo [2/5] Enumerating Windows Installed Printers (Hardware Discovery)...
powershell -NoProfile -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table -AutoSize"
echo.

echo [3/5] Checking Loopback Diagnostics Port 8765...
netstat -ano | findstr :8765 >nul
if %errorlevel% equ 0 (
    echo [OK] Loopback port 8765 is already bound or active.
) else (
    echo [INFO] Port 8765 is free and ready for Inklly Agent daemon.
)
echo.

echo [4/5] Checking Node.js Runtime...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js not found in current PATH.
    echo Inklly Edge Agent requires Node.js 20+ LTS.
    echo Please install Node.js from https://nodejs.org or run inside the Inklly bundle.
) else (
    node -e "console.log('Detected Node.js ' + process.version);"
)
echo.

echo [5/5] Launching Inklly Edge Print Agent (Port 8765)...
echo Shop Code: campus1
echo Pairing Status: Auto-Handshake Enabled
echo Offline Cache: Local SQLite SSD queue (agent_queue.db)
echo Hardware Invariant: OUTPUT_UNCERTAIN on Paper Jam
echo ==============================================================================
echo Press Ctrl+C at any time to stop the daemon.
echo.

cd /d "%~dp0\apps\agent"
if exist "dist\index.js" (
    node dist\index.js
) else (
    npm start
)

pause
