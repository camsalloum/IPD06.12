#Requires -Version 5.1
<#
.SYNOPSIS
    Transform Excel Budget data to SQL and upload to PostgreSQL database
    Step 5: PowerShell Transform Script

.DESCRIPTION
    Reads Excel file (10 columns), maps columns, normalizes data, and uploads to fp_data_excel table
    Supports two modes: UPSERT (update existing) and REPLACE (complete replacement with backup)
    
    DATABASE: public.fp_data_excel (type='Budget')
    
    MODES:
    - UPSERT: Deletes overlapping year/month records, then inserts from Excel
    - REPLACE: Deletes ALL existing Budget data for division/year, then inserts ONLY data from Excel

.PARAMETER ExcelPath
    Path to the Excel file (.xlsx)

.PARAMETER Division
    Division code (FP, SB, TF, HCM)

.PARAMETER UploadMode
    Upload mode: 'upsert' or 'replace'
    - UPSERT: Deletes records for years/months in Excel, then inserts Excel data (keeps other years/months)
    - REPLACE: Deletes ALL Budget data for division/year, then inserts ONLY Excel data (WARNING: data loss for years/months not in Excel)

.PARAMETER UploadedBy
    Username of the person uploading (for audit trail)

.PARAMETER TestMode
    If specified, validates data but doesn't upload to database

.EXAMPLE
    .\transform-budget-to-sql.ps1 -ExcelPath "fp_budget_2025.xlsx" -Division "FP" -UploadMode "replace" -UploadedBy "john.doe"

.EXAMPLE
    .\transform-budget-to-sql.ps1 -ExcelPath "fp_budget_2025.xlsx" -Division "FP" -UploadMode "replace" -UploadedBy "admin" -TestMode

.NOTES
    Author: IPDashboard Team
    Date: 2025-11-13
    Version: 1.0
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ExcelPath,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet('FP', 'SB', 'TF', 'HCM')]
    [string]$Division,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('upsert', 'replace')]
    [string]$UploadMode = 'upsert',
    
    [Parameter(Mandatory=$true)]
    [string]$UploadedBy,
    
    [Parameter(Mandatory=$false)]
    [string]$SelectiveYearMonths,  # Comma-separated list like "2025-1,2025-2,2025-3"
    
    [Parameter(Mandatory=$false)]
    [switch]$TestMode
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# PostgreSQL connection details (prefer environment variables; fall back to defaults)
$PG_HOST = $env:PG_HOST -or "localhost"
$PG_PORT = $env:PG_PORT -or "5432"
$PG_DATABASE = $env:PG_DATABASE -or "fp_database"
$PG_USER = $env:PG_USER -or "postgres"
$PG_PASSWORD = $env:PG_PASSWORD -or "654883"
$PSQL_PATH = $env:PSQL_PATH -or "C:\Program Files\PostgreSQL\17\bin\psql.exe"

# Batch size for inserts
$BATCH_SIZE = 1000

# Log file
$LogFile = "logs\upload-$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Console output with colors
    switch ($Level) {
        "ERROR"   { Write-Host $logMessage -ForegroundColor Red }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        default   { Write-Host $logMessage }
    }
    
    # File output
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" | Out-Null
    }
    Add-Content -Path $LogFile -Value $logMessage
}

# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================

function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check Excel file exists
    if (-not (Test-Path $ExcelPath)) {
        throw "Excel file not found: $ExcelPath"
    }
    
    # Check psql.exe exists
    if (-not (Test-Path $PSQL_PATH)) {
        throw "PostgreSQL psql.exe not found at: $PSQL_PATH"
    }
    
    # Check ImportExcel module
    if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
        Write-Log "ImportExcel module not found. Installing..." -Level "WARNING"
        Install-Module -Name ImportExcel -Scope CurrentUser -Force
    }
    
    Write-Log "Prerequisites check passed" -Level "SUCCESS"
}

function Test-DatabaseConnection {
    Write-Log "Testing database connection..."
    
    $env:PGPASSWORD = $PG_PASSWORD
    $testQuery = "SELECT version();"
    
    try {
        $result = & $PSQL_PATH -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE -t -c $testQuery 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "Database connection failed: $result"
        }
        
        Write-Log "Database connection successful" -Level "SUCCESS"
        Write-Log "PostgreSQL version: $($result.Trim())"
        return $true
    }
    catch {
        throw "Database connection error: $_"
    }
}

function Test-ExcelStructure {
    param([array]$Data)
    
    Write-Log "Validating Excel structure..."
    
    $errors = @()
    
    # Required columns (case-insensitive). Accept several common variants for headers.
    $requiredColumns = @(
        'year',
        'month',
        'salesrepname',
        'customername',
        'countryname',
        'pgcombine',
        'productgroup',
        'material',
        'process',
        'values_type',
        'total',
        'values'
    )
    
    # Check if data is empty
    if ($Data.Count -eq 0) {
        $errors += "Excel file is empty"
        return $errors
    }
    
    # Get first row to check columns
    $firstRow = $Data[0]
    $excelColumns = $firstRow.PSObject.Properties.Name
    # Normalize header names to lowercase for case-insensitive matching
    $excelColumnsLower = $excelColumns | ForEach-Object { $_.ToString().ToLower() }
    
    # Check for columns that shouldn't be in Excel
    if ($excelColumnsLower -contains 'type') {
        $errors += "Remove 'type' column from Excel - it will be set to 'Budget' automatically"
    }
    if ($excelColumnsLower -contains 'division') {
        $errors += "Remove 'division' column from Excel - it's provided as parameter"
    }
    
    # Check for missing required columns
    foreach ($col in $requiredColumns) {
        if ($excelColumnsLower -notcontains $col.ToLower()) {
            $errors += "Missing required column (or variant): $col"
        }
    }
    
    # Validate sample rows (first 10)
    $sampleRows = $Data | Select-Object -First 10
    for ($i = 0; $i -lt $sampleRows.Count; $i++) {
        $row = $sampleRows[$i]
        $rowNum = $i + 2  # Excel row number (1 = header)
        
        # Year validation
        if ($row.year -lt 2019 -or $row.year -gt 2050) {
            $errors += "Row ${rowNum}: Invalid year $($row.year) (must be 2019-2050)"
        }
        
        # Month validation (must be numeric 1-12)
        if ($row.month -isnot [int] -and $row.month -isnot [double]) {
            $errors += "Row ${rowNum}: Month must be numeric (1-12), found: $($row.month)"
        }
        elseif ($row.month -lt 1 -or $row.month -gt 12) {
            $errors += "Row ${rowNum}: Invalid month $($row.month) (must be 1-12)"
        }
        
        # Customer name validation
        if ([string]::IsNullOrWhiteSpace($row.customername)) {
            $errors += "Row ${rowNum}: Customer name is empty"
        }
        
        # Values type validation (case-insensitive)
        $valType = ($row.values_type -as [string])
        if (-not $valType) { $valType = $row.values_type }
        if ($valType) { $valType = $valType.ToString().ToUpper() }
        if ($valType -notin @('AMOUNT','KGS','MORM')) {
            $errors += "Row ${rowNum}: Invalid values_type '$($row.values_type)' (must be AMOUNT, KGS, or MORM)"
        }
        
        # Total/values validation
        # Accept 'Total' or 'values' variants (case-insensitive)
        $valueField = $null
        if ($row.PSObject.Properties.Name -contains 'Total') { $valueField = $row.Total }
        elseif ($row.PSObject.Properties.Name -contains 'values') { $valueField = $row.values }
        else {
            # Try case-insensitive lookup
            foreach ($p in $row.PSObject.Properties) {
                if ($p.Name.ToLower() -in @('total','values')) { $valueField = $p.Value; break }
            }
        }

        if ($null -eq $valueField) {
            $errors += "Row ${rowNum}: Total/values value is missing"
        }
        elseif ($valueField -isnot [int] -and $valueField -isnot [double]) {
            $errors += "Row ${rowNum}: Total/values must be numeric, found: $($valueField)"
        }
    }
    
    if ($errors.Count -eq 0) {
        Write-Log "Excel structure validation passed (Budget upload)" -Level "SUCCESS"
        Write-Log "Total rows: $($Data.Count)"
    }
    else {
        Write-Log "Excel structure validation failed with $($errors.Count) errors" -Level "ERROR"
    }
    
    return $errors
}

# ============================================================================
# DATA TRANSFORMATION FUNCTIONS
# ============================================================================

function Convert-ToProperCase {
    param([string]$Text)
    
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    
    # Trim and normalize spaces
    $Text = $Text.Trim() -replace '\s+', ' '
    
    # Convert to proper case (title case)
    $TextInfo = (Get-Culture).TextInfo
    return $TextInfo.ToTitleCase($Text.ToLower())
}

function Convert-ExcelToSqlData {
    param([array]$Data)
    
    Write-Log "Transforming Excel data to SQL format..."
    Write-Log "Applying data normalization: TRIM + Proper Case conversion"
    
    $transformedData = @()
    $sourceSheet = (Get-Item $ExcelPath).Name
    
    foreach ($row in $Data) {
        # Map Excel columns to database columns with normalization
        # Apply TRIM and Proper Case to all text fields for consistency
        $sqlRow = @{
            division = $Division.ToUpper()
            year = [int]$row.year
            month = [int]$row.month
            type = 'Budget'  # Always Budget for this upload
            salesrepname = Convert-ToProperCase -Text $row.salesrepname
            customername = Convert-ToProperCase -Text $row.customername
            countryname = Convert-ToProperCase -Text $row.COUNTRYNAME
            productgroup = Convert-ToProperCase -Text $row.PGCombine
            material = Convert-ToProperCase -Text $row.Material
            process = Convert-ToProperCase -Text $row.Process
            values_type = if ($row.values_type) { $row.values_type.ToString().Trim().ToUpper() } else { 'AMOUNT' }  # Normalize to uppercase, default to AMOUNT
            values = [decimal]$row.Total
            sourcesheet = $sourceSheet
            uploaded_by = $UploadedBy
        }
        
        $transformedData += $sqlRow
    }
    
    Write-Log "Transformed $($transformedData.Count) rows with normalization applied" -Level "SUCCESS"
    return $transformedData
}

function Get-QCSummary {
    param([array]$Data)
    
    Write-Log "Generating QC summary..."
    
    # Extract unique values from hashtable array
    $years = ($Data | ForEach-Object { $_.year } | Select-Object -Unique | Sort-Object)
    $months = ($Data | ForEach-Object { $_.month } | Select-Object -Unique | Sort-Object)
    $valuesTypes = ($Data | ForEach-Object { $_.values_type } | Select-Object -Unique | Sort-Object)
    
    # Calculate totals by values_type
    $totalAmount = ($Data | Where-Object { $_.values_type -eq 'AMOUNT' } | ForEach-Object { $_.values } | Measure-Object -Sum).Sum
    $totalKGS = ($Data | Where-Object { $_.values_type -eq 'KGS' } | ForEach-Object { $_.values } | Measure-Object -Sum).Sum
    $totalMORM = ($Data | Where-Object { $_.values_type -eq 'MORM' } | ForEach-Object { $_.values } | Measure-Object -Sum).Sum
    
    $summary = @{
        TotalRecords = $Data.Count
        Years = $years
        Months = $months
        ValuesTypes = $valuesTypes
        TotalAmount = $totalAmount
        TotalKGS = $totalKGS
        TotalMORM = $totalMORM
    }
    
    Write-Log "QC Summary:"
    Write-Log "  Total Records: $($summary.TotalRecords)"
    Write-Log "  Years: $($summary.Years -join ', ')"
    Write-Log "  Months: $($summary.Months -join ', ')"
    Write-Log "  Values Types: $($summary.ValuesTypes -join ', ')"
    Write-Log "  Total AMOUNT: $($summary.TotalAmount)"
    Write-Log "  Total KGS: $($summary.TotalKGS)"
    Write-Log "  Total MORM: $($summary.TotalMORM)"
    
    return $summary
}

# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

function Invoke-SqlCommand {
    param(
        [string]$Query,
        [switch]$ReturnOutput
    )
    
    $env:PGPASSWORD = $PG_PASSWORD
    
    try {
        # Always use temp file to avoid command line length limits
        $tempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
        try {
            $Query | Out-File -FilePath $tempSqlFile -Encoding UTF8
            
            if ($ReturnOutput) {
                $result = & $PSQL_PATH -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE -t -f $tempSqlFile 2>&1
            }
            else {
                & $PSQL_PATH -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE -f $tempSqlFile 2>&1 | Out-Null
            }
        }
        finally {
            if (Test-Path $tempSqlFile) {
                Remove-Item $tempSqlFile -Force
            }
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "SQL command failed with exit code $LASTEXITCODE"
        }
        
        if ($ReturnOutput) {
            return $result
        }
    }
    catch {
        throw "SQL execution error: $_"
    }
}

function Backup-ExistingData {
    param([array]$TransformedData)
    
    Write-Log "Creating backup before REPLACE operation..."
    Write-Log "REPLACE mode will delete ALL existing data for division $Division, type Budget"
    
    # Count existing records before backup
        # Get count before delete
    $countBeforeQuery = "SELECT COUNT(*) FROM public.fp_data_excel WHERE division = '$($Division.ToUpper())' AND type = 'Budget';"
    $countBefore = Invoke-SqlCommand -Query $countBeforeQuery -ReturnOutput
    
    $backupQuery = @"
BEGIN;

-- Clear previous backups for this division/type to avoid primary key conflicts
DELETE FROM public.fp_data_excel_backup 
WHERE division = '$($Division.ToUpper())' AND type = 'Budget';

-- Backup ALL existing data for this division and type (not just uploaded months)
INSERT INTO public.fp_data_excel_backup
SELECT *, NOW() as backup_timestamp, 'REPLACE mode - full backup before delete all' as backup_reason
FROM public.fp_data_excel
WHERE division = '$($Division.ToUpper())'
  AND type = 'Budget';

COMMIT;
"@
    
    Invoke-SqlCommand -Query $backupQuery
    
    Write-Log "Backup created: $($countBefore.Trim()) records backed up (ALL existing Budget data)" -Level "SUCCESS"
}

function Remove-ExistingData {
    param([array]$TransformedData)
    
    Write-Log "Deleting ALL existing data for REPLACE mode..."
    Write-Log "WARNING: This will delete ALL FP Actual data, not just overlapping months"
    
    # Get count before deletion
        # Get record count before
    $beforeCount = Invoke-SqlCommand -Query "SELECT COUNT(*) FROM public.fp_data_excel WHERE division = '$($Division.ToUpper())' AND type = 'Budget';" -ReturnOutput
    Write-Log "Records before delete: $($beforeCount.Trim())"
    
    $deleteQuery = @"
BEGIN;

-- Delete ALL existing data for this division and type (complete replacement)
DELETE FROM public.fp_data_excel
WHERE division = '$($Division.ToUpper())'
  AND type = 'Budget';

COMMIT;
"@
    
    Invoke-SqlCommand -Query $deleteQuery
    
    # Get count after deletion
        
    # Get record count after
    $afterCount = Invoke-SqlCommand -Query "SELECT COUNT(*) FROM public.fp_data_excel WHERE division = '$($Division.ToUpper())' AND type = 'Budget';" -ReturnOutput
    Write-Log "Records deleted: $($beforeCount.Trim())" -Level "SUCCESS"
    Write-Log "Records remaining: $($afterCount.Trim())" -Level "SUCCESS"
}

function Invoke-UpsertData {
    param([array]$TransformedData)
    
    Write-Log "Uploading data in UPSERT mode (batch size: $BATCH_SIZE)..."
    Write-Log "NOTE: UPSERT mode currently uses DELETE + INSERT for overlapping records"
    Write-Log "TODO: Implement interactive conflict resolution in future version"
    
    $totalBatches = [Math]::Ceiling($TransformedData.Count / $BATCH_SIZE)
    $batchNumber = 0
    
    for ($i = 0; $i -lt $TransformedData.Count; $i += $BATCH_SIZE) {
        $batchNumber++
        $batch = $TransformedData[$i..([Math]::Min($i + $BATCH_SIZE - 1, $TransformedData.Count - 1))]
        
        Write-Log "Processing batch $batchNumber of $totalBatches ($($batch.Count) rows)..."
        
        # Build INSERT ... ON CONFLICT DO UPDATE
        $values = @()
        foreach ($row in $batch) {
            $salesrepname = if ($row.salesrepname) { "'$($row.salesrepname.Replace("'", "''"))'" } else { "NULL" }
            $customername = if ($row.customername) { "'$($row.customername.Replace("'", "''"))'" } else { "NULL" }
            $countryname = if ($row.countryname) { "'$($row.countryname.Replace("'", "''"))'" } else { "NULL" }
            $productgroup = if ($row.productgroup) { "'$($row.productgroup.Replace("'", "''"))'" } else { "NULL" }
            $material = if ($row.material) { "'$($row.material.Replace("'", "''"))'" } else { "NULL" }
            $process = if ($row.process) { "'$($row.process.Replace("'", "''"))'" } else { "NULL" }
            $sourcesheet = if ($row.sourcesheet) { "'$($row.sourcesheet.Replace("'", "''"))'" } else { "NULL" }
            
            $valueRow = @"
('$($row.division)', $($row.year), $($row.month), '$($row.type)', $salesrepname, $customername, $countryname, $productgroup, $material, $process, '$($row.values_type)', $($row.values), $sourcesheet, '$($row.uploaded_by)', NOW())
"@
            $values += $valueRow
        }
        
        # UPSERT using DELETE + INSERT (doesn't require unique constraint)
        # First, delete matching records for this batch
        $deleteConditions = @()
        foreach ($row in $batch) {
            $salesrepCond = if ($row.salesrepname) { "salesrepname = '$($row.salesrepname.Replace("'", "''"))'" } else { "salesrepname IS NULL" }
            $customerCond = if ($row.customername) { "customername = '$($row.customername.Replace("'", "''"))'" } else { "customername IS NULL" }
            $countryCond = if ($row.countryname) { "countryname = '$($row.countryname.Replace("'", "''"))'" } else { "countryname IS NULL" }
            $productCond = if ($row.productgroup) { "productgroup = '$($row.productgroup.Replace("'", "''"))'" } else { "productgroup IS NULL" }
            $materialCond = if ($row.material) { "material = '$($row.material.Replace("'", "''"))'" } else { "material IS NULL" }
            $processCond = if ($row.process) { "process = '$($row.process.Replace("'", "''"))'" } else { "process IS NULL" }
            
            $deleteConditions += "(division = '$($row.division)' AND year = $($row.year) AND month = $($row.month) AND type = '$($row.type)' AND $salesrepCond AND $customerCond AND $countryCond AND $productCond AND $materialCond AND $processCond AND values_type = '$($row.values_type)')"
        }
        
        $upsertQuery = @"
BEGIN;

-- Delete existing matching records
DELETE FROM public.fp_data_excel 
WHERE $($deleteConditions -join " OR `n      ");

-- Insert new records
INSERT INTO public.fp_data_excel 
(division, year, month, type, salesrepname, customername, countryname, productgroup, material, process, values_type, values, sourcesheet, uploaded_by, updated_at)
VALUES
$($values -join ",`n");

COMMIT;
"@
        
        try {
            Invoke-SqlCommand -Query $upsertQuery
            Write-Log "Batch $batchNumber completed successfully" -Level "SUCCESS"
        }
        catch {
            Write-Log "Batch $batchNumber failed: $_" -Level "ERROR"
            throw
        }
    }
    
    Write-Log "UPSERT completed: $($TransformedData.Count) rows processed" -Level "SUCCESS"
}

function Invoke-InsertData {
    param([array]$TransformedData)
    
    Write-Log "Uploading data in INSERT mode (batch size: $BATCH_SIZE)..."
    
    $totalBatches = [Math]::Ceiling($TransformedData.Count / $BATCH_SIZE)
    $batchNumber = 0
    
    for ($i = 0; $i -lt $TransformedData.Count; $i += $BATCH_SIZE) {
        $batchNumber++
        $batch = $TransformedData[$i..([Math]::Min($i + $BATCH_SIZE - 1, $TransformedData.Count - 1))]
        
        Write-Log "Processing batch $batchNumber of $totalBatches ($($batch.Count) rows)..."
        
        # Build INSERT
        $values = @()
        foreach ($row in $batch) {
            $salesrepname = if ($row.salesrepname) { "'$($row.salesrepname.Replace("'", "''"))'" } else { "NULL" }
            $customername = if ($row.customername) { "'$($row.customername.Replace("'", "''"))'" } else { "NULL" }
            $countryname = if ($row.countryname) { "'$($row.countryname.Replace("'", "''"))'" } else { "NULL" }
            $productgroup = if ($row.productgroup) { "'$($row.productgroup.Replace("'", "''"))'" } else { "NULL" }
            $material = if ($row.material) { "'$($row.material.Replace("'", "''"))'" } else { "NULL" }
            $process = if ($row.process) { "'$($row.process.Replace("'", "''"))'" } else { "NULL" }
            $sourcesheet = if ($row.sourcesheet) { "'$($row.sourcesheet.Replace("'", "''"))'" } else { "NULL" }
            
            $valueRow = @"
('$($row.division)', $($row.year), $($row.month), '$($row.type)', $salesrepname, $customername, $countryname, $productgroup, $material, $process, '$($row.values_type)', $($row.values), $sourcesheet, '$($row.uploaded_by)')
"@
            $values += $valueRow
        }
        
        $insertQuery = @"
BEGIN;

INSERT INTO public.fp_data_excel 
(division, year, month, type, salesrepname, customername, countryname, productgroup, material, process, values_type, values, sourcesheet, uploaded_by)
VALUES
$($values -join ",`n");

COMMIT;
"@
        
        try {
            Invoke-SqlCommand -Query $insertQuery
            Write-Log "Batch $batchNumber completed successfully" -Level "SUCCESS"
        }
        catch {
            Write-Log "Batch $batchNumber failed: $_" -Level "ERROR"
            throw
        }
    }
    
    Write-Log "INSERT completed: $($TransformedData.Count) rows processed" -Level "SUCCESS"
}

function Write-AuditLog {
    param(
        [string]$Operation,
        [int]$RecordsAffected,
        [hashtable]$QCSummary,
        [string]$Status,
        [string]$ErrorMessage = $null
    )
    
    Write-Log "Writing audit log..."
    
    $auditQuery = @"
INSERT INTO public.aebf_upload_audit 
(division, upload_mode, uploaded_by, records_processed, success, error_message)
VALUES 
('$($Division.ToUpper())', '$UploadMode', '$UploadedBy', $RecordsAffected, 
 $(if ($Status -eq 'success') { 'true' } else { 'false' }),
 $(if ($ErrorMessage) { "'$($ErrorMessage.Replace("'", "''"))'" } else { "NULL" }));
"@
    
    try {
        Invoke-SqlCommand -Query $auditQuery
        Write-Log "Audit log written successfully" -Level "SUCCESS"
    }
    catch {
        Write-Log "Failed to write audit log: $_" -Level "WARNING"
    }
}

function Get-PostUploadQC {
    param([hashtable]$PreQC)
    
    Write-Log "Running post-upload QC verification..."
    
    $years = $PreQC.Years -join ','
    $months = $PreQC.Months -join ','
    
    $qcQuery = @"
SELECT 
    values_type,
    COUNT(*) as record_count,
    SUM(values) as total_values
FROM public.fp_data_excel
WHERE division = '$($Division.ToUpper())'
  AND type = 'Budget'
  AND year IN ($years)
  AND month IN ($months)
GROUP BY values_type
ORDER BY values_type;
"@
    
    $result = Invoke-SqlCommand -Query $qcQuery -ReturnOutput
    
    Write-Log "Post-upload QC Results:"
    Write-Log $result
    
    return $result
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

try {
    Write-Log "========================================================================"
    Write-Log "AEBF Excel to SQL Transform & Upload Script"
    Write-Log "========================================================================"
    Write-Log "Excel File: $ExcelPath"
    Write-Log "Division: $Division"
    Write-Log "Upload Mode: $UploadMode"
    Write-Log "Uploaded By: $UploadedBy"
    Write-Log "Test Mode: $TestMode"
    Write-Log "========================================================================"
    
    # Step 1: Prerequisites
    Test-Prerequisites
    
    # Step 2: Test database connection
    Test-DatabaseConnection
    
    # Step 3: Read Excel file (first sheet only - no sheet name required)
    Write-Log "Reading Excel file (first sheet)..."
    Import-Module ImportExcel
    $excelDataRaw = Import-Excel -Path $ExcelPath  # Reads first sheet automatically
    
    Write-Log "Excel has $($excelDataRaw.Count) total rows" -Level "INFO"
    
    # Filter out blank rows (where year is null/empty/0)
    $excelData = $excelDataRaw | Where-Object { 
        $_.year -and 
        $_.year -ne 0 -and 
        ![string]::IsNullOrWhiteSpace($_.customername)
    }
    
    Write-Log "Read $($excelDataRaw.Count) rows from Excel (filtered to $($excelData.Count) valid rows)" -Level "SUCCESS"
    
    if ($excelData.Count -eq 0) {
        throw "No valid data rows found in Excel file. Check that the file has data with year and customername columns filled."
    }
    
    # Apply selective year/month filter if provided
    if ($SelectiveYearMonths) {
        Write-Log "Selective mode enabled: $SelectiveYearMonths" -Level "INFO"
        $selectedPairs = $SelectiveYearMonths.Split(',') | ForEach-Object {
            $parts = $_.Trim().Split('-')
            [PSCustomObject]@{
                Year = [int]$parts[0]
                Month = [int]$parts[1]
            }
        }
        
        $beforeCount = $excelData.Count
        $excelData = $excelData | Where-Object {
            $row = $_
            $selectedPairs | Where-Object { $_.Year -eq $row.year -and $_.Month -eq $row.month } | Select-Object -First 1
        }
        
        Write-Log "Filtered to $($excelData.Count) rows (from $beforeCount) matching selected periods" -Level "INFO"
        
        if ($excelData.Count -eq 0) {
            throw "No data found for the selected year/month periods: $SelectiveYearMonths"
        }
    }
    
    Write-Log "Upload type: Budget (sales rep budget data)" -Level "INFO"
    
    # Step 4: Validate Excel structure
    $validationErrors = Test-ExcelStructure -Data $excelData
    if ($validationErrors.Count -gt 0) {
        Write-Log "Validation Errors:" -Level "ERROR"
        foreach ($error in $validationErrors) {
            Write-Log "  - $error" -Level "ERROR"
        }
        throw "Excel validation failed with $($validationErrors.Count) errors"
    }
    
    # Step 5: Transform data
    $transformedData = Convert-ExcelToSqlData -Data $excelData
    
    # Step 6: Generate QC summary
    $preQC = Get-QCSummary -Data $transformedData
    
    # Step 7: Test mode check
    if ($TestMode) {
        Write-Log "========================================================================"
        Write-Log "TEST MODE - No data will be uploaded to database"
        Write-Log "========================================================================"
        Write-Log "Validation completed successfully. Data is ready for upload." -Level "SUCCESS"
        exit 0
    }
    
    # Step 8: Upload based on mode
    if ($UploadMode -eq 'replace') {
        # REPLACE mode: Backup → Delete → Insert
        Backup-ExistingData -TransformedData $transformedData
        Remove-ExistingData -TransformedData $transformedData
        Invoke-InsertData -TransformedData $transformedData
    }
    else {
        # UPSERT mode: Insert with ON CONFLICT DO UPDATE
        Invoke-UpsertData -TransformedData $transformedData
    }
    
    # Step 9: Post-upload QC
    $postQC = Get-PostUploadQC -PreQC $preQC
    
    # Step 10: Write audit log
    Write-AuditLog -Operation $UploadMode -RecordsAffected $transformedData.Count -QCSummary $preQC -Status 'success'
    
    Write-Log "========================================================================"
    Write-Log "Upload completed successfully!" -Level "SUCCESS"
    Write-Log "Total records processed: $($transformedData.Count)"
    Write-Log "Mode: $UploadMode"
    Write-Log "Log file: $LogFile"
    Write-Log "========================================================================"
    
    exit 0
}
catch {
    Write-Log "========================================================================"
    Write-Log "Upload failed: $_" -Level "ERROR"
    Write-Log "========================================================================"
    
    # Write failure to audit log
    if ($preQC) {
        Write-AuditLog -Operation $UploadMode -RecordsAffected 0 -QCSummary $preQC -Status 'failed' -ErrorMessage $_.Exception.Message
    }
    
    exit 1
}
