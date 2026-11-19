// Builds the downloadable "Inklly Print App" zip that shop owners install on
// the computer their printers are attached to.
//
//   node apps/agent/scripts/package.mjs
//
// Output: apps/web/public/downloads/inklly-print-app.zip (served by the website).
// Set INKLLY_PACKAGE_SERVER_URL to point the app at another API deployment.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const agentRoot = join(here, '..');
const repoRoot = join(agentRoot, '..', '..');
const serverUrl = process.env.INKLLY_PACKAGE_SERVER_URL || 'https://inklly.onrender.com/api/v1';
const version = JSON.parse((await import('node:fs')).readFileSync(join(agentRoot, 'package.json'), 'utf8')).version;

const staging = join(agentRoot, 'dist-package', 'Inklly Print App');
const outDir = join(repoRoot, 'apps', 'web', 'public', 'downloads');
const zipPath = join(outDir, 'inklly-print-app.zip');

rmSync(join(agentRoot, 'dist-package'), { recursive: true, force: true });
mkdirSync(join(staging, 'bin'), { recursive: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(agentRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: join(staging, 'inklly-print-app.cjs'),
  banner: { js: `// Inklly Print App ${version} — connects this computer's printers to your Inklly shop.` },
  logLevel: 'warning',
});

copyFileSync(join(agentRoot, 'bin', 'SumatraPDF.exe'), join(staging, 'bin', 'SumatraPDF.exe'));

const crlf = (text) => text.replace(/\r?\n/g, '\r\n');

writeFileSync(join(staging, 'Start Inklly (Windows).bat'), crlf(`@echo off
title Inklly Print App
cd /d "%~dp0"
echo.
echo   Inklly Print App ${version}
echo   ------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto installnode
node -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 goto updatenode
goto run

:installnode
echo   Inklly needs Node.js (free, from nodejs.org). Installing it now...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto manualnode
echo.
echo   Node.js is installed. Close this window and double-click
echo   "Start Inklly (Windows)" again.
pause
exit /b 0

:updatenode
echo   Your Node.js is too old for Inklly. Updating it now...
winget upgrade -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto manualnode
echo.
echo   Node.js is updated. Close this window and double-click
echo   "Start Inklly (Windows)" again.
pause
exit /b 0

:manualnode
echo.
echo   Could not install Node.js automatically.
echo   Download "Node.js LTS" for Windows from https://nodejs.org, install it,
echo   then double-click "Start Inklly (Windows)" again.
start https://nodejs.org/en/download
pause
exit /b 1

:run
set INKLLY_ENABLE_PHYSICAL_PRINTING=true
set INKLLY_SERVER_URL=${serverUrl}
node inklly-print-app.cjs
echo.
echo   Inklly Print App stopped.
pause
`));

writeFileSync(join(staging, 'Start Inklly with Windows.bat'), crlf(`@echo off
rem Adds "Start Inklly (Windows)" to the Startup folder so it opens when you sign in.
cd /d "%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\\Inklly Print App.lnk'); $s.TargetPath='%~dp0Start Inklly (Windows).bat'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo Inklly will now start automatically when you sign in to Windows.
pause
`));

const unixStart = (platformHint) => `#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  Inklly Print App ${version}"
echo "  ------------------------------------------------"
if ! command -v node >/dev/null 2>&1 || ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "  Inklly needs a recent Node.js (free)."
  ${platformHint}
  read -r -p "  Press Enter to close." _
  exit 1
fi
export INKLLY_ENABLE_PHYSICAL_PRINTING=true
export INKLLY_SERVER_URL=${serverUrl}
node inklly-print-app.cjs
`;
writeFileSync(join(staging, 'Start Inklly (Mac).command'), unixStart(`if command -v brew >/dev/null 2>&1; then
    echo "  Installing it with Homebrew..."; brew install node && exec "$0"
  fi
  echo "  Download the macOS installer for Node.js LTS from https://nodejs.org, install it, then open this file again."
  open "https://nodejs.org/en/download"`));
writeFileSync(join(staging, 'start-inklly-linux.sh'), unixStart(`echo "  Install Node.js 22 or newer (for example: sudo apt install nodejs, or from https://nodejs.org), then run this again."`));
chmodSync(join(staging, 'Start Inklly (Mac).command'), 0o755);
chmodSync(join(staging, 'start-inklly-linux.sh'), 0o755);

writeFileSync(join(staging, 'README.txt'), crlf(`Inklly Print App ${version}
=====================================

Install this on the computer your printers are connected to. It sends orders
from your Inklly Counter to the printer you choose — only when staff press Print.

BEFORE YOU START
  * Install your printer(s) on this computer as usual and print a test page.
  * Unzip this folder somewhere you can write to, e.g. Documents\\Inklly Print App.

WINDOWS
  1. Double-click "Start Inklly (Windows).bat".
     The first time, it installs Node.js (free) if needed — then run it again.
  2. In your Inklly dashboard open Business Setup > Printers and click
     "Create pairing code". Type or paste the code into the Inklly window.
  3. Keep the window open (you can minimise it). Your printers now appear in
     Inklly with their colour / double-sided / paper sizes.
  Optional: double-click "Start Inklly with Windows.bat" so it opens at sign-in.

MAC
  1. Right-click "Start Inklly (Mac).command" > Open (the first time macOS asks
     you to confirm). Install Node.js from nodejs.org if asked, then open it again.
  2. Enter the pairing code from Business Setup > Printers.

LINUX
  Run ./start-inklly-linux.sh in a terminal and enter the pairing code.

TROUBLESHOOTING
  * "No printers found": install the printer on this computer, then restart.
  * Printer shows offline in Inklly: check it is switched on and has paper.
  * To connect to a different shop, delete the "data" folder and start again.

Printing on Windows uses SumatraPDF 3.4.6 (bin\\SumatraPDF.exe), free software
under the GNU GPL v3 — source: https://github.com/sumatrapdfreader/sumatrapdf
`));

if (existsSync(zipPath)) rmSync(zipPath);
execFileSync('zip', ['-r', '-q', '-X', zipPath, 'Inklly Print App'], { cwd: join(agentRoot, 'dist-package') });
console.log(`Packaged ${zipPath} (server ${serverUrl})`);
