<#
  Start the SortedChoice API.

      .\run.ps1            # http://127.0.0.1:8000, auto-reload
      .\run.ps1 -Port 8001 # somewhere else
      .\run.ps1 -Install   # (re)install dependencies first

  Always uses .venv. The half-installed venv + a stray global-Python uvicorn on
  the same port is what made this confusing before, so this script refuses to
  start rather than letting the two silently diverge.
#>
param(
    [int]$Port = 8000,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $py)) {
    Write-Host 'No .venv found - creating one...' -ForegroundColor Yellow
    python -m venv .venv
    $Install = $true
}

# Missing fastapi means the last install died partway through. Reinstall rather
# than fail later with an import error that points nowhere useful.
& $py -c 'import fastapi' 2>$null
if ($LASTEXITCODE -ne 0) { $Install = $true }

if ($Install) {
    Write-Host 'Installing dependencies...' -ForegroundColor Cyan
    & $py -m pip install -e '.[dev]' --quiet
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }
}

if (-not (Test-Path '.env')) {
    throw "No .env - copy .env.example to .env and fill it in (see docs/05-admin-setup.md)."
}

# Windows reports an in-use port as WinError 10013 ("forbidden by its access
# permissions"), which reads like a firewall problem and is not one.
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $owner = Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue
    Write-Host "Port $Port is already served by PID $($busy[0].OwningProcess) ($($owner.ProcessName))." -ForegroundColor Yellow
    Write-Host "Stop it with:  Stop-Process -Id $($busy[0].OwningProcess)" -ForegroundColor Yellow
    Write-Host "Or run on another port:  .\run.ps1 -Port 8001" -ForegroundColor Yellow
    exit 1
}

Write-Host "API  -> http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Docs -> http://127.0.0.1:$Port/docs" -ForegroundColor Green
& $py -m uvicorn app.main:app --reload --host 127.0.0.1 --port $Port
