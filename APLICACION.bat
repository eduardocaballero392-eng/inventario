@echo off
chcp 65001 >nul
title Sistema de Inventario - Aplicación de Escritorio
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo.
  echo  Instalando componentes de la aplicación de escritorio...
  echo  (Esto solo se hace una vez, puede tardar unos minutos)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [X] Error en la instalación. Verifica tu conexión a internet.
    pause
    exit /b 1
  )
)

echo.
echo  Iniciando Sistema de Inventario...
echo.
start "" /B npm run electron

timeout /t 2 >nul
exit
