@echo off
echo ========================================================
echo   Adding Windows Firewall rules for College Fee App
echo   Ports: 5000 (Unified Web App) and 5173 (Dev Web App)
echo ========================================================

netsh advfirewall firewall delete rule name="College App Server (5000)" >nul 2>&1
netsh advfirewall firewall delete rule name="College App Web (5173)" >nul 2>&1
netsh advfirewall firewall delete rule name="College App Node Runtime" >nul 2>&1

netsh advfirewall firewall add rule name="College App Server (5000)" dir=in action=allow protocol=TCP localport=5000 profile=any
netsh advfirewall firewall add rule name="College App Web (5173)" dir=in action=allow protocol=TCP localport=5173 profile=any

if exist "%~dp0installer_build\staging\node.exe" (
    netsh advfirewall firewall add rule name="College App Node Runtime" dir=in action=allow program="%~dp0installer_build\staging\node.exe" enable=yes profile=any
)
if exist "%ProgramFiles%\College Fee Management\node.exe" (
    netsh advfirewall firewall add rule name="College App Node Runtime" dir=in action=allow program="%ProgramFiles%\College Fee Management\node.exe" enable=yes profile=any
)

echo.
echo ========================================================
echo   SUCCESS! Windows Firewall rules configured.
echo   All devices on your local Wi-Fi can now connect!
echo ========================================================
pause
