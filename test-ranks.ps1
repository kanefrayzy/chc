#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$API = 'http://localhost:4000'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$shortTs = ($ts.ToString()).Substring(($ts.ToString()).Length - 6)

# 1. Public list
$list = Invoke-RestMethod -Uri "$API/ranks"
Write-Host "[1] /ranks returned $($list.items.Count) ranks"
foreach ($r in $list.items) { Write-Host "    #$($r.order) $($r.slug) min=$($r.minWageredMinor)" }
if ($list.items.Count -ne 7) { throw "Expected 7 ranks, got $($list.items.Count)" }

# 2. Register a fresh user and check /ranks/me with totalWagered=0
$email = "rk-$shortTs@test.com"
$reg = Invoke-WebRequest -Method Post -Uri "$API/auth/register" -ContentType 'application/json' -UseBasicParsing `
  -Body (@{
    email = $email; phone = "+99452$shortTs"; password = 'TestPass1!';
    username = "rk$shortTs"; locale = 'ru'; ageConfirmed = $true; termsAccepted = $true
  } | ConvertTo-Json -Compress) -SessionVariable sess
Write-Host "[2] registered $email"

$me0 = Invoke-RestMethod -Uri "$API/ranks/me" -WebSession $sess
Write-Host "[3] /ranks/me initial: current=$($me0.current.slug) next=$($me0.next.slug) wagered=$($me0.totalWageredMinor) bps=$($me0.progressBps)"
if ($me0.current.slug -ne 'novice') { throw "Expected novice, got $($me0.current.slug)" }
if ($me0.next.slug -ne 'amateur') { throw "Expected next=amateur, got $($me0.next.slug)" }

# 3. Seed balance and place a bet to trigger rank sync
$sql = "UPDATE `"User`" SET `"balanceMinor`"=2000000 WHERE email='$email';"
$sql | docker compose exec -T postgres psql -U chcgreen -d chcgreen | Out-Null

# Wait for BETTING phase
for ($i=0; $i -lt 30; $i++) {
  $st = Invoke-RestMethod -Uri "$API/roulette/state"
  if ($st.round.status -eq 'BETTING') { break }
  Start-Sleep -Seconds 1
}

# Place a 15000 minor bet — should jump rank to "amateur" (>=10000)
Invoke-RestMethod -Method Post -Uri "$API/roulette/bets" -ContentType 'application/json' -WebSession $sess `
  -Body (@{ color = 'BLACK'; amountMinor = '15000' } | ConvertTo-Json -Compress) | Out-Null
Write-Host "[4] placed 15000 BLACK bet"

$me1 = Invoke-RestMethod -Uri "$API/ranks/me" -WebSession $sess
Write-Host "[5] /ranks/me after bet: current=$($me1.current.slug) next=$($me1.next.slug) wagered=$($me1.totalWageredMinor) bps=$($me1.progressBps)"
if ($me1.current.slug -ne 'amateur') { throw "Expected amateur after 15000 wagered, got $($me1.current.slug)" }
if ($me1.next.slug -ne 'experienced') { throw "Expected next=experienced, got $($me1.next.slug)" }
if ($me1.progressBps -le 0) { throw "Expected progressBps > 0" }

Write-Host ""
Write-Host "=== Ranks E2E PASSED ==="
