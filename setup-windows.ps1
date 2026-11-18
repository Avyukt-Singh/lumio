#Requires -Version 5.1
<#
  ============================================================
  Lumio 2.0 - one-click Windows setup (PowerShell edition)
  ============================================================
  What it does:
    1. Unpacks the newest Lumio .zip found in your Downloads
       folder (or a zip you pass in / paste when asked)
    2. Installs Bun (if missing) and all project dependencies
    3. Asks which AI provider + API key you want (key input is
       hidden), writes the .env file
    4. Starts the dev server at http://localhost:3000 and opens
       your browser

  How to run:
    powershell -NoProfile -ExecutionPolicy Bypass -File setup-windows.ps1

  Optional:
    ... -File setup-windows.ps1 -ZipPath "C:\path\to\lumio.zip"
    ... -File setup-windows.ps1 -InstallDir "D:\Apps\Lumio"
  ============================================================
#>
[CmdletBinding()]
param(
    [string]$ZipPath   = "",
    [string]$InstallDir = "$env:USERPROFILE\Lumio2.0"
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ---------- tiny helpers ----------
function Write-Step { param($n, $msg) Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg)    Write-Host "      OK: $msg" -ForegroundColor Green }
function Write-Warn { param($msg)    Write-Host "      WARNING: $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg)    Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Pause-End {
    Write-Host ""
    Read-Host "Press Enter to close this window" | Out-Null
    exit 1
}

function Read-HiddenKey {
    param([string]$Prompt)
    Write-Host "  $Prompt (input is hidden)"
    $secure = Read-Host "  API key" -AsSecureString
    $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try     { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host "============================================================"
Write-Host "   Lumio 2.0 - Windows one-click setup"
Write-Host "============================================================"

try {
    # --------------------------------------------------------
    # Step 1: locate project (already extracted?) or unpack zip
    # --------------------------------------------------------
    Write-Step "1/4" "Locating the codebase..."

    if (Test-Path (Join-Path $PWD "package.json")) {
        $ProjectDir = $PWD.Path
        Write-Ok "Running inside the project folder already: $ProjectDir"
    }
    else {
        if (-not $ZipPath) {
            $downloads = Join-Path $env:USERPROFILE "Downloads"
            $ZipPath = Get-ChildItem -LiteralPath $downloads -Filter "*.zip" -File -ErrorAction SilentlyContinue |
                       Sort-Object LastWriteTime -Descending |
                       Select-Object -First 1 -ExpandProperty FullName
            if (-not $ZipPath) {
                Write-Fail "No .zip found in $downloads"
                Write-Host "       Put the Lumio zip there, or run:"
                Write-Host "       powershell -File setup-windows.ps1 -ZipPath `"C:\path\to\lumio.zip`""
                Pause-End
            }
            Write-Host "  Newest zip in Downloads:"
            Write-Host "    $ZipPath" -ForegroundColor White
            $answer = Read-Host "  Press Enter to use it, or paste the full path to another zip"
            if ($answer.Trim() -ne "") { $ZipPath = $answer.Trim() }
        }

        if (-not (Test-Path -LiteralPath $ZipPath)) {
            Write-Fail "Zip file not found: $ZipPath"
            Pause-End
        }

        if (Test-Path (Join-Path $InstallDir "package.json")) {
            Write-Ok "Project already extracted at: $InstallDir (reusing it)"
        }
        else {
            if (Test-Path -LiteralPath $InstallDir) {
                Remove-Item -LiteralPath $InstallDir -Recurse -Force
            }
            Write-Host "  Extracting - please wait..."
            Expand-Archive -LiteralPath $ZipPath -DestinationPath $InstallDir -Force
        }

        # if the zip had a single top-level folder, descend into it
        $items = Get-ChildItem -LiteralPath $InstallDir
        if ($items.Count -eq 1 -and $items[0].PSIsContainer) {
            $ProjectDir = $items[0].FullName
        } else {
            $ProjectDir = $InstallDir
        }
        Write-Ok "Extracted to: $ProjectDir"
    }

    if (-not (Test-Path (Join-Path $ProjectDir "package.json"))) {
        Write-Fail "package.json not found in $ProjectDir - is this the Lumio project?"
        Pause-End
    }

    Set-Location -LiteralPath $ProjectDir

    # --------------------------------------------------------
    # Step 2: Bun runtime + dependencies
    # --------------------------------------------------------
    Write-Step "2/4" "Checking the Bun runtime..."

    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
        Write-Host "  Bun not found - installing it now..."
        Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression
        $env:Path = "$env:Path;$env:USERPROFILE\.bun\bin"
    }
    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
        Write-Fail "Bun is still not available. Install it manually from https://bun.sh then re-run."
        Pause-End
    }
    $bunVersion = (& bun --version)
    Write-Ok "Bun $bunVersion is ready (handles package installation)"

    # Next.js runs on the Node.js runtime; running it under Bun's runtime
    # (--bun) breaks on Windows with a 'git is not installed' resolver error.
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "  Node.js not found - installing the LTS build via winget..."
        & winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
        $env:Path = "$env:Path;C:\Program Files\nodejs"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Fail "Node.js is still not available. Install the LTS from https://nodejs.org"
        Write-Host "       then close and reopen this window and re-run the script."
        Pause-End
    }
    $nodeVersion = (& node --version)
    Write-Ok "Node.js $nodeVersion is ready (runs the Next.js dev server)"

    Write-Host "  Installing project dependencies - this can take a few minutes..."
    & bun install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "bun install failed. Check your internet connection and retry."
        Pause-End
    }

    Write-Host "  Generating the Prisma database client..."
    & bunx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "prisma generate failed - run 'bunx prisma generate' manually later."
    }

    if (-not (Test-Path "db")) { New-Item -ItemType Directory -Path "db" | Out-Null }
    Write-Host "  Setting up the SQLite database..."
    & bun run db:push
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Database setup reported a problem - the app may still run, but saved data might not persist."
    }

    # --------------------------------------------------------
    # Step 3: AI provider + API key, written into .env
    # --------------------------------------------------------
    Write-Step "3/4" "AI setup - choose a provider for real AI features:"
    Write-Host ""
    Write-Host "   [1] Groq            - free tier, key from console.groq.com"
    Write-Host "   [2] OpenRouter      - key from openrouter.ai"
    Write-Host "   [3] Google Gemini   - key from aistudio.google.com"
    Write-Host "   [4] Ollama          - local models, NO key needed - ollama.com"
    Write-Host "   [5] Custom          - any OpenAI-compatible endpoint"
    Write-Host "   [6] Skip            - demo mode, no key, clearly-labelled"
    Write-Host "                         sample AI output only"
    Write-Host ""

    $prov = "fake"; $base = ""; $model = ""; $key = ""; $choice = ""

    # NOTE: deliberately an if/elseif chain, not a switch - in PowerShell,
    # break/continue inside a switch apply to the switch itself, not the loop.
    while ($true) {
        $choice = (Read-Host "  Your choice 1-6").Trim()
        if     ($choice -eq "1") { $prov="openai-compatible"; $base="https://api.groq.com/openai/v1";         $model="llama-3.3-70b-versatile";            break }
        elseif ($choice -eq "2") { $prov="openai-compatible"; $base="https://openrouter.ai/api/v1";           $model="meta-llama/llama-3.3-70b-instruct"; break }
        elseif ($choice -eq "3") { $prov="openai-compatible"; $base="https://generativelanguage.googleapis.com/v1beta/openai"; $model="gemini-3.8-flash"; break }
        elseif ($choice -eq "4") { $prov="openai-compatible"; $base="http://localhost:11434/v1";              $model="llama3.1";                          break }
        elseif ($choice -eq "5") { $prov="openai-compatible"; break }
        elseif ($choice -eq "6") { break }
        else { Write-Warn "Please type a number from 1 to 6." }
    }

    if ($choice -eq "4") {
        Write-Host ""
        Write-Host "  Ollama selected. Make sure Ollama is installed and running,"
        Write-Host "  then pull a model once with:  ollama pull llama3.1"
        $key = "ollama"
    }
    elseif ($choice -eq "5") {
        $base  = Read-Host "  Base URL (e.g. https://api.example.com/v1)"
        $model = Read-Host "  Model name"
        $key   = Read-HiddenKey "Enter your API key"
    }
    elseif ($prov -eq "openai-compatible") {
        $key = Read-HiddenKey "Enter your API key"
    }

    if ($prov -eq "openai-compatible" -and [string]::IsNullOrWhiteSpace($key)) {
        Write-Fail "The key cannot be empty. Re-run the script, or choose option 6 (demo mode)."
        Pause-End
    }
    if ($choice -eq "6") {
        Write-Host "  Demo mode selected: every AI feature still works, but replies come"
        Write-Host "  from the built-in clearly-labelled sample adapter."
    }

    Write-Host ""
    Write-Host "  Writing .env ..."
    $lines = @(
        "# Lumio 2.0 - generated by setup-windows.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        "DATABASE_URL=file:./db/custom.db"
        "AI_PROVIDER=$prov"
    )
    if ($base)  { $lines += "AI_BASE_URL=$base" }
    if ($key)   { $lines += "AI_API_KEY=$key"  }
    if ($model) { $lines += "AI_MODEL=$model"  }
    $lines += @(
        "AI_USER_DAILY_CALLS=40"
        "AI_USER_DAILY_TOKENS=40000"
        "AI_IP_HOURLY_CALLS=60"
        "AI_GLOBAL_DAILY_CALLS=2000"
        "FAKE_LATENCY_MS=350"
        "FAKE_FAIL_RATE=0"
    )
    Set-Content -Path (Join-Path $ProjectDir ".env") -Value $lines -Encoding ASCII
    Write-Ok ".env saved to: $(Join-Path $ProjectDir '.env')"

    # --------------------------------------------------------
    # Step 4: start the dev server on localhost:3000
    # --------------------------------------------------------
    Write-Step "4/4" "Starting Lumio at http://localhost:3000 ..."
    Write-Host ""
    Write-Host "  A browser tab will open automatically in a few seconds."
    Write-Host "  KEEP THIS WINDOW OPEN while you use the app."
    Write-Host "  To stop the server: press Ctrl+C or close this window."
    Write-Host ""

    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        "-NoProfile", "-Command",
        "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"
    )

    & bunx next dev -p 3000
}
catch {
    Write-Fail $_.Exception.Message
    Pause-End
}
