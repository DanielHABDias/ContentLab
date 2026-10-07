@echo off
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 goto python_missing

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 goto failed
)

".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 goto failed

echo.
echo Modo debug - deixe esta janela aberta para ver os logs.
echo Abrindo o ContentLab em http://127.0.0.1:5000
start "" http://127.0.0.1:5000
".venv\Scripts\python.exe" -m backend.app

pause
exit /b 0

:python_missing
echo Python nao encontrado. Instale Python 3.9 ou superior.
goto failed

:failed
echo Falha ao iniciar o Content Lab.
pause
exit /b 1
