@echo off
cd /d "%~dp0"

echo ==================================================
echo Build and serve staging build
echo ==================================================
echo This builds the production bundle into dist\ and serves the repo root like GitHub Pages.

call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b %errorlevel%
)

echo.
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr :4174') do (
  if not "%%P"=="" (
    echo Stopping stale server on port 4174 (PID %%P)
    taskkill /PID %%P /F >nul 2>&1
  )
)

echo Staging build ready at: http://localhost:4174/
start "" "http://localhost:4174/"
call npx http-server . -p 4174 -c-1 --silent
