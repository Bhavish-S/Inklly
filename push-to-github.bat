@echo off
cd /d "%~dp0"
echo ====================================================
echo   Pushing Inklly Codebase to GitHub
echo   Repository: https://github.com/Bhavish-S/Inklly.git
echo   Branch: main
echo ====================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Inklly successfully pushed to GitHub!
) else (
    echo [NOTICE] If prompted, sign in via your browser or provide a Personal Access Token.
)
echo.
pause
