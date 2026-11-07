@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8799/control.html
node server.js
pause
