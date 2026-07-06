@echo off
cd /d "%~dp0"
echo Starting AIGA Shield real-time engine...
echo.
echo Cleaning old server on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Stopping old process %%a
  taskkill /PID %%a /F >nul 2>nul
)
echo.
echo Open this URL in your browser:
echo http://localhost:5173
echo.
echo Keep this window open while testing payments.
echo.
"C:\Program Files (x86)\node.exe" server.js
echo.
echo Server stopped or failed to start.
pause
