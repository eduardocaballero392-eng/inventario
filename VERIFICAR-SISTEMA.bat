@echo off
chcp 65001 >nul
title Verificar Sistema - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    VERIFICANDO SISTEMA DE INVENTARIO
echo  =====================================================
echo.

set "ERRORES=0"

echo  [1/8] Verificando Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js no encontrado
  set /a ERRORES+=1
) else (
  for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v encontrado
)

echo  [2/8] Verificando MySQL...
sc query wampmysqld64 >nul 2>nul
if errorlevel 1 (
  sc query MySQL >nul 2>nul
  if errorlevel 1 (
    echo  [X] MySQL no encontrado
    set /a ERRORES+=1
  ) else (
    echo  [OK] MySQL encontrado
  )
) else (
  echo  [OK] MySQL WAMP encontrado
)

echo  [3/8] Verificando node_modules...
if not exist "node_modules" (
  echo  [X] Carpeta node_modules no encontrada
  echo      Ejecuta INSTALAR.bat primero
  set /a ERRORES+=1
) else (
  echo  [OK] node_modules encontrado
)

echo  [4/8] Verificando servidor...
if not exist "server\index.js" (
  echo  [X] Servidor no encontrado
  set /a ERRORES+=1
) else (
  echo  [OK] Servidor encontrado
)

echo  [5/8] Verificando frontend...
if not exist "public\index.html" (
  echo  [X] Frontend no encontrado
  set /a ERRORES+=1
) else (
  echo  [OK] Frontend encontrado
)

echo  [6/8] Verificando archivos de inicio...
if not exist "APLICACION.bat" (
  echo  [X] APLICACION.bat no encontrado
  set /a ERRORES+=1
) else (
  echo  [OK] APLICACION.bat encontrado
)

echo  [7/8] Verificando configuracion...
if not exist ".env" (
  echo  [!] Archivo .env no encontrado ^(se creara al instalar^)
) else (
  echo  [OK] Archivo .env encontrado
)

echo  [8/8] Verificando package.json...
if not exist "package.json" (
  echo  [X] package.json no encontrado
  set /a ERRORES+=1
) else (
  echo  [OK] package.json encontrado
)

echo.
echo  =====================================================
if %ERRORES% EQU 0 (
  echo    ✓ SISTEMA COMPLETO Y LISTO
  echo.
  echo    Todo esta correcto. Puedes:
  echo    1. Usar el sistema en esta PC
  echo    2. Distribuir a otras computadoras
) else (
  echo    ✗ SE ENCONTRARON %ERRORES% PROBLEMA^(S^)
  echo.
  echo    Soluciones:
  echo    - Si falta Node.js: instalalo desde nodejs.org
  echo    - Si falta MySQL: instala WAMP o XAMPP
  echo    - Si falta node_modules: ejecuta INSTALAR.bat
  echo    - Si faltan archivos: descarga el sistema completo
)
echo  =====================================================
echo.
pause
