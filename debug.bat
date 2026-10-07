@echo off
cd /d "%~dp0"

if not exist .venv (
    python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -r backend\requirements.txt --upgrade --quiet --disable-pip-version-check

echo.
echo Modo debug - deixe esta janela aberta para ver os logs.
echo Abrindo o ContentLab em http://127.0.0.1:5000
start "" http://127.0.0.1:5000
python -m backend.app

pause
