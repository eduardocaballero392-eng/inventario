@echo off
chcp 65001 >nul
title Preparar para Distribución - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    PREPARANDO SISTEMA PARA DISTRIBUIR
echo  =====================================================
echo.

echo  [1/3] Limpiando archivos temporales y de desarrollo...
if exist "dist" rmdir /s /q "dist" 2>nul
if exist ".git" rmdir /s /q ".git" 2>nul
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

echo  [2/3] Verificando archivos necesarios...
if not exist "node_modules" (
  echo.
  echo  [!] Falta la carpeta node_modules
  echo      Ejecuta INSTALAR.bat primero en esta PC
  pause
  exit /b 1
)

echo  [3/3] Creando archivo de información...
(
echo =====================================================
echo   SISTEMA DE INVENTARIO Y VENTAS
echo =====================================================
echo.
echo INSTRUCCIONES DE INSTALACION:
echo.
echo 1. Asegurate de tener MySQL instalado ^(WAMP/XAMPP^)
echo 2. Ejecuta: INSTALAR.bat
echo 3. Ejecuta: CREAR-ACCESO-DIRECTO.bat
echo 4. Haz doble clic en el icono del escritorio
echo.
echo REQUISITOS:
echo - Windows 7 o superior
echo - MySQL 5.7 o superior ^(WAMP/XAMPP^)
echo - Node.js se instala automaticamente
echo.
echo CREDENCIALES POR DEFECTO:
echo - Usuario: admin
echo - Contraseña: admin123
echo.
echo SOPORTE:
echo - Archivo: INSTRUCCIONES-APP.md
echo.
echo =====================================================
) > "LEEME-PRIMERO.txt"

echo.
echo  =====================================================
echo    ¡SISTEMA LISTO PARA DISTRIBUIR!
echo.
echo    Ahora puedes:
echo    1. Copiar toda esta carpeta a una USB
echo    2. Comprimir en ZIP para enviar por internet
echo    3. Copiar a otras computadoras
echo.
echo    Tamaño aproximado: ~300-400 MB
echo  =====================================================
echo.
pause
