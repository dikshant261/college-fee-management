@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo   College Fee Management - Automated Installer Builder
echo ========================================================
echo.

:: 0. Build Application Icon from PNG
echo [*] Step 0/5: Generating Application Icon from assets\clg-icon.png...
cd /d "%~dp0installer_build"
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:exe /r:System.Drawing.dll,System.dll /out:"%~dp0installer_build\IconBuilder.exe" "%~dp0installer_build\IconBuilder.cs"
"%~dp0installer_build\IconBuilder.exe" "%~dp0assets\clg-icon.png" "%~dp0assets\app.ico"
if not exist "%~dp0client\public" mkdir "%~dp0client\public"
copy /y "%~dp0assets\clg-icon.png" "%~dp0client\public\clg-icon.png" >nul
copy /y "%~dp0assets\app.ico" "%~dp0client\public\favicon.ico" >nul

:: 1. Build Client
echo.
echo [*] Step 1/5: Building React Frontend...
cd /d "%~dp0client"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Client build failed!
    pause
    exit /b %errorlevel%
)

:: 2. Build Server
echo.
echo [*] Step 2/5: Building Express Backend...
cd /d "%~dp0server"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Server build failed!
    pause
    exit /b %errorlevel%
)

:: 3. Compile Launcher & Stop Binaries with Application Icon
echo.
echo [*] Step 3/5: Compiling Native Windows Launchers with App Icon...
cd /d "%~dp0installer_build"
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /optimize+ /win32icon:"%~dp0assets\app.ico" /r:System.dll,System.Windows.Forms.dll /out:"%~dp0installer_build\staging\CollegeFeeManagement.exe" "%~dp0installer_build\Launcher.cs"
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /optimize+ /win32icon:"%~dp0assets\app.ico" /r:System.dll /out:"%~dp0installer_build\staging\StopCollegeApp.exe" "%~dp0installer_build\StopApp.cs"

:: 4. Update Staging Assets
echo.
echo [*] Step 4/5: Updating Staging Distribution...
if not exist "%~dp0installer_build\staging\node.exe" (
    copy /y "C:\Program Files\nodejs\node.exe" "%~dp0installer_build\staging\node.exe"
)
if not exist "%~dp0installer_build\staging\assets" mkdir "%~dp0installer_build\staging\assets"
copy /y "%~dp0assets\clg-icon.png" "%~dp0installer_build\staging\assets\clg-icon.png" >nul
copy /y "%~dp0assets\app.ico" "%~dp0installer_build\staging\assets\app.ico" >nul
robocopy "%~dp0client\dist" "%~dp0installer_build\staging\client\dist" /E /MIR >nul 2>&1
robocopy "%~dp0server\dist" "%~dp0installer_build\staging\server\dist" /E /MIR >nul 2>&1

:: 5. Compile Installer with Inno Setup
echo.
echo [*] Step 5/5: Compiling Inno Setup Installer...
set "ISCC_PATH=C:\Users\Dell\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC_PATH%" (
    set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
"%ISCC_PATH%" "%~dp0installer_build\installer.iss"

echo.
echo ========================================================
echo   BUILD COMPLETE!
echo   Installer generated at:
echo   d:\clg-app\installer_output\CollegeFeeManagement-Setup.exe
echo ========================================================
echo.
pause
