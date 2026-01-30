@echo off
cd /d %~dp0
echo Starting Expo from: %CD%
echo Node version:
node --version
echo.
npx expo start --web
pause
