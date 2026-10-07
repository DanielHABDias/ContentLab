@echo off
cd /d "%~dp0"

if not exist .venv (
    echo Criando ambiente virtual...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Instalando/atualizando dependencias...
python -m pip install -r backend\requirements-desktop.txt --upgrade --quiet --disable-pip-version-check

start "" .venv\Scripts\pythonw.exe -m backend.tray_app
