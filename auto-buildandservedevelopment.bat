@echo off
cd /d "%~dp0"
echo Starting local dev server (npm run dev)...
start "" "http://localhost:5174/"
call npm run dev -- --host 0.0.0.0 --port 5174
