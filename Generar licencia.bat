@echo off
rem ============================================================
rem  MacKiosco - Generador de claves de licencia (uso del fabricante)
rem  Pregunta el codigo de equipo del cliente, el titular y la
rem  duracion, y muestra la clave para enviarle.
rem ============================================================
setlocal
cd /d "%~dp0"
title MacKiosco - Generador de licencias
chcp 65001 >nul

:otra
node herramientas\generar-licencia.js
echo.
set /p REPETIR=Generar otra licencia? (S/N):
if /i "%REPETIR%"=="S" goto otra
endlocal
