@echo off
setlocal
cd /d "%~dp0"
title Timbre Studio

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez Node.js 24 depuis https://nodejs.org puis relancez.
  pause
  exit /b 1
)

if not exist .env (
  copy /y .env.example .env >nul
  echo.
  echo Le fichier .env va s'ouvrir dans le Bloc-notes.
  echo Collez votre cle API Gemini apres GEMINI_API_KEY= puis enregistrez et fermez le Bloc-notes.
  echo.
  start /wait notepad .env
)

rem Verifie Node, installe les dependances et reconstruit l'interface si besoin (apres une mise a jour).
node scripts\prepare.ts
if errorlevel 1 (
  pause
  exit /b 1
)

echo Timbre Studio demarre sur http://127.0.0.1:5178  (fermez cette fenetre pour l'arreter)
set OPEN_BROWSER=1
call npm start
pause
