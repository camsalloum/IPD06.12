/**
 * Node.js Script to Fix HTML Export
 * This script applies all necessary changes to server/routes/aebf.js
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('HTML Export Fix - Automated Application');
console.log('========================================\n');

const filePath = path.join(__dirname, 'server', 'routes', 'aebf.js');
const backupPath = path.join(__dirname, 'server', 'routes', 'aebf.js.backup2');

// Check if file exists
if (!fs.existsSync(filePath)) {
    console.error('ERROR: File not found:', filePath);
    process.exit(1);
}

// Create backup
console.log('Creating backup...');
fs.copyFileSync(filePath, backupPath);
console.log('✓ Backup created:', backupPath, '\n');

// Read the file
console.log('Reading file...');
let content = fs.readFileSync(filePath, 'utf8');

// ============================================================================
// CHANGE 1: Update table body generation to add Amount rows
// ============================================================================
console.log('Applying Change 1: Adding Amount rows to table body...');

const oldCode1 = `          return '<tr class="actual-row">' +
            '<td rowspan="2">' + row.customer + '</td>' +
            '<td rowspan="2">' + row.country + '</td>' +
            '<td rowspan="2">' + row.productGroup + '</td>' +
            actualCells +
            '<td style="background-color: #cce4ff; text-align: right; font-weight: 700;">' + actualRowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '</tr>' +
          '<tr class="budget-row">' +
            budgetCells +
            '<td class="budget-row-total" style="background-color: #FFEB3B; text-align: right; font-weight: 700;">' + budgetRowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '</tr>';`;

const newCode1 = `          // Get pricing for this product group
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
          '</tr>';`;

if (content.includes(oldCode1)) {
    content = content.replace(oldCode1, newCode1);
    console.log('✓ Change 1 applied successfully\n');
} else {
    console.log('⚠ Change 1: Pattern not found - may already be applied or file structure changed\n');
}

// ============================================================================
// CHANGE 2: Add CSS for Amount rows
// ============================================================================
console.log('Applying Change 2: Adding CSS for Amount rows...');

const cssToAdd = `
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
    }`;

const cssInsertMarker = '    tbody tr.budget-row { background-color: #FFFFB8; }';
if (content.includes(cssInsertMarker) && !content.includes('tbody tr.actual-amount-row')) {
    content = content.replace(cssInsertMarker, cssInsertMarker + cssToAdd);
    console.log('✓ Change 2 applied successfully\n');
} else if (content.includes('tbody tr.actual-amount-row')) {
    console.log('⚠ Change 2: CSS already exists\n');
} else {
    console.log('⚠ Change 2: Insertion point not found\n');
}

// ============================================================================
// CHANGE 3: Update legend
// ============================================================================
console.log('Applying Change 3: Updating legend...');

const legendToAdd = `
                <div class="legend-item">
                  <span class="legend-color" style="background-color: #d4edda; border-color: #28a745;"></span>
                  <span>Actual \${actualYear} Amount</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color" style="background-color: #fff3cd; border-color: #ffc107;"></span>
                  <span>Budget \${budgetYear} Amount</span>
                </div>`;

const legendMarker = '                  <span>Budget ${budgetYear} Volume (MT)</span>\n                </div>';
if (content.includes(legendMarker) && !content.includes('Actual ${actualYear} Amount')) {
    content = content.replace(legendMarker, legendMarker + legendToAdd);
    console.log('✓ Change 3 applied successfully\n');
} else if (content.includes('Actual ${actualYear} Amount')) {
    console.log('⚠ Change 3: Legend already updated\n');
} else {
    console.log('⚠ Change 3: Insertion point not found\n');
}

// ============================================================================
// CHANGE 4: Add helper functions to JavaScript
// ============================================================================
console.log('Applying Change 4: Adding JavaScript helper functions...');

const helperFunctions = `
    
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
    }`;

const jsInsertMarker = '    const pricingMap = ${JSON.stringify(pricingMap)};';
if (content.includes(jsInsertMarker) && !content.includes('function formatAmount(value)')) {
    content = content.replace(jsInsertMarker, jsInsertMarker + helperFunctions);
    console.log('✓ Change 4 applied successfully\n');
} else if (content.includes('function formatAmount(value)')) {
    console.log('⚠ Change 4: Helper functions already exist\n');
} else {
    console.log('⚠ Change 4: Insertion point not found\n');
}

// Write the modified content back to file
console.log('Writing changes to file...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ File updated successfully\n');

console.log('========================================');
console.log('Fix Application Complete!');
console.log('========================================\n');
console.log('Next Steps:');
console.log('1. Restart the Node.js server');
console.log('2. Test the HTML export functionality');
console.log('3. Verify 4 rows per customer (MT + Amount)');
console.log('4. Check that calculations are correct\n');
console.log('If issues occur, restore from backup:');
console.log(`  copy ${backupPath} ${filePath}\n`);
