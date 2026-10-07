@echo off
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 goto python_missing

if not exist ".venv\Scripts\python.exe" (
    echo Criando ambiente virtual...
    python -m venv .venv
    if errorlevel 1 goto failed
)

echo Instalando dependencias...
".venv\Scripts\python.exe" -m pip install -r backend\requirements-desktop.txt --quiet --disable-pip-version-check
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pip install pyinstaller --quiet --disable-pip-version-check
if errorlevel 1 goto failed

echo.
echo Compilando ContentLab.exe (pode levar 1-2 minutos)...
".venv\Scripts\python.exe" -m PyInstaller --noconfirm ContentLab.spec
if errorlevel 1 goto failed

echo.
if exist dist\ContentLab.exe (
    echo ============================================
    echo Pronto! O executavel esta em: dist\ContentLab.exe
    echo Copie esse arquivo para onde quiser - ele roda sozinho,
    echo sem precisar de Python nem venv instalados.
    echo ============================================
) else (
    goto failed
)

pause
exit /b 0

:python_missing
echo Python nao encontrado. Instale Python 3.9 ou superior.
goto failed

:failed
echo Falha ao compilar ContentLab.exe. Veja a mensagem acima.
pause
exit /b 1
