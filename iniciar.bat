@echo off
rem ============================================================
rem  KIOSCO - Inicia el sistema con doble clic (Windows)
rem  La primera vez instala las dependencias y compila la interfaz.
rem ============================================================
setlocal
cd /d "%~dp0"
title Kiosco - Sistema de gestion

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y volve a intentar.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo Falta el archivo backend\.env
  echo Copia backend\.env.example como backend\.env y completa la contrasena de MySQL y JWT_SECRET.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo Instalando dependencias del servidor...
  call npm install --prefix backend
  if errorlevel 1 goto :error
)

if not exist "frontend\dist\index.html" (
  echo Preparando la interfaz por primera vez...
  if not exist "frontend\node_modules" call npm install --prefix frontend
  call npm run build --prefix frontend
  if errorlevel 1 goto :error
)

echo.
echo Iniciando el sistema. Para cerrarlo, cerra esta ventana.
echo Abri en el navegador:  http://localhost:3001
echo.
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3001"
call npm start --prefix backend
goto :fin

:error
echo.
echo Ocurrio un error durante la preparacion. Revisa los mensajes de arriba.

:fin
pause
endlocal
