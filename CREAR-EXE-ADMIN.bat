@echo off
chcp 65001 >nul

:: Verificar si tiene permisos de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  Este proceso requiere permisos de administrador.
    echo  Haz clic derecho en este archivo y selecciona "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

title Crear Ejecutable - Sistema de Inventario (ADMIN)
cd /d "%~dp0"

echo.
echo  =====================================================
echo    CREANDO EJECUTABLE .EXE (Modo Administrador)
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
echo  [2/2] Creando ejecutable portable...
echo  (Esto puede tardar 5-10 minutos, se paciente)
echo.

call npm run crear-app

if errorlevel 1 (
  echo.
  echo  [X] Error al crear el ejecutable.
  pause
  exit /b 1
)

echo.
echo  =====================================================
echo    ¡EJECUTABLE CREADO EXITOSAMENTE!
echo.
echo    Busca el archivo en la carpeta: dist\
echo    Archivo creado: Sistema de Inventario X.X.X.exe
echo.
echo    Este es un archivo PORTABLE (no necesita instalacion)
echo    Solo copialo a cualquier PC y ejecutalo directamente
echo  =====================================================
echo.
pause
