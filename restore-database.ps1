# ============================================================
# PostgreSQL Database Restore Script
# Restores a database backup created with backup-database.ps1
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [string]$DatabaseName = "fp_database",
    [switch]$CreateDatabase = $true
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
Write-Info "PostgreSQL Database Restore Script"
Write-Info "============================================"
Write-Output ""

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    # Try relative to backup directory
    $BackupFile = Join-Path (Join-Path $ScriptDir "backups\database") $BackupFile
    if (-not (Test-Path $BackupFile)) {
        Write-Error "❌ Backup file not found: $BackupFile"
        exit 1
    }
}

Write-Success "✅ Found backup file: $BackupFile"

# Check if pg_restore or psql is available
$pgRestorePath = Get-Command pg_restore -ErrorAction SilentlyContinue
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $pgRestorePath -and -not $psqlPath) {
    # Try common PostgreSQL installation paths
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\16\bin",
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin",
        "C:\Program Files\PostgreSQL\13\bin"
    )
    
    foreach $pgBin in $commonPaths {
        if (Test-Path "$pgBin\pg_restore.exe") {
            $pgRestorePath = "$pgBin\pg_restore.exe"
            $psqlPath = "$pgBin\psql.exe"
            break
        }
    }
    
    if (-not $pgRestorePath -and -not $psqlPath) {
        Write-Error "❌ pg_restore/psql not found!"
        Write-Error "Please ensure PostgreSQL is installed"
        exit 1
    }
} else {
    if (-not $pgRestorePath) { $pgRestorePath = (Get-Command pg_restore).Source }
    if (-not $psqlPath) { $psqlPath = (Get-Command psql).Source }
}

# Determine restore method based on file extension
$extension = [System.IO.Path]::GetExtension($BackupFile).ToLower()
$usePgRestore = $false

switch ($extension) {
    ".backup" { $usePgRestore = $true }
    ".tar" { $usePgRestore = $true }
    ".sql" { $usePgRestore = $false }
    default {
        Write-Warning "Unknown file extension, attempting pg_restore..."
        $usePgRestore = $true
    }
}

# Load environment variables from .env file
$envFile = Join-Path $ScriptDir ".env"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $ScriptDir "server\.env"
}

$dbUser = "postgres"
$dbHost = "localhost"
$dbPort = "5432"
$dbPassword = ""

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
        } elseif ($_ -match "^DB_NAME=(.+)$" -and -not $PSBoundParameters.ContainsKey('DatabaseName')) {
            $DatabaseName = $matches[1].Trim()
        }
    }
}

Write-Output ""
Write-Info "Database Configuration:"
Write-Output "  Host: $dbHost"
Write-Output "  Port: $dbPort"
Write-Output "  User: $dbUser"
Write-Output "  Target Database: $DatabaseName"
Write-Output ""

# Confirm before proceeding
Write-Warning "⚠️  WARNING: This will OVERWRITE the existing database!"
Write-Warning "   Database: $DatabaseName"
Write-Warning "   Backup: $BackupFile"
Write-Output ""
$confirm = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Info "Restore cancelled."
    exit 0
}

# Set PGPASSWORD environment variable
if ($dbPassword) {
    $env:PGPASSWORD = $dbPassword
}

try {
    if ($CreateDatabase) {
        Write-Info "Checking if database exists..."
        $checkDbArgs = @("-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-l", "-t")
        $databases = & $psqlPath $checkDbArgs 2>&1
        
        if ($databases -match $DatabaseName) {
            Write-Warning "Database '$DatabaseName' already exists."
            
            # Drop existing connections
            Write-Info "Dropping existing connections..."
            $dropConnArgs = @(
                "-h", $dbHost,
                "-p", $dbPort,
                "-U", $dbUser,
                "-d", "postgres",
                "-c", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DatabaseName' AND pid <> pg_backend_pid();"
            )
            & $psqlPath $dropConnArgs 2>&1 | Out-Null
            
            # Drop database
            Write-Info "Dropping database '$DatabaseName'..."
            $dropDbArgs = @(
                "-h", $dbHost,
                "-p", $dbPort,
                "-U", $dbUser,
                "-d", "postgres",
                "-c", "DROP DATABASE IF EXISTS `"$DatabaseName`";"
            )
            & $psqlPath $dropDbArgs 2>&1 | Out-Null
        }
        
        # Create database
        Write-Info "Creating database '$DatabaseName'..."
        $createDbArgs = @(
            "-h", $dbHost,
            "-p", $dbPort,
            "-U", $dbUser,
            "-d", "postgres",
            "-c", "CREATE DATABASE `"$DatabaseName`";"
        )
        $result = & $psqlPath $createDbArgs 2>&1
        if ($LASTEXITCODE -ne 0 -and $result -notmatch "already exists") {
            throw "Failed to create database: $result"
        }
        Write-Success "✅ Database created"
    }
    
    Write-Output ""
    Write-Info "Starting restore..."
    
    if ($usePgRestore) {
        Write-Info "Using pg_restore (custom/tar format)..."
        $restoreArgs = @(
            "-h", $dbHost,
            "-p", $dbPort,
            "-U", $dbUser,
            "-d", $DatabaseName,
            "-v",
            "--clean",
            "--if-exists",
            $BackupFile
        )
        $result = & $pgRestorePath $restoreArgs 2>&1
    } else {
        Write-Info "Using psql (SQL format)..."
        $restoreArgs = @(
            "-h", $dbHost,
            "-p", $dbPort,
            "-U", $dbUser,
            "-d", $DatabaseName,
            "-f", $BackupFile
        )
        $result = & $psqlPath $restoreArgs 2>&1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Output ""
        Write-Success "✅ Database restored successfully!"
        Write-Success "   Database: $DatabaseName"
        Write-Success "   From: $BackupFile"
    } else {
        throw "Restore failed: $result"
    }
} catch {
    Write-Error "❌ Error during restore: $_"
    exit 1
} finally {
    if ($dbPassword) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Output ""
Write-Info "============================================"
Write-Success "Restore process completed!"
Write-Info "============================================"

















