Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " TradeFix Print Bridge for TSC TTP-244-Pro" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Listening on http://127.0.0.1:9190 / http://localhost:9190" -ForegroundColor Green
Write-Host "Direct USB printing to TSC TTP-244 Pro is active." -ForegroundColor Green
& "$PSScriptRoot\tradefix-print-bridge.exe"

