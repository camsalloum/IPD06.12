# PowerShell Script to Fix HTML Export
# This script applies all necessary changes to server/routes/aebf.js

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "HTML Export Fix - Automated Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$filePath = "server/routes/aebf.js"
$backupPath = "server/routes/aebf.js.backup2"

# Check if file exists
if (-not (Test-Path $filePath)) {
    Write-Host "ERROR: File not found: $filePath" -ForegroundColor Red
    exit 1
}

# Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
Copy-Item $filePath $backupPath -Force
Write-Host "✓ Backup created: $backupPath" -ForegroundColor Green
Write-Host ""

# Read the file
Write-Host "Reading file..." -ForegroundColor Yellow
$content = Get-Content $filePath -Raw

# ============================================================================
# CHANGE 1: Update table body generation to add Amount rows
# ============================================================================
Write-Host "Applying Change 1: Adding Amount rows to table body..." -ForegroundColor Yellow

$oldPattern1 = @'
          return '<tr class="actual-row">' \+
            '<td rowspan="2">' \+ row\.customer \+ '</td>' \+
            '<td rowspan="2">' \+ row\.country \+ '</td>' \+
            '<td rowspan="2">' \+ row\.productGroup \+ '</td>' \+
            actualCells \+
            '<td style="background-color: #cce4ff; text-align: right; font-weight: 700;">' \+ actualRowTotal\.toLocaleString\('en-US', \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\) \+ '</td>' \+
          '</tr>' \+
          '<tr class="budget-row">' \+
            budgetCells \+
            '<td class="budget-row-total" style="background-color: #FFEB3B; text-align: right; font-weight: 700;">' \+ budgetRowTotal\.toLocaleString\('en-US', \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\) \+ '</td>' \+
          '</tr>';
'@

$newCode1 = @'
          // Get pricing for this product group
          const productGroupKey = (row.productGroup || '').toLowerCase();
          const pricing = pricingMap[productGroupKey] || { sellingPrice: 0 };
          const sellingPrice = pricing.sellingPrice || 0;
          
          // Calculate actual Amount cells (MT * 1000 * sellingPrice)
          let actualAmountTotal = 0;
          const actualAmountCells = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const mtValue = row.monthlyActual?.[month] || 0;
            const amountValue = mtValue * 1000 * sellingPrice;
            actualAmountTotal += amountValue;
            const formatted = amountValue >= 1000000 ? (amountValue / 1000000).toFixed(1) + 'M' :
                              amountValue >= 1000 ? (amountValue / 1000).toFixed(1) + 'K' :
                              amountValue.toFixed(0);
            return '<td style="background-color: #d4edda; text-align: right; font-weight: 500; padding: 6px 8px;">' + formatted + '</td>';
          }).join('');
          
          // Calculate budget Amount cells (MT * 1000 * sellingPrice)
          let budgetAmountTotal = 0;
          const budgetAmountCells = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const key = row.customer + '|' + row.country + '|' + row.productGroup + '|' + month;
            const preFilledValue = budgetDataMap[key] || '';
            const mtValue = preFilledValue ? parseFloat(preFilledValue.toString().replace(/,/g, '')) || 0 : 0;
            const amountValue = mtValue * 1000 * sellingPrice;
            budgetAmountTotal += amountValue;
            const formatted = amountValue >= 1000000 ? (amountValue / 1000000).toFixed(1) + 'M' :
                              amountValue >= 1000 ? (amountValue / 1000).toFixed(1) + 'K' :
                              amountValue.toFixed(0);
            return '<td style="background-color: #fff3cd; text-align: right; font-weight: 500; padding: 6px 8px;">' + formatted + '</td>';
          }).join('');
          
          const actualAmountTotalFormatted = actualAmountTotal >= 1000000 ? (actualAmountTotal / 1000000).toFixed(1) + 'M' :
                                             actualAmountTotal >= 1000 ? (actualAmountTotal / 1000).toFixed(1) + 'K' :
                                             actualAmountTotal.toFixed(0);
          const budgetAmountTotalFormatted = budgetAmountTotal >= 1000000 ? (budgetAmountTotal / 1000000).toFixed(1) + 'M' :
                                             budgetAmountTotal >= 1000 ? (budgetAmountTotal / 1000).toFixed(1) + 'K' :
                                             budgetAmountTotal.toFixed(0);
          
          return '<tr class="actual-row">' +
            '<td rowspan="4">' + row.customer + '</td>' +
            '<td rowspan="4">' + row.country + '</td>' +
            '<td rowspan="4">' + row.productGroup + '</td>' +
            actualCells +
            '<td style="background-color: #cce4ff; text-align: right; font-weight: 700;">' + actualRowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '</tr>' +
          '<tr class="budget-row">' +
            budgetCells +
            '<td class="budget-row-total" style="background-color: #FFEB3B; text-align: right; font-weight: 700;">' + budgetRowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '</tr>' +
          '<tr class="actual-amount-row">' +
            actualAmountCells +
            '<td style="background-color: #c3e6cb; text-align: right; font-weight: 700;">' + actualAmountTotalFormatted + '</td>' +
          '</tr>' +
          '<tr class="budget-amount-row">' +
            budgetAmountCells +
            '<td style="background-color: #ffeeba; text-align: right; font-weight: 700;">' + budgetAmountTotalFormatted + '</td>' +
          '</tr>';
'@

if ($content -match $oldPattern1) {
    $content = $content -replace $oldPattern1, $newCode1
    Write-Host "✓ Change 1 applied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Change 1: Pattern not found - may already be applied or file structure changed" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# CHANGE 2: Add CSS for Amount rows
# ============================================================================
Write-Host "Applying Change 2: Adding CSS for Amount rows..." -ForegroundColor Yellow

$cssToAdd = @'

    /* Actual Amount Row - Green */
    tbody tr.actual-amount-row {
      background-color: #d4edda;
    }
    tbody tr.actual-amount-row td {
      background-color: #d4edda;
      text-align: right;
      font-weight: 500;
      padding: 6px 8px;
    }

    /* Budget Amount Row - Light Yellow */
    tbody tr.budget-amount-row {
      background-color: #fff3cd;
    }
    tbody tr.budget-amount-row td {
      background-color: #fff3cd;
      text-align: right;
      font-weight: 500;
      padding: 6px 8px;
    }
'@

# Find the location to insert CSS (after tbody tr.budget-row styles)
$cssInsertPattern = '(tbody tr\.budget-row \{ background-color: #FFFFB8; \})'
if ($content -match $cssInsertPattern) {
    $content = $content -replace $cssInsertPattern, "`$1$cssToAdd"
    Write-Host "✓ Change 2 applied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Change 2: Insertion point not found" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# CHANGE 3: Update legend
# ============================================================================
Write-Host "Applying Change 3: Updating legend..." -ForegroundColor Yellow

$legendToAdd = @'
                <div class="legend-item">
                  <span class="legend-color" style="background-color: #d4edda; border-color: #28a745;"></span>
                  <span>Actual ${actualYear} Amount</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color" style="background-color: #fff3cd; border-color: #ffc107;"></span>
                  <span>Budget ${budgetYear} Amount</span>
                </div>
'@

$legendPattern = '(<span>Budget \$\{budgetYear\} Volume \(MT\)</span>\s*</div>)'
if ($content -match $legendPattern) {
    $content = $content -replace $legendPattern, "`$1$legendToAdd"
    Write-Host "✓ Change 3 applied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Change 3: Pattern not found" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# CHANGE 4: Add helper functions to JavaScript
# ============================================================================
Write-Host "Applying Change 4: Adding JavaScript helper functions..." -ForegroundColor Yellow

$helperFunctions = @'

    function formatAmount(value) {
      if (!value || value === 0) return '0';
      if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
      if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
      return value.toFixed(0);
    }
    
    function findPricing(productGroup) {
      if (!productGroup) return { sellingPrice: 0 };
      const key = productGroup.toLowerCase().trim();
      return pricingMap[key] || { sellingPrice: 0 };
    }
'@

$jsInsertPattern = '(const pricingMap = \$\{JSON\.stringify\(pricingMap\)\};)'
if ($content -match $jsInsertPattern) {
    $content = $content -replace $jsInsertPattern, "`$1$helperFunctions"
    Write-Host "✓ Change 4 applied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠ Change 4: Insertion point not found" -ForegroundColor Yellow
}

Write-Host ""

# Write the modified content back to file
Write-Host "Writing changes to file..." -ForegroundColor Yellow
$content | Set-Content $filePath -NoNewline
Write-Host "✓ File updated successfully" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Application Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restart the Node.js server" -ForegroundColor White
Write-Host "2. Test the HTML export functionality" -ForegroundColor White
Write-Host "3. Verify 4 rows per customer (MT + Amount)" -ForegroundColor White
Write-Host "4. Check that calculations are correct" -ForegroundColor White
Write-Host ""
Write-Host "If issues occur, restore from backup:" -ForegroundColor Yellow
Write-Host "  copy $backupPath $filePath" -ForegroundColor White
Write-Host ""
