@echo off
chcp 65001 >nul
title Sistema de Inventario y Ventas
cd /d "%~dp0"

if not exist "node_modules" (
  echo  El sistema no esta instalado. Ejecuta primero INSTALAR.bat
  pause
  exit /b 1
)

:: Abre el navegador unos segundos despues de iniciar el servidor
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm start
pause
