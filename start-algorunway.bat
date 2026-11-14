@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies for AlgoRunway...
  call npm install
)
echo Starting AlgoRunway at http://localhost:3000
start "" http://localhost:3000
call npm run dev
pause
