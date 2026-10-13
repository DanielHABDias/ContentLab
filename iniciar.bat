@echo off
setlocal
cd /d "%~dp0"
echo [Content Lab] Verificando dependencias...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-windows.ps1"
if errorlevel 1 goto failed
set "PATH=%~dp0.tools\node;%~dp0.tools\ffmpeg;%~dp0.tools\whisper;%PATH%"
if not defined CONTENTLAB_WHISPER_MODEL (
  if exist "%~dp0.tools\models\ggml-base.bin" set "CONTENTLAB_WHISPER_MODEL=%~dp0.tools\models\ggml-base.bin"
)
node server/launcher.mjs
if errorlevel 1 goto failed
exit /b 0
:failed
echo [Content Lab] A inicializacao falhou. Verifique os erros acima.
pause
exit /b 1
