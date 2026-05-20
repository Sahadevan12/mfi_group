@echo off
echo Starting SPS Group MFI Management System...
echo.

start "SPS Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /noisy > nul

start "SPS Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 4 /noisy > nul

start "" "http://localhost:5173"

echo.
echo ================================
echo  SPS Group MFI System Started
echo ================================
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:5000
echo.
echo  Admin:  admin@spsgroup.com / admin123
echo  Staff:  ravi@spsgroup.com  / staff123
echo ================================
pause
