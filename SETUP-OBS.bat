@echo off
title SISTEM LIVE - Setup OBS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js belum dipasang. Download di https://nodejs.org ^(pilih LTS^).
  pause
  exit /b
)
echo Pastikan OBS terbuka dan Tools -^> WebSocket Server Settings -^> "Enable WebSocket server" ditanda.
echo.
node setup-obs.js %*
pause
