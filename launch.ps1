param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $root ".vite-dev.log"

Set-Location $root

function Test-WorldForgeUrl {
  param([string]$TargetUrl)

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -eq 200 -and $response.Content -match "<title>World Forge</title>")
  } catch {
    return $false
  }
}

function Test-PortListening {
  param([int]$TargetPort)

  $listener = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  return [bool]$listener
}

if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Host "Installing dependencies..."
  npm install
}

$requestedPort = $Port
while ((Test-PortListening -TargetPort $Port) -and -not (Test-WorldForgeUrl -TargetUrl "http://127.0.0.1:$Port/")) {
  Write-Host "Port $Port is already serving another app. Trying $($Port + 1)..."
  $Port += 1
}

$url = "http://127.0.0.1:$Port/"
$listener = Test-PortListening -TargetPort $Port

if (-not $listener) {
  if (Test-Path -LiteralPath $logPath) {
    Remove-Item -LiteralPath $logPath -Force
  }

  Write-Host "Starting World Forge UI on $url"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- --port $Port --strictPort > .vite-dev.log 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden
} else {
  Write-Host "World Forge UI already appears to be running on $url"
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200 -and $response.Content -match "<title>World Forge</title>") {
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
if ($Port -ne $requestedPort) {
  Write-Host "World Forge UI opened at $url because port $requestedPort was in use by another app."
} else {
  Write-Host "World Forge UI opened at $url"
}
