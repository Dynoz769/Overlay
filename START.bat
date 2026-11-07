@echo off
title SISTEM LIVE
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js belum dipasang. Download di https://nodejs.org (pilih LTS), pasang, kemudian buka START.bat semula.
  pause
  exit /b
)
if not exist node_modules (
  echo Memasang OCR engine kali pertama... (perlu internet, sekali sahaja)
  call npm install
)
echo Menghidupkan server...
start "SISTEM LIVE server" /min node server.js
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8799/control.html
start "" http://127.0.0.1:8799/auto.html
echo.
echo Server berjalan dalam tetingkap "SISTEM LIVE server" (minimize). Tutup tetingkap tu untuk berhenti.
echo OBS Browser Source: http://127.0.0.1:8799/overlay.html
pause
