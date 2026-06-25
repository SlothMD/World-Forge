param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $root ".vite-dev.log"
$url = "http://127.0.0.1:$Port/"

Set-Location $root

if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Host "Installing dependencies..."
  npm install
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  if (Test-Path -LiteralPath $logPath) {
    Remove-Item -LiteralPath $logPath -Force
  }

  Write-Host "Starting World Forge UI on $url"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- --port $Port > .vite-dev.log 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden
} else {
  Write-Host "World Forge UI already appears to be running on $url"
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $ready) {
  Write-Host "World Forge UI did not become ready. Recent dev-server log:"
  if (Test-Path -LiteralPath $logPath) {
    Get-Content -LiteralPath $logPath -Tail 80
  }
  exit 1
}

Start-Process $url
Write-Host "World Forge UI opened at $url"
