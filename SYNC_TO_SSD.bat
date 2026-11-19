@echo off
setlocal
title Apartment Platform - REVIEW GitHub Updates (No Extra Copies)
echo.
echo ============================================================
echo  APARTMENT PLATFORM - REVIEW GITHUB CODE CHANGES
echo ============================================================
echo This only fetches GitHub history and shows the differences.
echo It NEVER creates extra folders or overwrites your SSD files.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\SYNC_SSD_REVIEW_BRANCHES.ps1"
if errorlevel 1 (
  echo.
  echo REVIEW STOPPED. Nothing was overwritten.
  pause
  exit /b 1
)
echo.
echo For approved, TESTED, MERGED changes, use:
echo APPLY_APPROVED_UPDATES.bat
pause
