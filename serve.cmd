@echo off
REM Builds the app and serves it to the local network, for reading and writing
REM on the iPad. Slower to start than start.cmd, much faster to load over Wi-Fi.
setlocal
set "NODE_DIR=%~dp0.cache\node-v22.20.0-win-x64"
if exist "%NODE_DIR%\node.exe" (
  set "PATH=%NODE_DIR%;%PATH%"
) else (
  where node >nul 2>nul || (
    echo Node.js was not found. Install it from https://nodejs.org and run: npm install
    exit /b 1
  )
)
if not exist "%~dp0node_modules" call npm install
echo Building...
call npm run serve
