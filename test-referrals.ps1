#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$API = 'http://localhost:4000'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$shortTs = ($ts.ToString()).Substring(($ts.ToString()).Length - 6)

function Invoke-Api {
  param([string]$Method, [string]$Path, $Body, [string]$Cookies)
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($Cookies) { $headers['Cookie'] = $Cookies }
  $params = @{ Method = $Method; Uri = "$API$Path"; Headers = $headers; SessionVariable = 'sess' }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
  return Invoke-RestMethod @params
}

# 1. Register referrer
$referrerEmail = "ref-r-$ts@test.com"
$referrerReg = Invoke-WebRequest -Method Post -Uri "$API/auth/register" -ContentType 'application/json' `
  -Body (@{
    email = $referrerEmail; phone = "+99450$shortTs"; password = 'TestPass1!';
    username = "refr$ts"; locale = 'ru'; ageConfirmed = $true; termsAccepted = $true
  } | ConvertTo-Json -Compress) -SessionVariable refSess
$referrerCode = ($referrerReg.Content | ConvertFrom-Json).user.referralCode
Write-Host "[1] referrer registered, code=$referrerCode"

# 2. Register referred with that referralCode
$referredEmail = "ref-d-$ts@test.com"
$referredReg = Invoke-WebRequest -Method Post -Uri "$API/auth/register" -ContentType 'application/json' `
  -Body (@{
    email = $referredEmail; phone = "+99451$shortTs"; password = 'TestPass1!';
    username = "refd$ts"; locale = 'ru'; ageConfirmed = $true; termsAccepted = $true;
    referralCode = $referrerCode
  } | ConvertTo-Json -Compress) -SessionVariable refdSess
$referredUser = ($referredReg.Content | ConvertFrom-Json).user
Write-Host "[2] referred registered id=$($referredUser.id)"

# 3. Seed balance for referred
$sql = "UPDATE `"User`" SET `"balanceMinor`"=1000000 WHERE email='$referredEmail';"
$sql | docker compose exec -T postgres psql -U chcgreen -d chcgreen | Out-Null
Write-Host "[3] referred balance set to 10000.00 AZN"

# 4. Get current roulette round, wait until BETTING
$state = Invoke-RestMethod -Uri "$API/roulette/state"
Write-Host "[4] roulette round status=$($state.round.status) id=$($state.round.id)"

# 5. Place a losing bet — bet 1000 on GREEN (small chance, but we'll just observe the outcome)
# Better: bet on RED, BLACK, AND GREEN with small amount so something always loses
Write-Host "[5] placing 3 bets: 1000 BLACK, 1000 RED, 1000 GREEN"
foreach ($color in 'BLACK','RED','GREEN') {
  try {
    Invoke-RestMethod -Method Post -Uri "$API/roulette/bets" -ContentType 'application/json' `
      -WebSession $refdSess -Body (@{ color = $color; amountMinor = '1000' } | ConvertTo-Json -Compress) | Out-Null
    Write-Host "  placed $color"
  } catch {
    Write-Host "  failed $color : $($_.Exception.Message)"
  }
}

# 6. Wait for round to complete
Write-Host "[6] waiting up to 60s for round completion..."
$roundId = $state.round.id
$completed = $false
for ($i=0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $s = Invoke-RestMethod -Uri "$API/roulette/state"
  if ($s.round.id -ne $roundId) {
    Write-Host "  new round started -> previous round completed"
    $completed = $true; break
  }
}
if (-not $completed) { throw "Round did not complete in time" }

# 7. Check referrer summary
$summary = Invoke-RestMethod -Uri "$API/referrals/me" -WebSession $refSess
Write-Host "[7] referrer summary: count=$($summary.referralsCount), total=$($summary.totalEarningsMinor)"

# 8. Check earnings list
$earnings = Invoke-RestMethod -Uri "$API/referrals/earnings?limit=10" -WebSession $refSess
Write-Host "[8] earnings count=$($earnings.items.Count)"
foreach ($e in $earnings.items) {
  Write-Host "  kind=$($e.kind) source=$($e.sourceAmountMinor) earning=$($e.earningMinor) rateBps=$($e.rateBps)"
}

# 9. Check transactions on referrer
$txSql = "SELECT type, `"amountMinor`", `"idempotencyKey`" FROM `"Transaction`" WHERE `"userId`"='$($referrerReg.Content | ConvertFrom-Json | Select-Object -ExpandProperty user | Select-Object -ExpandProperty id)' ORDER BY `"createdAt`" DESC LIMIT 5;"
Write-Host "[9] referrer recent transactions:"
$txSql | docker compose exec -T postgres psql -U chcgreen -d chcgreen

if ($summary.referralsCount -ne 1) { throw "Expected referralsCount=1, got $($summary.referralsCount)" }
if ($earnings.items.Count -lt 2) { throw "Expected at least 2 earnings (1 win + 2 losses or 3 losses), got $($earnings.items.Count)" }

Write-Host ""
Write-Host "=== Referrals E2E PASSED ==="
