# ============================================================
# PostgreSQL Database Backup Script
# Creates a complete backup of the fp_database
# ============================================================

param(
    [string]$Format = "custom",  # Options: "plain", "custom", "tar"
    [string]$BackupDir = "backups\database",
    [switch]$Compress = $true
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Info { Write-ColorOutput Cyan $args }
function Write-Warning { Write-ColorOutput Yellow $args }

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Info "============================================"
Write-Info "PostgreSQL Database Backup Script"
Write-Info "============================================"
Write-Output ""

# Check if pg_dump is available
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    # Try common PostgreSQL installation paths
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $pgDumpPath = $path
            break
        }
    }
    
    if (-not $pgDumpPath) {
        Write-Error "❌ pg_dump not found!"
        Write-Error "Please ensure PostgreSQL is installed and pg_dump is in your PATH"
        Write-Error "Or install PostgreSQL from: https://www.postgresql.org/download/windows/"
        exit 1
    }
} else {
    $pgDumpPath = $pgDumpPath.Source
}

Write-Success "✅ Found pg_dump at: $pgDumpPath"
Write-Output ""

# Load environment variables from .env file
$envFile = Join-Path $ScriptDir ".env"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $ScriptDir "server\.env"
}

$dbUser = "postgres"
$dbHost = "localhost"
$dbPort = "5432"
$dbPassword = ""
$dbName = "fp_database"

# Try to read .env file
if (Test-Path $envFile) {
    Write-Info "📄 Reading configuration from: $envFile"
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^DB_USER=(.+)$") {
            $dbUser = $matches[1].Trim()
        } elseif ($_ -match "^DB_HOST=(.+)$") {
            $dbHost = $matches[1].Trim()
        } elseif ($_ -match "^DB_PORT=(.+)$") {
            $dbPort = $matches[1].Trim()
        } elseif ($_ -match "^DB_PASSWORD=(.+)$") {
            $dbPassword = $matches[1].Trim()
        } elseif ($_ -match "^DB_NAME=(.+)$") {
            $dbName = $matches[1].Trim()
        }
    }
    Write-Success "✅ Configuration loaded from .env"
} else {
    Write-Warning "⚠️ .env file not found, using default values"
    Write-Warning "   Create a .env file in the project root with:"
    Write-Warning "   DB_HOST=localhost"
    Write-Warning "   DB_PORT=5432"
    Write-Warning "   DB_USER=postgres"
    Write-Warning "   DB_PASSWORD=your_password"
    Write-Warning "   DB_NAME=fp_database"
}

Write-Output ""
Write-Info "Database Configuration:"
Write-Output "  Host: $dbHost"
Write-Output "  Port: $dbPort"
Write-Output "  User: $dbUser"
Write-Output "  Database: $dbName"
Write-Output "  Password: $(if ($dbPassword) { '***' } else { 'Not set - you may be prompted' })"
Write-Output ""

# Create backup directory if it doesn't exist
$backupPath = Join-Path $ScriptDir $BackupDir
if (-not (Test-Path $backupPath)) {
    New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
    Write-Success "✅ Created backup directory: $backupPath"
}

# Generate timestamp for backup file
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Determine backup file extension based on format
$extension = switch ($Format.ToLower()) {
    "plain" { ".sql" }
    "custom" { ".backup" }
    "tar" { ".tar" }
    default { ".backup" }
}

$backupFileName = "fp_database_backup_$timestamp$extension"
$backupFilePath = Join-Path $backupPath $backupFileName

Write-Output ""
Write-Info "Starting backup..."
Write-Info "  Format: $Format"
Write-Info "  Output: $backupFilePath"
Write-Output ""

# Set PGPASSWORD environment variable if password is provided
if ($dbPassword) {
    $env:PGPASSWORD = $dbPassword
}

try {
    # Build pg_dump command
    $dumpArgs = @(
        "-h", $dbHost
        "-p", $dbPort
        "-U", $dbUser
        "-d", $dbName
        "-F", $Format.Substring(0,1)  # F = format: p=plain, c=custom, t=tar
        "-f", $backupFilePath
        "-v"  # Verbose output
    )
    
    # Add compression for custom format (default behavior)
    if ($Format -eq "custom" -and $Compress) {
        $dumpArgs += "-Z", "9"  # Maximum compression
    }
    
    # For plain format, add additional options
    if ($Format -eq "plain") {
        $dumpArgs += "--clean", "--if-exists", "--create"
    }
    
    # Execute pg_dump
    Write-Info "Executing: pg_dump $($dumpArgs -join ' ')"
    Write-Output ""
    
    $process = Start-Process -FilePath $pgDumpPath -ArgumentList $dumpArgs -NoNewWindow -Wait -PassThru -RedirectStandardError "$backupPath\backup_$timestamp.log"
    
    if ($process.ExitCode -eq 0) {
        # Get backup file size
        if (Test-Path $backupFilePath) {
            $fileSize = (Get-Item $backupFilePath).Length
            $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
            
            Write-Output ""
            Write-Success "✅ Backup completed successfully!"
            Write-Success "   File: $backupFileName"
            Write-Success "   Size: $fileSizeMB MB"
            Write-Success "   Location: $backupFilePath"
            Write-Success "   Timestamp: $dateStr"
            
            # Create a metadata file
            $metadataFile = Join-Path $backupPath "backup_$timestamp.info"
            $metadata = @"
Backup Information
==================
Database: $dbName
Host: $dbHost
Port: $dbPort
User: $dbUser
Backup Date: $dateStr
Format: $Format
File: $backupFileName
Size: $fileSizeMB MB
Location: $backupFilePath
"@
            $metadata | Out-File -FilePath $metadataFile -Encoding UTF8
            
            Write-Output ""
            Write-Info "📋 Metadata saved to: backup_$timestamp.info"
            
            # List recent backups
            Write-Output ""
            Write-Info "Recent backups:"
            Get-ChildItem -Path $backupPath -Filter "fp_database_backup_*$extension" | 
                Sort-Object LastWriteTime -Descending | 
                Select-Object -First 5 | 
                ForEach-Object {
                    $sizeMB = [math]::Round($_.Length / 1MB, 2)
                    Write-Output "  $($_.Name) - $sizeMB MB - $($_.LastWriteTime)"
                }
        } else {
            Write-Error "❌ Backup file was not created!"
            exit 1
        }
    } else {
        Write-Error "❌ Backup failed with exit code: $($process.ExitCode)"
        if (Test-Path "$backupPath\backup_$timestamp.log") {
            Write-Error "Error log:"
            Get-Content "$backupPath\backup_$timestamp.log" | ForEach-Object { Write-Error "  $_" }
        }
        exit 1
    }
} catch {
    Write-Error "❌ Error during backup: $_"
    exit 1
} finally {
    # Clear password from environment
    if ($dbPassword) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Output ""
Write-Info "============================================"
Write-Success "Backup process completed!"
Write-Info "============================================"

















