$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000'
$rand = Get-Random -Minimum 1000 -Maximum 9999
$email = "roul_$rand@example.com"
$phone = "+99450$($rand.ToString().PadLeft(7,'0'))"
$pw = 'Passw0rd!1'

Write-Host "==> register $email" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/auth/register" -Method POST -ContentType 'application/json' `
  -SessionVariable sess -Body (@{ email=$email; phone=$phone; password=$pw; username="roul$rand"; locale='ru'; ageConfirmed=$true; termsAccepted=$true } | ConvertTo-Json) | Out-Null

Write-Host "==> seed balance via psql" -ForegroundColor Cyan
$sql = 'UPDATE "User" SET "balanceMinor"=100000 WHERE email=''' + $email + ''';'
$sql | docker compose exec -T postgres psql -U chcgreen -d chcgreen | Out-Null

Write-Host "==> initial state" -ForegroundColor Cyan
$state1 = Invoke-RestMethod -Uri "$base/roulette/state"
$state1.round | Format-List id, status, bettingEndsAt, winningColor

if ($state1.round.status -ne 'BETTING') {
  Write-Host "Waiting for BETTING phase (status=$($state1.round.status))..." -ForegroundColor Yellow
  $deadline = (Get-Date).AddSeconds(40)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $state1 = Invoke-RestMethod -Uri "$base/roulette/state"
    if ($state1.round.status -eq 'BETTING') { break }
  }
}
$roundId = $state1.round.id
Write-Host "Active round: $roundId" -ForegroundColor Green

Write-Host "==> place bet 500 minor on RED" -ForegroundColor Cyan
$bet1 = Invoke-RestMethod -Uri "$base/roulette/bets" -Method POST -ContentType 'application/json' `
  -WebSession $sess -Body (@{ color='RED'; amountMinor='500' } | ConvertTo-Json)
$bet1 | ConvertTo-Json

Write-Host "==> place bet 300 minor on BLACK" -ForegroundColor Cyan
$bet2 = Invoke-RestMethod -Uri "$base/roulette/bets" -Method POST -ContentType 'application/json' `
  -WebSession $sess -Body (@{ color='BLACK'; amountMinor='300' } | ConvertTo-Json)
$bet2 | ConvertTo-Json

Write-Host "==> balance after bets" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/balance" -WebSession $sess) | ConvertTo-Json

Write-Host "==> wait for round to complete..." -ForegroundColor Yellow
$deadline = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  $cur = Invoke-RestMethod -Uri "$base/roulette/state"
  Write-Host "   state=$($cur.round.status)" -ForegroundColor DarkGray
  $hist = Invoke-RestMethod -Uri "$base/roulette/history?limit=5"
  $finished = $hist.items | Where-Object { $_.id -eq $roundId }
  if ($finished) {
    Write-Host "==> round $roundId completed: slot=$($finished.winningSlot) color=$($finished.winningColor)" -ForegroundColor Green
    $finished | ConvertTo-Json -Depth 4
    break
  }
}

Write-Host "==> my bets" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/roulette/my-bets" -WebSession $sess) | ConvertTo-Json -Depth 5

Write-Host "==> final balance" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/balance" -WebSession $sess) | ConvertTo-Json

Write-Host "==> transactions" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/transactions?limit=10" -WebSession $sess).items |
  Select-Object type, status, amountMinor, balanceAfterMinor, description | Format-Table -AutoSize
