#Requires -Version 5.1
# Script to create a Windows desktop shortcut for Restart-Servers.bat

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Restart-Servers.lnk"
$ScriptRoot = Split-Path -Parent $PSCommandPath
$TargetPath = Join-Path $ScriptRoot "Restart-Servers.bat"

# Create a shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ScriptRoot
$Shortcut.Description = "Restart IPDash Servers (Backend on 3001 + Frontend on 3000)"
$Shortcut.IconLocation = "C:\Windows\System32\cmd.exe,0"
$Shortcut.Save()

Write-Host "Shortcut created on Desktop: Restart-Servers.lnk" -ForegroundColor Green
Write-Host "  Target: $TargetPath" -ForegroundColor Cyan
Write-Host "  Working Directory: $ScriptRoot" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now double-click Restart-Servers on your desktop to restart both servers." -ForegroundColor Green
