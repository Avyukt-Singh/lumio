@echo off
setlocal EnableExtensions
title Lumio 2.0 - Windows Setup

REM ============================================================
REM  Lumio 2.0 - one-click Windows setup
REM  What it does:
REM    1. Unpacks the newest Lumio .zip found in your Downloads
REM       folder (or a zip you drag onto this file)
REM    2. Installs Bun (if missing) and all project dependencies
REM    3. Asks which AI provider + API key you want, writes .env
REM    4. Starts the dev server at http://localhost:3000
REM
REM  Usage:
REM    - Double-click this file, OR
REM    - Drag your lumio .zip onto this file, OR
REM    - Run:  setup-windows.bat "C:\path\to\lumio.zip"
REM ============================================================

echo ============================================================
echo    Lumio 2.0 - Windows one-click setup
echo ============================================================
echo.

REM ------------------------------------------------------------
REM Step 0: if this script sits inside the already-extracted
REM project (package.json present), skip the unzip step.
REM ------------------------------------------------------------
if exist "package.json" (
    echo [1/4] package.json found in current folder - skipping unzip.
    set "WORKDIR=%CD%"
    goto deps
)

if not "%~1"=="" goto havezip

REM ------------------------------------------------------------
REM Step 1a: find the newest .zip in the Downloads folder
REM ------------------------------------------------------------
set "ZIPFILE="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%USERPROFILE%\Downloads' -Filter *.zip -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do set "ZIPFILE=%%F"

if defined ZIPFILE goto zipfound

echo [ERROR] No .zip file found in %USERPROFILE%\Downloads
echo         Put the Lumio zip in Downloads and re-run this script,
echo         or drag the zip onto this file.
echo.
pause
exit /b 1

:zipfound
echo [1/4] Using the newest zip found in Downloads:
echo       %ZIPFILE%
echo.
goto unzip

:havezip
set "ZIPFILE=%~1"
if exist "%ZIPFILE%" goto unzip
echo [ERROR] Zip file not found: %ZIPFILE%
pause
exit /b 1

REM ------------------------------------------------------------
REM Step 1b: extract it to %USERPROFILE%\Lumio2.0
REM ------------------------------------------------------------
:unzip
set "APPDIR=%USERPROFILE%\Lumio2.0"
if exist "%APPDIR%\package.json" (
    echo       Project already extracted at: %APPDIR%
    set "WORKDIR=%APPDIR%"
    goto deps
)
if exist "%APPDIR%" rmdir /s /q "%APPDIR%"
echo       Extracting - please wait...
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIPFILE%' -DestinationPath '%APPDIR%' -Force"
if errorlevel 1 (
    echo [ERROR] Extraction failed. The zip may be corrupt or blocked.
    echo         Right-click the zip, choose Properties, tick Unblock, then retry.
    pause
    exit /b 1
)

REM If the zip contained a single top-level folder, descend into it.
set "WORKDIR=%APPDIR%"
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "$i = Get-ChildItem -LiteralPath '%APPDIR%'; if ($i.Count -eq 1 -and $i[0].PSIsContainer) { Write-Output $i[0].FullName } else { Write-Output '%APPDIR%' }"`) do set "WORKDIR=%%D"

echo       Extracted to: %WORKDIR%
echo.

REM ------------------------------------------------------------
REM Step 2: Bun runtime + dependencies
REM ------------------------------------------------------------
:deps
cd /d "%WORKDIR%"
if not exist "package.json" (
    echo [ERROR] package.json not found in %WORKDIR%
    echo         Is this really the extracted Lumio project folder?
    pause
    exit /b 1
)

echo [2/4] Checking for the Bun runtime...
where bun >nul 2>nul
if %errorlevel%==0 goto havebun

echo       Bun not found - installing it now...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
set "PATH=%PATH%;%USERPROFILE%\.bun\bin"
where bun >nul 2>nul
if %errorlevel%==0 goto havebun
echo [ERROR] Bun installation failed. Install it manually from https://bun.sh
echo         then re-run this script.
pause
exit /b 1

:havebun
for /f "delims=" %%V in ('bun --version') do set "BUNVER=%%V"
echo       Bun %BUNVER% is ready.
echo.
echo       Checking for Node.js - Next.js runs on the Node runtime...
where node >nul 2>nul
if %errorlevel%==0 goto havenode

echo       Node.js not found - installing the LTS build via winget...
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>nul
if %errorlevel%==0 goto havenode
echo [ERROR] Node.js installation failed. Install the LTS from https://nodejs.org
echo         then close and reopen this window and re-run this script.
pause
exit /b 1

:havenode
for /f "delims=" %%V in ('node --version') do set "NODEVER=%%V"
echo       Node.js %NODEVER% is ready.
echo.
echo       Installing project dependencies - this can take a few minutes...
call bun install
if errorlevel 1 (
    echo [ERROR] bun install failed. Check your internet connection and retry.
    pause
    exit /b 1
)

echo       Generating the Prisma database client...
call bunx prisma generate
if errorlevel 1 echo [WARNING] prisma generate failed - run "bunx prisma generate" manually later.

if not exist "db" mkdir "db"
echo       Setting up the SQLite database...
call bun run db:push
if errorlevel 1 (
    echo [WARNING] Database setup reported a problem - the app may still run,
    echo           but saved progress/data might not persist.
)
echo.

REM ------------------------------------------------------------
REM Step 3: AI provider + API key, written into .env
REM ------------------------------------------------------------
:aikeys
echo ------------------------------------------------------------
echo [3/4] AI setup - choose an AI provider for real AI features:
echo.
echo   [1] Groq            - free tier, key from console.groq.com
echo   [2] OpenRouter      - key from openrouter.ai
echo   [3] Google Gemini   - key from aistudio.google.com
echo   [4] Ollama          - local models, NO key needed - ollama.com
echo   [5] Custom          - any OpenAI-compatible endpoint
echo   [6] Skip            - demo mode, no key, clearly-labelled
echo                         sample AI output only
echo.
choice /C 123456 /N /M "Your choice 1-6: "
if errorlevel 6 goto prov_skip
if errorlevel 5 goto prov_custom
if errorlevel 4 goto prov_ollama
if errorlevel 3 goto prov_gemini
if errorlevel 2 goto prov_openrouter
goto prov_groq

:prov_groq
set "PROV=openai-compatible"
set "BASE=https://api.groq.com/openai/v1"
set "MODEL=llama-3.3-70b-versatile"
goto askkey

:prov_openrouter
set "PROV=openai-compatible"
set "BASE=https://openrouter.ai/api/v1"
set "MODEL=meta-llama/llama-3.3-70b-instruct"
goto askkey

:prov_gemini
set "PROV=openai-compatible"
set "BASE=https://generativelanguage.googleapis.com/v1beta/openai"
set "MODEL=gemini-3.8-flash"
goto askkey

:prov_ollama
set "PROV=openai-compatible"
set "BASE=http://localhost:11434/v1"
set "MODEL=llama3.1"
set "KEY=ollama"
echo.
echo       Ollama selected. Make sure Ollama is installed and running,
echo       then pull a model once with:  ollama pull llama3.1
goto writeenv

:prov_custom
set /p "BASE=Base URL, e.g. https://api.example.com/v1: "
set /p "MODEL=Model name: "
goto askkey

:askkey
echo.
echo   Note: API keys never contain these characters: ampersand, caret,
echo         percent, or quotation marks. If yours seems to, re-copy it.
set /p "KEY=Enter your API key: "
if "%KEY%"=="" (
    echo [ERROR] The key cannot be empty. Re-run the script, or choose Skip.
    pause
    exit /b 1
)
goto writeenv

:prov_skip
set "PROV=fake"
set "BASE="
set "MODEL="
set "KEY="
echo.
echo       Demo mode selected: every AI feature still works, but replies
echo       come from the built-in clearly-labelled sample adapter.

:writeenv
echo.
echo       Writing .env ...
>  .env echo # Lumio 2.0 - generated by setup-windows.bat on %DATE% %TIME%
>> .env echo DATABASE_URL=file:./db/custom.db
>> .env echo AI_PROVIDER=%PROV%
if not "%BASE%"==""  >> .env echo AI_BASE_URL=%BASE%
if not "%KEY%"==""   >> .env echo AI_API_KEY=%KEY%
if not "%MODEL%"=="" >> .env echo AI_MODEL=%MODEL%
>> .env echo AI_USER_DAILY_CALLS=40
>> .env echo AI_USER_DAILY_TOKENS=40000
>> .env echo AI_IP_HOURLY_CALLS=60
>> .env echo AI_GLOBAL_DAILY_CALLS=2000
>> .env echo FAKE_LATENCY_MS=350
>> .env echo FAKE_FAIL_RATE=0
echo       .env saved to: %CD%\.env
echo.

REM ------------------------------------------------------------
REM Step 4: start the dev server on localhost:3000
REM ------------------------------------------------------------
:start
echo [4/4] Starting Lumio at http://localhost:3000 ...
echo.
echo   A browser tab will open automatically in a few seconds.
echo   KEEP THIS WINDOW OPEN while you use the app.
echo   To stop the server: close this window or press Ctrl+C.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call bunx next dev -p 3000
echo.
echo The server stopped.
pause
