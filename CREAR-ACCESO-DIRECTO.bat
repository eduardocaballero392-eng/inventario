@echo off
chcp 65001 >nul
title Crear Acceso Directo - Sistema de Inventario
cd /d "%~dp0"

echo.
echo  =====================================================
echo    CREANDO ACCESO DIRECTO EN EL ESCRITORIO
echo  =====================================================
echo.

if not exist "Sistema-Inventario.vbs" (
  echo  [X] Error: No se encuentra Sistema-Inventario.vbs
  echo      Verifica que todos los archivos esten completos.
  pause
  exit /b 1
)

echo  Creando acceso directo en el escritorio...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Sistema de Inventario.lnk'); $Shortcut.TargetPath = '%CD%\Sistema-Inventario.vbs'; $Shortcut.WorkingDirectory = '%CD%'; $Shortcut.Description = 'Sistema de Inventario y Ventas - Doble clic para abrir'; $Shortcut.Save()"

if errorlevel 1 (
  echo.
  echo  [X] Error al crear el acceso directo.
  pause
  exit /b 1
)

echo.
echo  =====================================================
echo    ¡ACCESO DIRECTO CREADO EXITOSAMENTE!
echo.
echo    Busca en tu ESCRITORIO el icono:
echo    "Sistema de Inventario"
echo.
echo    Haz doble clic y se abrira la aplicacion.
echo.
echo    NOTA: Asegurate de que MySQL este ejecutandose
echo          ^(WAMP o XAMPP en verde^)
echo  =====================================================
echo.
pause
