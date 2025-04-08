@echo off
echo Starting Shogun Music App Development Environment...

REM Start the API server in a new window
powershell -Command "Start-Process -FilePath cmd.exe -ArgumentList '/k', 'cd /d %~dp0 && node server.js'"

REM Wait a moment for the server to start
timeout /t 2

REM Start the React dev server
powershell -Command "Start-Process -FilePath cmd.exe -ArgumentList '/k', 'cd /d %~dp0 && npm run start-win'"

echo Both servers started! 
echo API Server: http://localhost:3001
echo React App: http://localhost:3000 