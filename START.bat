@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Memasang OCR engine kali pertama...
  call npm install
)
start "" http://127.0.0.1:8799/control.html
start "" http://127.0.0.1:8799/auto.html
node server.js
pause
