@echo off
cd /d "%~dp0"
start /min "" npm start
timeout /t 4 /nobreak >nul
start "" npm run electron
exit
