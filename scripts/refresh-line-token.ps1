param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  param([string]$Path)
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') {
      continue
    }
    $key, $value = $line -split '=', 2
    $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
  }
  return $values
}

$envFile = Join-Path $RepoRoot 'bot\.env'
$workerDir = Join-Path $RepoRoot 'worker'
$vars = Read-DotEnv -Path $envFile
$channelId = $vars['LINE_CHANNEL_ID']
$channelSecret = $vars['LINE_CHANNEL_SECRET']

if (-not $channelId -or -not $channelSecret) {
  throw 'LINE_CHANNEL_ID / LINE_CHANNEL_SECRET is missing in bot\.env'
}

$response = Invoke-RestMethod `
  -Method Post `
  -Uri 'https://api.line.me/v2/oauth/accessToken' `
  -ContentType 'application/x-www-form-urlencoded' `
  -Body @{
    grant_type = 'client_credentials'
    client_id = $channelId
    client_secret = $channelSecret
  }

$token = $response.access_token
if (-not $token) {
  throw 'LINE token issue failed'
}

$botInfo = Invoke-RestMethod `
  -Uri 'https://api.line.me/v2/bot/info' `
  -Headers @{ Authorization = "Bearer $token" }

if (-not $botInfo.displayName) {
  throw 'LINE token verification failed'
}

Push-Location $workerDir
try {
  $token | npx wrangler secret put LINE_CHANNEL_TOKEN --name hojotown-api
}
finally {
  Pop-Location
}

$health = Invoke-RestMethod -Uri 'https://hojotown-api.taitatu4barisuta.workers.dev/health'
if (-not $health.worker -or -not $health.db -or -not $health.line_token) {
  throw "Worker health failed after token refresh: $($health | ConvertTo-Json -Compress)"
}

[pscustomobject]@{
  bot = $botInfo.displayName
  worker = $health.worker
  db = $health.db
  line_token = $health.line_token
  timestamp = $health.timestamp
} | ConvertTo-Json -Compress
