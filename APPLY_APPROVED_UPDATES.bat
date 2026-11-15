@echo off
setlocal
title Apartment Platform - APPLY APPROVED Changes to ONE SSD Project
echo.
echo ============================================================
echo  UPDATE THE OPERATING SSD PROJECT - IN PLACE
echo ============================================================
echo This button updates the EXISTING desktop project and website.
echo It never creates project copies. Git history preserves old code.
echo.
echo ONLY continue AFTER:
echo   1. BOTH relevant GitHub pull requests were tested and merged.
echo   2. You are ready to update the local operating files.
echo   3. Desktop Manager, scrapers and other project processes are closed.
echo.
echo This DOES NOT deploy Cloudflare, migrate D1, or change R2 media.
echo.
set /p "ANSWER=Type APPLY to update the active SSD project (anything else cancels): "
if /I not "%ANSWER%"=="APPLY" (
  echo Canceled. No changes made.
  pause
  exit /b 0
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\SYNC_SSD_REVIEW_BRANCHES.ps1" -Apply
if errorlevel 1 (
  echo.
  echo APPLY STOPPED for safety. Read the error and ask ChatGPT.
  echo Do not force reset, merge, or delete your existing files.
  pause
  exit /b 1
)
echo.
echo Approved changes have been applied to your existing project folders.
echo Run the desktop startup checks before returning to production use.
pause
