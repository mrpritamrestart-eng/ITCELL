@echo off
setlocal
cd /d "%~dp0"

echo.
echo ITCELL Item Order Fix start ho raha hai...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-item-order-fix.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Fix apply nahi hua. Upar diya gaya error dekhein.
) else (
  echo Process complete.
)
echo.
pause
exit /b %EXIT_CODE%
