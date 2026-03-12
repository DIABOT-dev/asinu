$ErrorActionPreference = 'Stop'

function FailStep($message) {
  Write-Host "FAIL: $message" -ForegroundColor Red
  exit 1
}

function PassStep($message) {
  Write-Host "PASS: $message" -ForegroundColor Green
}

$email = $Env:EMAIL
$password = $Env:PASSWORD

if (-not $email -or -not $password) {
  FailStep 'Missing EMAIL or PASSWORD environment variables.'
}

$baseUrl = $Env:API_BASE_URL
if (-not $baseUrl) {
  $baseUrl = 'https://asinu.top'
}

$loginUrl = "$baseUrl/api/auth/email/login"
$logsUrl = "$baseUrl/api/mobile/logs"
$recentUrl = "$baseUrl/api/mobile/logs/recent?type=care_pulse"

try {
  $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
  $loginResponse = curl -sS -X POST $loginUrl -H 'Content-Type: application/json' -d $loginBody | ConvertFrom-Json
  if (-not $loginResponse.token) {
    FailStep 'Login did not return a token.'
  }
  $token = $loginResponse.token
  PassStep 'Login succeeded.'
} catch {
  FailStep "Login request failed. $($_.Exception.Message)"
}

$timestamp = (Get-Date).ToUniversalTime().ToString('o')
$payload = @{
  log_type = 'care_pulse'
  occurred_at = $timestamp
  source = 'manual'
  metadata = @{ v = 1 }
  data = @{
    status = 'NORMAL'
    sub_status = $null
    trigger_source = 'HOME_WIDGET'
    escalation_sent = $false
    silence_count = 0
  }
} | ConvertTo-Json -Depth 6

try {
  $createResponse = curl -sS -X POST $logsUrl -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d $payload | ConvertFrom-Json
  if (-not $createResponse.log_id) {
    FailStep 'Create care_pulse log did not return log_id.'
  }
  $createdId = $createResponse.log_id
  PassStep 'Posted care_pulse log.'
} catch {
  FailStep "Post log failed. $($_.Exception.Message)"
}

try {
  $recentResponse = curl -sS -X GET $recentUrl -H "Authorization: Bearer $token" | ConvertFrom-Json
  if (-not $recentResponse) {
    FailStep 'Recent logs response was empty.'
  }
  if ($recentResponse -is [System.Array] -and $recentResponse.Count -gt 0) {
    $firstEntry = $recentResponse[0]
    $keys = @()
    foreach ($prop in $firstEntry.PSObject.Properties) {
      $keys += $prop.Name
    }
    Write-Host ("INFO: Recent log entry keys: " + ($keys -join ', '))
  }
  $found = $false
  foreach ($entry in $recentResponse) {
    if ($entry.log_id -eq $createdId -or $entry.id -eq $createdId) {
      $found = $true
      break
    }
  }
  if (-not $found) {
    FailStep 'Recent logs did not include the posted entry.'
  }
  PassStep 'Recent logs contain posted entry.'
} catch {
  FailStep "Fetch recent logs failed. $($_.Exception.Message)"
}

Write-Host 'PASS: Smoke test completed successfully.' -ForegroundColor Green
exit 0
