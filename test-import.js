const fs = require('fs');
const html = fs.readFileSync('D:/IPD06.12/FINAL_Divisional_FP_2026_08122025_1620.html', 'utf8');

// Simulate the import parsing
const actualRowPattern = /<tr[^>]*class="actual-row"[^>]*data-pg="([^"]+)"[^>]*>[\s\S]*?<\/tr>\s*<tr[^>]*class="budget-row"[^>]*>([\s\S]*?)<\/tr>/gi;

let match;
const parsedRecords = [];

while ((match = actualRowPattern.exec(html)) !== null) {
  const productGroup = match[1];
  const budgetRowContent = match[2];
  
  if (productGroup.toUpperCase() === 'SERVICES CHARGES') continue;
  
  const tdPattern = /<td[^>]*>([^<]*)<\/td>/gi;
  let tdMatch;
  let month = 1;
  
  while ((tdMatch = tdPattern.exec(budgetRowContent)) !== null && month <= 12) {
    const value = tdMatch[1].trim();
    if (value && !isNaN(parseFloat(value)) && parseFloat(value) !== 0) {
      parsedRecords.push({
        productGroup,
        month,
        value: Math.round(parseFloat(value) * 1000) // Convert MT to KGS
      });
    }
    month++;
  }
}

console.log('Total records parsed:', parsedRecords.length);
console.log('\nFirst 10 records:');
parsedRecords.slice(0, 10).forEach(r => console.log('  ', r.productGroup, 'M' + r.month, '=', r.value, 'KGS'));
const total = parsedRecords.reduce((sum, r) => sum + r.value, 0);
console.log('\nTotal KGS:', total, '(= ' + (total/1000) + ' MT)');
