$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000'

$rand = Get-Random -Minimum 1000 -Maximum 9999
$email = "chat_$rand@example.com"
$phone = "+99450$($rand.ToString().PadLeft(7,'0'))"
$pw = 'Passw0rd!1'

Write-Host "==> register $email" -ForegroundColor Cyan
$reg = Invoke-RestMethod -Uri "$base/auth/register" -Method POST -ContentType 'application/json' `
  -SessionVariable sess -Body (@{ email=$email; phone=$phone; password=$pw; username="chat$rand"; locale='ru'; ageConfirmed=$true; termsAccepted=$true } | ConvertTo-Json)

Write-Host "==> seed wallet via psql" -ForegroundColor Cyan
$sql = 'UPDATE "User" SET "balanceMinor"=100000 WHERE email=''' + $email + ''';'
$sql | docker compose exec -T postgres psql -U chcgreen -d chcgreen | Out-Null

Write-Host "==> balance" -ForegroundColor Cyan
$bal = Invoke-RestMethod -Uri "$base/wallet/balance" -WebSession $sess
$bal | ConvertTo-Json

Write-Host "==> POST /code-purchases amountMinor=10000" -ForegroundColor Cyan
$cp = Invoke-RestMethod -Uri "$base/code-purchases" -Method POST -ContentType 'application/json' -WebSession $sess `
  -Body (@{ amountMinor='10000'; comment='test purchase' } | ConvertTo-Json)
$cp | ConvertTo-Json

$ticketId = $cp.ticketId
Write-Host "==> GET /tickets" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/tickets" -WebSession $sess) | ConvertTo-Json -Depth 5

Write-Host "==> GET /tickets/$ticketId/messages" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/tickets/$ticketId/messages" -WebSession $sess) | ConvertTo-Json -Depth 5

Write-Host "==> POST /tickets/$ticketId/messages body=hi" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/tickets/$ticketId/messages" -Method POST -ContentType 'application/json' -WebSession $sess `
  -Body (@{ body='hi from user' } | ConvertTo-Json)) | ConvertTo-Json -Depth 5

Write-Host "==> balance after hold" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/balance" -WebSession $sess) | ConvertTo-Json

Write-Host "==> POST /code-purchases/$($cp.id)/cancel" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/code-purchases/$($cp.id)/cancel" -Method POST -WebSession $sess) | ConvertTo-Json -Depth 5

Write-Host "==> balance after cancel" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/balance" -WebSession $sess) | ConvertTo-Json

Write-Host "==> wallet transactions" -ForegroundColor Cyan
(Invoke-RestMethod -Uri "$base/wallet/transactions?limit=10" -WebSession $sess) | ConvertTo-Json -Depth 5
