@echo off
echo ========================================================
echo   Adding Windows Firewall rules for College Fee App
echo   Ports: 5173 (Frontend Web App) and 5000 (Backend API)
echo ========================================================
netsh advfirewall firewall delete rule name="College App Web (5173)" >nul 2>&1
netsh advfirewall firewall delete rule name="College App Server (5000)" >nul 2>&1
netsh advfirewall firewall add rule name="College App Web (5173)" dir=in action=allow protocol=TCP localport=5173 profile=any
netsh advfirewall firewall add rule name="College App Server (5000)" dir=in action=allow protocol=TCP localport=5000 profile=any
echo.
echo ========================================================
echo   SUCCESS! Firewall rules added.
echo   You can now connect from your phone over Wi-Fi!
echo ========================================================
pause
