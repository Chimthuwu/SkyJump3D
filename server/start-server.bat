@echo off
rem SkyJump3D - start the game/multiplayer server. Needs Node.js (https://nodejs.org).
cd /d "%~dp0"
if not exist node_modules (
  echo Installing server packages...
  call npm install
)
echo.
echo Starting the server. Open http://localhost:8080 in your browser, then choose MULTIPLAYER - HOST A GAME.
echo.
node server.js
pause
