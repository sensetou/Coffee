@echo off
title Coffee Sales Interactive Dashboard
echo =======================================================
echo   Opening Coffee Sales Interactive Dashboard...
echo =======================================================

start "" "%~dp0dashboard.html"

echo.
echo Dashboard opened in your default web browser!
echo If you prefer a local HTTP server, run: node serve.js
timeout /t 3 >nul
