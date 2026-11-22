@echo off
chcp 65001 >nul
title Instalacion - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    INSTALACION DEL SISTEMA DE INVENTARIO Y VENTAS
echo  =====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js no esta instalado.
  echo      Descargalo de https://nodejs.org  ^(version LTS^) e instalalo.
  echo      Luego vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v encontrado

echo.
echo  [1/3] Instalando dependencias (puede tardar unos minutos)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo  [X] Error instalando dependencias. Revisa tu conexion a internet.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo  [2/3] Creando archivo de configuracion .env ...
  copy ".env.example" ".env" >nul
  for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do (
    powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=.*', 'JWT_SECRET=%%s' | Set-Content -Encoding utf8 .env"
  )
  echo  [OK] Archivo .env creado con una clave de seguridad unica.
  echo.
  echo  IMPORTANTE: revisa los datos de MySQL en el archivo .env
  echo  ^(por defecto: usuario root sin contrasena en localhost, como WAMP/XAMPP^).
  echo  Asegurate de que MySQL este encendido antes de continuar.
  echo.
  pause
) else (
  echo  [2/3] El archivo .env ya existe, se conserva.
)

echo.
echo  [3/3] Creando la base de datos...
call npm run db:setup
if errorlevel 1 (
  echo.
  echo  [X] No se pudo crear la base de datos.
  echo      - Verifica que MySQL este encendido ^(WAMP/XAMPP en verde^).
  echo      - Revisa usuario y contrasena en el archivo .env
  pause
  exit /b 1
)

echo.
echo  =====================================================
echo    INSTALACION COMPLETADA
echo    Ahora haz doble clic en INICIAR.bat
echo  =====================================================
echo.
pause
