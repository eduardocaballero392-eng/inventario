@echo off
chcp 65001 >nul
title Crear Instalador - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    CREANDO INSTALADOR PARA WINDOWS
echo  =====================================================
echo.

if not exist "node_modules\electron-builder" (
  echo  [1/2] Instalando herramientas necesarias...
  call npm install
  if errorlevel 1 (
    echo.
    echo  [X] Error en la instalación.
    pause
    exit /b 1
  )
)

echo.
echo  [2/2] Creando instalador (puede tardar varios minutos)...
echo.
call npm run crear-app

if errorlevel 1 (
  echo.
  echo  [X] Error al crear el instalador.
  pause
  exit /b 1
)

echo.
echo  =====================================================
echo    ¡INSTALADOR CREADO EXITOSAMENTE!
echo.
echo    Busca el archivo en la carpeta: dist\
echo    El instalador se llama: Sistema de Inventario Setup X.X.X.exe
echo  =====================================================
echo.
pause
