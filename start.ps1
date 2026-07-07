# RythuMitra - Full Stack Startup Script
# Run this ONCE to start everything: backend + frontend + ngrok tunnel

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$NGROK = "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  RythuMitra - Starting All Services" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Kill any existing node processes
Write-Host "`n[1/3] Cleaning up old processes..." -ForegroundColor Yellow
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start Backend
Write-Host "[2/3] Starting Backend API (port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\server'; node server.js" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[3/3] Starting Frontend Dashboard (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\client'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start ngrok tunnel
Write-Host "[4/4] Starting ngrok tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$NGROK' http --url=wobble-colt-length.ngrok-free.dev 5000" -WindowStyle Normal

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  All services started!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Admin Dashboard : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API     : http://localhost:5000" -ForegroundColor White
Write-Host "  WhatsApp Webhook: https://wobble-colt-length.ngrok-free.dev/api/twilio/webhook" -ForegroundColor White
Write-Host ""
Write-Host "  Send 'hello' on WhatsApp to test the bot!" -ForegroundColor Green
Write-Host ""
