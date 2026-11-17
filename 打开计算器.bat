@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node 并重新打开命令行。
  pause
  exit /b 1
)
if not exist "便携版\offline.html" (
  if not exist "便携版\index.html" (
    echo 首次使用，正在打包便携版...
    call npm run build:offline
    if errorlevel 1 pause & exit /b 1
  )
)
node scripts\serve-portable.mjs