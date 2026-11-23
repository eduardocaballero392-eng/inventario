@echo off
chcp 65001 >nul
title Instalacion - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    INSTALACION DEL SISTEMA DE INVENTARIO Y VENTAS
echo  =====================================================
echo.

:: Verificar Node.js
echo  Verificando Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js NO esta instalado.
  echo.
  echo  SOLUCION:
  echo  1. Ve a: https://nodejs.org
  echo  2. Descarga la version LTS ^(recomendada^)
  echo  3. Instala con las opciones por defecto
  echo  4. Reinicia esta instalacion
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v encontrado

:: Verificar si ya esta instalado
if exist "node_modules" (
  echo  [!] El sistema ya tiene dependencias instaladas.
  echo.
  choice /C SN /M "¿Deseas reinstalar las dependencias?"
  if errorlevel 2 goto skip_npm
)

echo.
echo  [1/3] Instalando dependencias...
echo       ^(Esto puede tardar 3-5 minutos, ten paciencia^)
echo.
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo  [X] Error al instalar dependencias.
  echo.
  echo  POSIBLES CAUSAS:
  echo  - No tienes conexion a internet
  echo  - El firewall bloquea npm
  echo  - Hay un problema con el archivo package.json
  echo.
  pause
  exit /b 1
)
echo  [OK] Dependencias instaladas correctamente
goto after_npm

:skip_npm
echo  [1/3] Saltando instalacion de dependencias...

:after_npm

:: Crear archivo .env
if not exist ".env" (
  echo.
  echo  [2/3] Creando archivo de configuracion .env ...
  if not exist ".env.example" (
    echo  [X] Error: .env.example no encontrado
    pause
    exit /b 1
  )
  copy ".env.example" ".env" >nul
  
  :: Generar clave JWT aleatoria
  for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"') do (
    powershell -NoProfile -Command "(Get-Content .env) -replace '^JWT_SECRET=.*', 'JWT_SECRET=%%s' | Set-Content -Encoding utf8 .env"
  )
  echo  [OK] Archivo .env creado con clave de seguridad unica.
  echo.
  echo  ┌───────────────────────────────────────────────────┐
  echo  │  IMPORTANTE: Configuracion de MySQL              │
  echo  ├───────────────────────────────────────────────────┤
  echo  │  Por defecto usa:                                 │
  echo  │  - Host: localhost                                │
  echo  │  - Usuario: root                                  │
  echo  │  - Contraseña: ^(vacia^)                            │
  echo  │  - Puerto: 3306                                   │
  echo  │                                                   │
  echo  │  Si tu MySQL tiene otra configuracion,            │
  echo  │  edita el archivo .env antes de continuar.        │
  echo  └───────────────────────────────────────────────────┘
  echo.
  pause
) else (
  echo  [2/3] El archivo .env ya existe, se conserva la configuracion.
)

:: Verificar MySQL
echo.
echo  Verificando MySQL...
sc query wampmysqld64 >nul 2>nul
if errorlevel 1 (
  sc query MySQL >nul 2>nul
  if errorlevel 1 (
    echo  [!] No se detecto MySQL ejecutandose.
    echo      Asegurate de que WAMP o XAMPP este iniciado ^(icono verde^)
    echo.
    choice /C SN /M "¿Deseas continuar de todas formas?"
    if errorlevel 2 exit /b 1
  ) else (
    echo  [OK] MySQL detectado y ejecutandose
  )
) else (
  echo  [OK] MySQL WAMP detectado y ejecutandose
)

:: Crear base de datos
echo.
echo  [3/3] Creando base de datos e insertando datos iniciales...
echo       ^(Esto puede tardar 1-2 minutos^)
echo.
call npm run db:setup
if errorlevel 1 (
  echo.
  echo  [X] Error al crear la base de datos.
  echo.
  echo  SOLUCIONES:
  echo  1. Verifica que MySQL este ejecutandose ^(WAMP/XAMPP en verde^)
  echo  2. Revisa el usuario y contraseña en el archivo .env
  echo  3. Asegurate de tener permisos para crear bases de datos
  echo.
  echo  Si usas contraseña en MySQL:
  echo  - Abre el archivo .env
  echo  - Cambia DB_PASSWORD= por tu contraseña
  echo  - Vuelve a ejecutar este instalador
  echo.
  pause
  exit /b 1
)

:: Instalacion completada
cls
echo.
echo  =====================================================
echo    ✓ INSTALACION COMPLETADA EXITOSAMENTE
echo  =====================================================
echo.
echo  El sistema esta listo para usar.
echo.
echo  CREDENCIALES DE ACCESO:
echo  ┌─────────────────────────────────────────────────┐
echo  │  Administrador:                                 │
echo  │    Usuario: admin                               │
echo  │    Contraseña: admin123                         │
echo  │                                                 │
echo  │  Cajero:                                        │
echo  │    Usuario: cajero                              │
echo  │    Contraseña: cajero123                        │
echo  │                                                 │
echo  │  Almacenero:                                    │
echo  │    Usuario: almacen                             │
echo  │    Contraseña: almacen123                       │
echo  └─────────────────────────────────────────────────┘
echo.
echo  IMPORTANTE: Cambia las contraseñas desde el modulo
echo              Usuarios una vez que inicies sesion.
echo.
echo  =====================================================
echo    SIGUIENTES PASOS:
echo  =====================================================
echo.
echo  OPCION 1: Crear acceso directo en el escritorio
echo    → Ejecuta: CREAR-ACCESO-DIRECTO.bat
echo.
echo  OPCION 2: Abrir como aplicacion de escritorio
echo    → Ejecuta: APLICACION.bat
echo.
echo  OPCION 3: Abrir en el navegador
echo    → Ejecuta: INICIAR.bat
echo.
echo  =====================================================
echo.
pause
