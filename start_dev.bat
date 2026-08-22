@echo off
setlocal
title 바닐라폼 개발 서버
echo.
echo  [바닐라폼] 개발 서버를 http://localhost:3026 에서 시작합니다.
echo.

cd /d "%~dp0app"
call npm run guard:isolation
if errorlevel 1 (
  echo.
  echo  안전 분리 검사에 실패하여 실행을 중단했습니다.
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:3026"
call npm run dev

echo.
echo  서버가 종료되었습니다.
pause
