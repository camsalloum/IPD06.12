# Restart IPDashboard Servers
# This script stops both frontend and backend servers, then starts them fresh

Write-Host "🔄 Restarting IPDashboard Servers..." -ForegroundColor Cyan
Write-Host ""

# Kill existing Node processes related to the project
Write-Host "🛑 Stopping existing servers..." -ForegroundColor Yellow

# Kill React development server (typically runs on port 3000)
$reactProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($reactProcess) {
    foreach ($procId in $reactProcess) {
        Write-Host "  ├─ Stopping React frontend (PID: $procId)" -ForegroundColor Gray
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

# Kill backend server (typically runs on port 3001)
$backendProcess = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($backendProcess) {
    foreach ($procId in $backendProcess) {
        Write-Host "  ├─ Stopping backend server (PID: $procId)" -ForegroundColor Gray
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

# Wait a moment for ports to be released
Start-Sleep -Seconds 2

Write-Host "✅ Servers stopped" -ForegroundColor Green
Write-Host ""

# Start backend server in a new PowerShell window
Write-Host "🚀 Starting backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; Write-Host '🔧 Backend Server' -ForegroundColor Magenta; node index.js"

# Wait a moment for backend to initialize
Start-Sleep -Seconds 3

# Start frontend server in a new PowerShell window (with BROWSER=none to prevent auto-open)
Write-Host "🚀 Starting frontend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; Write-Host '⚛️  Frontend Server' -ForegroundColor Blue; `$env:BROWSER='none'; npm start"

Write-Host ""
Write-Host "✅ Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "📍 Backend:  http://localhost:3001" -ForegroundColor White
Write-Host ""

# Wait for frontend to start (React takes longer)
Write-Host "⏳ Waiting for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verify both servers are running
$backendRunning = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
$frontendRunning = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($backendRunning) { Write-Host "✅ Backend running on port 3001" -ForegroundColor Green }
if ($frontendRunning) { Write-Host "✅ Frontend running on port 3000" -ForegroundColor Green }

# Open browser
if ($frontendRunning) {
    Write-Host "🌐 Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
} else {
    Write-Host "⚠️  Frontend still starting, check the frontend window" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
