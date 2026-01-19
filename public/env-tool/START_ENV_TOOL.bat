@echo off
title ENV Save and Restore Tool
cd /d "%~dp0"
echo Starting ENV Save and Restore Tool...
echo.
echo Opening browser in 2 seconds...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3033"
node env-server.js
pause
