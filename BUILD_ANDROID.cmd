@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0"

echo ==========================================
echo ZENTORA - ANDROID APK BUILDER FINAL
echo USES INSTALLED JAVA - NO JDK DOWNLOAD
echo ==========================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js not found.&pause&exit /b 1)
where npm >nul 2>nul || (echo [ERROR] npm not found.&pause&exit /b 1)
where java >nul 2>nul || (echo [ERROR] Java not found.&pause&exit /b 1)

for /f "tokens=3" %%V in ('java -version 2^>^&1 ^| findstr /i "version"') do set "JAVA_VER=%%~V"
echo Java: !JAVA_VER!

echo !JAVA_VER! | findstr /R /B /C:"21\." >nul
if errorlevel 1 (
  echo [ERROR] Java 21 is required.
  echo Your PC is currently using: !JAVA_VER!
  pause
  exit /b 1
)

echo.
echo [1/5] Installing dependencies...
call npm install --include=dev --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo [2/5] Checking Capacitor...
call npx cap --version
if errorlevel 1 goto :fail

echo.
echo [3/5] Creating/checking Android project...
if not exist "%ROOT%android\gradlew.bat" (
  call npx cap add android
  if errorlevel 1 goto :fail
)
if not exist "%ROOT%android\gradlew.bat" goto :fail

echo.
echo [4/5] Building web client...
call npm run build
if errorlevel 1 goto :fail
if not exist "%ROOT%dist\index.html" goto :fail

echo.
echo [5/5] Syncing and building APK...
call npx cap sync android
if errorlevel 1 goto :fail

echo.
echo [5.1/5] Configuring Android SDK and permissions...
node "%ROOT%scripts\configure-android.cjs"
if errorlevel 1 goto :fail

cd /d "%ROOT%android"
call gradlew.bat assembleDebug --no-daemon
set "RC=!ERRORLEVEL!"
cd /d "%ROOT%"

if not "!RC!"=="0" goto :fail

set "APK=%ROOT%android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" goto :fail

copy /Y "%APK%" "%ROOT%Zentora.apk" >nul
if errorlevel 1 goto :fail

echo.
echo ==========================================
echo SUCCESS
echo ==========================================
echo Zentora.apk created in:
echo %ROOT%
echo ==========================================
echo.
start "" explorer.exe "%ROOT%"
pause
exit /b 0

:fail
cd /d "%ROOT%"
echo.
echo ==========================================
echo BUILD FAILED
echo ==========================================
echo Read the error above.
pause
exit /b 1
