@echo off
cd /d "%~dp0"
echo Starting AIGA Shield...
echo Project folder: %cd%
echo.

if not exist "server.js" (
  echo ERROR: server.js was not found.
  echo Open this file from C:\Users\hp\OneDrive\Documents\aiga_final
  pause
  exit /b 1
)

start "AIGA Shield Server" "%~dp0run-aiga.bat"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173"
