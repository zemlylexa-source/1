@echo off
setlocal
cd /d "%~dp0"
echo ZENTORA SERVER
echo.
python --version >nul 2>&1
if errorlevel 1 goto NOPYTHON
python -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 goto PIPERROR
echo.
echo Starting ZENTORA server...
python "%~dp0zentora.py"
pause
goto END
:NOPYTHON
echo ERROR: Python is not installed or not in PATH.
echo Install Python and enable "Add Python to PATH".
pause
goto END
:PIPERROR
echo ERROR: Could not install required packages.
pause
goto END
:END
endlocal
