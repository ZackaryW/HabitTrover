param(
  [string]$BaseUrl = 'http://localhost:3000/api/v1',
  [string]$Token = 'your-admin-api-token-here'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
Runs a live API v1 smoke test against a HabitTrove instance.

.DESCRIPTION
Scope: quick local verification of admin authentication, habit CRUD-like actions,
coin side effects, undo behavior, and cleanup for a running Docker container.
#>
function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter()]
    [object]$Body
  )

  $headers = @{ Authorization = "Bearer $Token" }
  $request = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
  }

  if ($PSBoundParameters.ContainsKey('Body')) {
    $request.ContentType = 'application/json'
    $request.Body = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
  }

  return Invoke-RestMethod @request
}

<#
.SYNOPSIS
Throws when an API response is not successful.

.DESCRIPTION
Scope: fail-fast validation for the shared `{ ok, data|error }` API response envelope.
#>
function Assert-ApiOk {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Response,

    [Parameter(Mandatory = $true)]
    [string]$Step
  )

  if (-not $Response.ok) {
    $serialized = $Response | ConvertTo-Json -Depth 10
    throw "Step '$Step' failed: $serialized"
  }
}

<#
.SYNOPSIS
Writes a concise progress line for a smoke-test step.

.DESCRIPTION
Scope: human-readable execution trace for local test runs.
#>
function Write-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-Host "==> $Message"
}

$smokeHabitName = 'API smoke habit ' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$createdHabitId = $null

try {
  Write-Step 'Checking admin authentication via GET /users'
  $usersResponse = Invoke-ApiJson -Method 'GET' -Uri "$BaseUrl/users"
  Assert-ApiOk -Response $usersResponse -Step 'GET /users'

  Write-Step 'Creating a smoke-test habit via POST /habits'
  $createResponse = Invoke-ApiJson -Method 'POST' -Uri "$BaseUrl/habits" -Body @{
    name = $smokeHabitName
    description = 'Created from PowerShell smoke test'
    frequency = 'daily'
    coinReward = 3
  }
  Assert-ApiOk -Response $createResponse -Step 'POST /habits'
  $createdHabitId = $createResponse.data.habit.id

  Write-Step 'Reading habits via GET /habits'
  $habitsResponse = Invoke-ApiJson -Method 'GET' -Uri "$BaseUrl/habits?limit=20"
  Assert-ApiOk -Response $habitsResponse -Step 'GET /habits'

  $createdHabit = $habitsResponse.data.habits | Where-Object { $_.id -eq $createdHabitId } | Select-Object -First 1
  if (-not $createdHabit) {
    throw 'Created habit was not returned by GET /habits.'
  }

  Write-Step 'Completing the habit via POST /habits/{id}/complete'
  $completeResponse = Invoke-ApiJson -Method 'POST' -Uri "$BaseUrl/habits/$createdHabitId/complete" -Body @{}
  Assert-ApiOk -Response $completeResponse -Step 'POST /habits/{id}/complete'

  Write-Step 'Checking coin balance via GET /coins'
  $coinsAfterComplete = Invoke-ApiJson -Method 'GET' -Uri "$BaseUrl/coins"
  Assert-ApiOk -Response $coinsAfterComplete -Step 'GET /coins after complete'

  if ($coinsAfterComplete.data.coins.balance -lt 3) {
    throw 'Coin balance did not increase after habit completion.'
  }

  Write-Step 'Undoing the completion via POST /habits/{id}/undo'
  $undoResponse = Invoke-ApiJson -Method 'POST' -Uri "$BaseUrl/habits/$createdHabitId/undo" -Body @{}
  Assert-ApiOk -Response $undoResponse -Step 'POST /habits/{id}/undo'

  Write-Step 'Checking coin balance again via GET /coins'
  $coinsAfterUndo = Invoke-ApiJson -Method 'GET' -Uri "$BaseUrl/coins"
  Assert-ApiOk -Response $coinsAfterUndo -Step 'GET /coins after undo'

  Write-Step 'Deleting the smoke-test habit via DELETE /habits/{id}'
  $deleteResponse = Invoke-ApiJson -Method 'DELETE' -Uri "$BaseUrl/habits/$createdHabitId"
  Assert-ApiOk -Response $deleteResponse -Step 'DELETE /habits/{id}'
  $createdHabitId = $null

  [ordered]@{
    ok = $true
    baseUrl = $BaseUrl
    habitName = $smokeHabitName
    adminUserCount = @($usersResponse.data.users).Count
    coinsAfterComplete = $coinsAfterComplete.data.coins.balance
    coinsAfterUndo = $coinsAfterUndo.data.coins.balance
    deleted = $deleteResponse.data.deleted
  } | ConvertTo-Json -Depth 10
}
catch {
  Write-Error $_

  if ($createdHabitId) {
    try {
      Write-Step 'Attempting cleanup of smoke-test habit after failure'
      $null = Invoke-ApiJson -Method 'DELETE' -Uri "$BaseUrl/habits/$createdHabitId"
    }
    catch {
      Write-Warning "Cleanup failed for habit id ${createdHabitId}: $($_.Exception.Message)"
    }
  }

  exit 1
}