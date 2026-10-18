@echo off
rem ============================================================
rem  MacKiosco - Restaurar una copia de seguridad
rem  Reemplaza TODOS los datos actuales por los de la copia elegida.
rem  Ejecutar con clic derecho > "Ejecutar como administrador".
rem ============================================================
setlocal
chcp 65001 >nul
title MacKiosco - Restaurar copia de seguridad
set "PROGRAMA=%~dp0.."
set "NODE=%PROGRAMA%\runtime\node\node.exe"
set "KIOSCO_ENV_FILE=%ProgramData%\MacKiosco\config\.env"

net session >nul 2>nul
if errorlevel 1 (
  echo Esta herramienta necesita permisos de administrador.
  echo Cerra esta ventana y abrila con clic derecho ^> "Ejecutar como administrador".
  pause
  exit /b 1
)

echo.
echo  Las copias de seguridad estan en: %ProgramData%\MacKiosco\backups
echo.
dir /b /o-n "%ProgramData%\MacKiosco\backups\kiosco-*.sql.gz" 2>nul
echo.
echo  Escribi (o arrastra a esta ventana) el archivo de la copia a restaurar:
set /p ARCHIVO=^>
set ARCHIVO=%ARCHIVO:"=%
if not exist "%ARCHIVO%" if exist "%ProgramData%\MacKiosco\backups\%ARCHIVO%" set "ARCHIVO=%ProgramData%\MacKiosco\backups\%ARCHIVO%"
if not exist "%ARCHIVO%" (
  echo No se encontro ese archivo.
  pause
  exit /b 1
)

echo.
echo  ATENCION: se van a REEMPLAZAR todos los datos actuales por los de:
echo    %ARCHIVO%
echo  (Antes se guarda automaticamente una copia de los datos actuales.)
echo.
set /p SEGURO=Escribi SI para continuar:
if /i not "%SEGURO%"=="SI" (
  echo Cancelado. No se modifico nada.
  pause
  exit /b 0
)

echo.
echo Deteniendo el sistema...
schtasks /End /TN MacKiosco >nul 2>nul
timeout /t 3 /nobreak >nul

"%NODE%" "%PROGRAMA%\app\backend\scripts\restaurar-copia.js" "%ARCHIVO%" --confirmar
if errorlevel 1 goto reiniciar

echo Actualizando la estructura de la base, si hace falta...
"%NODE%" "%PROGRAMA%\app\backend\scripts\db-migrar.js"

:reiniciar
echo Iniciando el sistema...
schtasks /Run /TN MacKiosco >nul 2>nul
echo.
echo Listo.
pause
endlocal
