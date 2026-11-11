@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto missing
where npm >nul 2>&1
if errorlevel 1 goto missing
if not exist "node_modules" call npm install --no-audit --no-fund
if errorlevel 1 goto failed
if not exist "backend\remotion\node_modules" call npm ci --prefix backend/remotion --no-audit --no-fund
if errorlevel 1 goto failed
if not exist "dist" mkdir "dist"
echo Criando distribuicao Node.js (requer Node e FFmpeg no destino)...
powershell.exe -NoProfile -Command "Compress-Archive -Path @('server','backend\remotion','frontend','schemas','builtin-assets','node_modules','package.json','README.md','iniciar.bat','iniciar.vbs','parar.bat') -DestinationPath 'dist\ContentLab-Node.zip' -Force"
if errorlevel 1 goto failed
echo Pronto: dist\ContentLab-Node.zip
echo Use iniciar.vbs para abrir sem terminal.
pause
exit /b 0
:missing
echo Instale Node.js 22+ e npm.
goto failed
:failed
echo Nao foi possivel gerar o pacote.
pause
exit /b 1
