<#
Restart script for IPDash on Windows
Actions:
 - Kill any process listening on ports 3000 and 3001 (if found)
 - Kill any stray node.exe processes optionally (safe by prompt)
 - Start backend (server) in a new PowerShell window: runs npm start in server folder
 - Start frontend in a new PowerShell window: runs npm start in project root
 - Leaves the new windows open so logs are visible
#>

param(
  [switch]$ForceKillNode,
  [switch]$KeepOpen
)

function Write-Header {
  Write-Host "`n IPDash Restart Script" -ForegroundColor Cyan
  Write-Host "================================`n" -ForegroundColor Cyan
}

function Kill-PortProcesses {
  param([int]$Port)
  $found = $false
  try {
    $net = netstat -ano | Select-String ":${Port}\s"
    foreach ($line in $net) {
      $cols = ($line -split '\s+') -ne ''
      if ($cols.Length -ge 5) {
        $processId = $cols[-1]
        if ($processId -match '^[0-9]+$') {
          Write-Host "Killing process PID $processId listening on port $Port" -ForegroundColor Yellow
          Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
          $found = $true
        }
      }
    }
  } catch {
    Write-Host "Warning killing processes on port $Port : $_" -ForegroundColor DarkYellow
  }
  return $found
}

function Kill-NodeProcesses {
  param([switch]$force)
  $procs = Get-Process -Name node -ErrorAction SilentlyContinue
  if ($procs) {
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    return $true
  }
  return $false
}

function Start-AppWindow {
  param(
    [string]$Name,
    [string]$Dir,
    [string]$Command
  )
  if (-not (Test-Path -LiteralPath $Dir)) {
    Write-Host "Missing $Name directory: $Dir" -ForegroundColor Red
    return $false
  }

  $fullCmd = "cd '$Dir'; $Command;"
  if ($KeepOpen) { $arg = "-NoExit", "-Command", $fullCmd } else { $arg = "-Command", $fullCmd }

  Write-Host "Starting $Name in new window: $Command" -ForegroundColor Green
  Start-Process powershell -ArgumentList $arg -WindowStyle Normal
  return $true
}

try {
  $ErrorActionPreference = 'Stop'
  Write-Header

  # Resolve paths
  $root = Split-Path -Parent $PSCommandPath
  $backendDir = Join-Path $root 'server'
  $frontendDir = $root

  # Kill processes listening on ports first
  $k1 = Kill-PortProcesses -Port 3000
  $k2 = Kill-PortProcesses -Port 3001

  if (-not ($k1 -or $k2)) {
    # Always kill node processes if found, no prompt
    $null = Kill-NodeProcesses -force
  }

  Start-Sleep -Seconds 1

  # Start backend first
  $okBackend = $false
  if (Test-Path (Join-Path $backendDir 'package.json')) {
    $okBackend = Start-AppWindow -Name 'Backend' -Dir $backendDir -Command 'npm start'
  } else {
    Write-Host "Backend package.json not found, attempting direct node server.js" -ForegroundColor Yellow
    if (Test-Path (Join-Path $backendDir 'server.js')) {
      $okBackend = Start-AppWindow -Name 'Backend' -Dir $backendDir -Command 'node server.js'
    }
  }

  Start-Sleep -Seconds 2

  # Start frontend (check root first, then test js files)
  $okFrontend = $false
  $frontendPackageJson = Join-Path $frontendDir 'package.json'
  if (Test-Path $frontendPackageJson) {
    Write-Host "Found frontend package.json at: $frontendDir" -ForegroundColor Green
    $okFrontend = Start-AppWindow -Name 'Frontend' -Dir $frontendDir -Command 'npm start'
  } else {
    # Fallback to test js files
    $testFrontendDir = Join-Path $root 'test js files'
    $testPackageJson = Join-Path $testFrontendDir 'package.json'
    if (Test-Path $testPackageJson) {
      Write-Host "Frontend package.json not found in root, using: $testFrontendDir" -ForegroundColor Yellow
      $okFrontend = Start-AppWindow -Name 'Frontend' -Dir $testFrontendDir -Command 'npm start'
    } else {
      Write-Host "Frontend package.json not found in $frontendDir or $testFrontendDir" -ForegroundColor Red
      Write-Host "Expected: $(Join-Path $frontendDir 'package.json')" -ForegroundColor DarkCyan
    }
  }

  Write-Host "`nRestart commands issued." -ForegroundColor Cyan
  Write-Host "Backend started: $okBackend" -ForegroundColor DarkCyan
  Write-Host "Frontend started: $okFrontend" -ForegroundColor DarkCyan

} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host $_.Exception.StackTrace -ForegroundColor DarkGray
  exit 1
}

if ($KeepOpen) {
  Write-Host "`nPress any key to close this window..." -ForegroundColor Yellow
  $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}

exit 0
