@echo off
setlocal
echo Syncing Apartment Platform website and backend review branches into the main SSD project...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\SYNC_SSD_REVIEW_BRANCHES.ps1"
if errorlevel 1 (
  echo.
  echo SYNC STOPPED SAFELY. Your operating project files were not overwritten.
  pause
  exit /b 1
)
echo.
echo Review snapshots updated inside D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext\_review\GitHub
pause
