@echo off
cd /d "%~dp0"

if not exist .venv (
    echo Criando ambiente virtual...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Instalando/ATUALIZANDO dependencias (yt-dlp sempre na ultima versao)...
python -m pip install -r backend\requirements-desktop.txt --upgrade --quiet --disable-pip-version-check
python -m pip install pyinstaller --quiet --disable-pip-version-check

echo.
echo Compilando ContentLab.exe (pode levar 1-2 minutos)...
pyinstaller --noconfirm ContentLab.spec

echo.
if exist dist\ContentLab.exe (
    echo ============================================
    echo Pronto! O executavel esta em: dist\ContentLab.exe
    echo Copie esse arquivo para onde quiser - ele roda sozinho,
    echo sem precisar de Python nem venv instalados.
    echo ============================================
) else (
    echo Algo deu errado - role a tela pra cima e veja o erro do PyInstaller.
)

pause
