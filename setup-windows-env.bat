@echo off
setlocal EnableDelayedExpansion

:: -------------------------------------------------------------
:: Check for Administrator privileges and self-elevate if needed
:: -------------------------------------------------------------
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================================
    echo   Requesting Administrator privileges...
    echo   Please click "YES" on the Windows prompt.
    echo ========================================================
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

title College Fee Management - Windows Environment & Network Setup

echo ========================================================
echo   College Fee Management System - Windows Setup
echo ========================================================
echo.
echo This tool will:
echo   1. Configure your custom database & uploads storage folder.
echo   2. Set permanent Windows Environment Variables.
echo   3. Automatically open ports 5000 and 5173 in Windows Firewall
echo      so Wi-Fi devices connect without any manual commands.
echo.
echo ========================================================

:: Prompt user for custom data directory
set "DEFAULT_DIR=C:\CollegeData"
echo Enter the folder path where you want to store your database and uploads.
set /p "USER_DIR=Press ENTER to use default [%DEFAULT_DIR%]: "

if "%USER_DIR%"=="" (
    set "TARGET_DIR=%DEFAULT_DIR%"
) else (
    set "TARGET_DIR=%USER_DIR%"
)

:: Create directories
set "DB_FILE=%TARGET_DIR%\college.db"
set "UPLOADS_FOLDER=%TARGET_DIR%\uploads"

echo.
echo [*] Creating folders at: %TARGET_DIR% ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%UPLOADS_FOLDER%" mkdir "%UPLOADS_FOLDER%"
if not exist "%UPLOADS_FOLDER%\students" mkdir "%UPLOADS_FOLDER%\students"
if not exist "%UPLOADS_FOLDER%\qrcodes" mkdir "%UPLOADS_FOLDER%\qrcodes"

echo [*] Setting permanent Windows Environment Variables...
powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('DATABASE_PATH', '%DB_FILE%', 'User')"
powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('UPLOADS_DIR', '%UPLOADS_FOLDER%', 'User')"
powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('PORT', '5000', 'User')"
powershell -NoProfile -Command "[System.Environment]::SetEnvironmentVariable('HOST', '0.0.0.0', 'User')"

echo [*] Configuring Windows Defender Firewall for local Wi-Fi...
netsh advfirewall firewall delete rule name="College App Web (5173)" >nul 2>&1
netsh advfirewall firewall delete rule name="College App Server (5000)" >nul 2>&1
netsh advfirewall firewall add rule name="College App Web (5173)" dir=in action=allow protocol=TCP localport=5173 profile=any >nul
netsh advfirewall firewall add rule name="College App Server (5000)" dir=in action=allow protocol=TCP localport=5000 profile=any >nul

echo.
echo ========================================================
echo   SUCCESS! Everything is configured permanently!
echo ========================================================
echo   - Database Path:       %DB_FILE%
echo   - Uploads Directory:   %UPLOADS_FOLDER%
echo   - Server Port:         5000
echo   - Windows Firewall:    Unblocked on ports 5000 and 5173
echo ========================================================
echo.
echo You never need to run allow-wifi-firewall.bat again.
echo.
pause
