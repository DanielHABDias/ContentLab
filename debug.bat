@echo off
cd /d "%~dp0"
if not exist "node_modules" call npm install
if errorlevel 1 goto failed
echo Content Lab Node em modo debug: http://127.0.0.1:5000
node --inspect server/http.mjs
pause
exit /b 0
:failed
pause
exit /b 1
