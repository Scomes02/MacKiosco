@echo off
rem ============================================================
rem  MacKiosco - Reinicia el sistema (base de datos y servidor)
rem  Ejecutar con clic derecho > "Ejecutar como administrador".
rem ============================================================
setlocal
title MacKiosco - Reiniciar

net session >nul 2>nul
if errorlevel 1 (
  echo Esta herramienta necesita permisos de administrador.
  echo Cerra esta ventana y abrila con clic derecho ^> "Ejecutar como administrador".
  pause
  exit /b 1
)

echo Deteniendo el sistema...
schtasks /End /TN MacKiosco >nul 2>nul
timeout /t 2 /nobreak >nul
echo Iniciando la base de datos...
sc start MacKioscoDB >nul 2>nul
echo Iniciando el sistema...
schtasks /Run /TN MacKiosco
echo.
echo Listo. En unos segundos se puede abrir MacKiosco desde el escritorio.
echo Si algo falla, el detalle esta en: %ProgramData%\MacKiosco\logs\kiosco.log
pause
endlocal
