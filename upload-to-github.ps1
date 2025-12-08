# Upload to GitHub Script
# Automates git add, commit, and push to https://github.com/camsalloum/IPD06.12.git

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Upload to GitHub (IPD06.12)  " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Change to the project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "[ERROR] Not a git repository!" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Show current status
Write-Host "Current changes:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Ask for commit message
Write-Host "Enter commit message (or press Enter for default): " -ForegroundColor Green -NoNewline
$commitMessage = Read-Host

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Write-Host "Using default message: $commitMessage" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Staging all changes..." -ForegroundColor Yellow
git add .

Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[WARNING] Nothing to commit or commit failed" -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "Repository: https://github.com/camsalloum/IPD06.12.git" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "[ERROR] Failed to push to GitHub" -ForegroundColor Red
    Write-Host "Please check your internet connection and GitHub credentials" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
