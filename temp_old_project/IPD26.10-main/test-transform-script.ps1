# Test Runner for Transform Script
# Creates a test Excel file and runs the transform script in test mode

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "AEBF Transform Script Test Runner" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if ImportExcel module is installed
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Host "Installing ImportExcel module..." -ForegroundColor Yellow
    Install-Module -Name ImportExcel -Scope CurrentUser -Force
}

Import-Module ImportExcel

# Create test data
Write-Host "`nCreating test Excel file..." -ForegroundColor Yellow

$testData = @(
    [PSCustomObject]@{
        year = 2024
        month = 1
        salesrepname = "John Doe"
        customername = "TEST CUSTOMER A"
        COUNTRYNAME = "USA"
        PGCombine = "SHRINK FILM"
        Material = "LDPE"
        Process = "BLOWN"
        values_type = "AMOUNT"
        Total = 15000.50
    },
    [PSCustomObject]@{
        year = 2024
        month = 1
        salesrepname = "John Doe"
        customername = "TEST CUSTOMER A"
        COUNTRYNAME = "USA"
        PGCombine = "SHRINK FILM"
        Material = "LDPE"
        Process = "BLOWN"
        values_type = "KGS"
        Total = 2500.75
    },
    [PSCustomObject]@{
        year = 2024
        month = 2
        salesrepname = "Jane Smith"
        customername = "TEST CUSTOMER B"
        COUNTRYNAME = "CANADA"
        PGCombine = "STRETCH FILM"
        Material = "LLDPE"
        Process = "CAST"
        values_type = "AMOUNT"
        Total = 22000.00
    },
    [PSCustomObject]@{
        year = 2024
        month = 2
        salesrepname = "Jane Smith"
        customername = "TEST CUSTOMER B"
        COUNTRYNAME = "CANADA"
        PGCombine = "STRETCH FILM"
        Material = "LLDPE"
        Process = "CAST"
        values_type = "KGS"
        Total = 3200.00
    },
    [PSCustomObject]@{
        year = 2024
        month = 3
        salesrepname = "Bob Wilson"
        customername = "TEST CUSTOMER C"
        COUNTRYNAME = "MEXICO"
        PGCombine = "BAGS"
        Material = "HDPE"
        Process = "EXTRUSION"
        values_type = "AMOUNT"
        Total = -1500.00  # Sales return (negative)
    }
)

$testFile = "test-aebf-upload.xlsx"
$testData | Export-Excel -Path $testFile -AutoSize -FreezeTopRow

Write-Host "Test Excel file created: $testFile" -ForegroundColor Green
Write-Host "Records: $($testData.Count)" -ForegroundColor Green

# Display test data
Write-Host "`nTest Data Preview:" -ForegroundColor Cyan
$testData | Format-Table -AutoSize

# Run transform script in TEST MODE
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "Running Transform Script (TEST MODE)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$scriptPath = "scripts\transform-actual-to-sql.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Script not found at $scriptPath" -ForegroundColor Red
    exit 1
}

# Test with UPSERT mode
Write-Host "`nTest 1: UPSERT Mode (Test)" -ForegroundColor Yellow
& $scriptPath -ExcelPath $testFile -Division "FP" -UploadMode "upsert" -UploadedBy "test.user" -TestMode

Write-Host "`nTest 2: REPLACE Mode (Test)" -ForegroundColor Yellow
& $scriptPath -ExcelPath $testFile -Division "FP" -UploadMode "replace" -UploadedBy "test.user" -TestMode

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "To run actual upload (not test mode):" -ForegroundColor Yellow
Write-Host "  .\scripts\transform-actual-to-sql.ps1 -ExcelPath '$testFile' -Division 'FP' -UploadMode 'upsert' -UploadedBy 'your.name'" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
