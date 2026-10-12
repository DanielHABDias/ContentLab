@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto missing
where npm >nul 2>&1
if errorlevel 1 goto missing
where ffmpeg >nul 2>&1
if errorlevel 1 goto ffmpeg_missing
if not exist "node_modules" call npm install --no-audit --no-fund
if errorlevel 1 goto failed
if not exist "backend\remotion\node_modules" call npm ci --prefix backend/remotion --no-audit --no-fund
if errorlevel 1 goto failed
node server/launcher.mjs
if errorlevel 1 goto failed
exit /b 0
:missing
echo Instale Node.js 22+ e npm.
goto failed
:ffmpeg_missing
echo Instale FFmpeg e adicione ao PATH.
goto failed
:failed
pause
exit /b 1
