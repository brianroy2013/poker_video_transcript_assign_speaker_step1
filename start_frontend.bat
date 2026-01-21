@echo off
cd /d "%~dp0frontend"
echo Installing npm dependencies...
call npm install
echo Starting Vite dev server on port 5173...
call npm run dev
pause
