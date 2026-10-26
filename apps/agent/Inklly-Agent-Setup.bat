@echo off
chcp 65001 >nul
title Inklly Edge Print Agent Setup v1.0.0
cls
echo ==============================================================================
echo        Inklly Desktop Edge Print Agent — Windows Spooler Connector
echo ==============================================================================
echo.
echo [1/4] Checking Windows Print Spooler Service...
powershell -NoProfile -Command "Get-Service -Name Spooler | Select-Object Status, DisplayName"
if %errorlevel% neq 0 (
    echo [ERROR] Windows Print Spooler service not accessible.
    pause
    exit /b 1
)

echo.
echo [2/4] Detecting connected local and network printers...
powershell -NoProfile -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table -AutoSize"

echo.
echo [3/4] Configuring Inklly Pairing Credentials for Shop: campus1...
set INKLLY_SERVER=http://localhost:4000
set INKLLY_SHOP_ID=shop-campus-1
set INKLLY_SHOP_CODE=campus1
set INKLLY_SECRET_KEY=ink_live_sec_7f9a4e21a8c049b13d29
set INKLLY_PORT=8765

echo.
echo [4/4] Starting Inklly Local Loopback Spooler on port 8765...
echo Platform Resiliency Mode: Active
echo Offline SQLite Queue: Enabled (agent_queue.db)
echo Hardware Safety Invariant: OUTPUT_UNCERTAIN on Jam
echo.
echo Launching Inklly daemon...
if exist "dist\index.js" (
    node dist\index.js
) else (
    npm start
)

echo.
echo ==============================================================================
echo Inklly Edge Agent stopped.
echo ==============================================================================
pause
