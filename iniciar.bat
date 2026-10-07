@echo off
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 goto python_missing

if not exist ".venv\Scripts\python.exe" (
    echo Criando ambiente virtual...
    python -m venv .venv
    if errorlevel 1 goto failed
)

echo Verificando dependencias...
".venv\Scripts\python.exe" -m pip install -r backend\requirements-desktop.txt --quiet --disable-pip-version-check
if errorlevel 1 goto failed

start "" ".venv\Scripts\pythonw.exe" -m backend.tray_app
if errorlevel 1 goto failed
exit /b 0

:python_missing
echo Python nao encontrado. Instale Python 3.9 ou superior.
goto failed

:failed
echo Falha ao iniciar o Content Lab. Veja a mensagem acima.
pause
exit /b 1
