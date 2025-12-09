const fs = require('fs');

const filePath = process.argv[2] || 'D:/Projects/IPD26.10/BUDGET_Divisional_FP_2026_20251126_164645.html';
const html = fs.readFileSync(filePath, 'utf8');
const filename = filePath.split(/[/\\]/).pop();

console.log('=== DIVISIONAL BUDGET FILE VALIDATION REPORT ===\n');
console.log('File:', filename);
console.log('Size:', Math.round(html.length / 1024), 'KB\n');

let allPassed = true;

// 1. Filename Check
const filenamePattern = /^BUDGET_Divisional_(.+)_(\d{4})_(\d{8})_(\d{6})\.html$/;
const filenameMatch = filename.match(filenamePattern);
console.log('1. FILENAME CHECK:');
console.log('   Pattern: BUDGET_Divisional_[Division]_[Year]_[Date]_[Time].html');
if (filenameMatch) {
  console.log('   ✅ PASS');
  console.log('   - Division:', filenameMatch[1]);
  console.log('   - Year:', filenameMatch[2]);
  console.log('   - Date:', filenameMatch[3]);
  console.log('   - Time:', filenameMatch[4]);
} else {
  console.log('   ❌ FAIL - Invalid filename format');
  allPassed = false;
}

// 2. Draft Check
console.log('\n2. DRAFT CHECK:');
const draftCheck = html.match(/const draftMetadata = ({[^;]+});/);
if (draftCheck) {
  try {
    const draftMeta = JSON.parse(draftCheck[1]);
    if (draftMeta.isDraft === true) {
      console.log('   ❌ FAIL - This is a DRAFT file!');
      console.log('   → Open the file and click "Save Final" before uploading');
      allPassed = false;
    } else {
      console.log('   ✅ PASS (Not a draft)');
    }
  } catch (e) {
    console.log('   ⚠️ Could not parse draft metadata');
  }
} else {
  console.log('   ✅ PASS (No draft metadata - this is a final file)');
}

// 3. Metadata Extraction
console.log('\n3. METADATA CHECK:');
const scriptMatch = html.match(/<script[^>]*id=["']savedBudgetData["'][^>]*>([\s\S]*?)<\/script>/i);
let metadata = null;
let budgetData = null;

if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  const metaMatch = scriptContent.match(/const\s+budgetMetadata\s*=\s*([^;]+);/);
  const dataMatch = scriptContent.match(/const\s+savedBudget\s*=\s*(\[[\s\S]*?\]);/);
  
  if (metaMatch && dataMatch) {
    try {
      metadata = JSON.parse(metaMatch[1]);
      budgetData = JSON.parse(dataMatch[1]);
      console.log('   ✅ Metadata extracted successfully');
      console.log('   - Division:', metadata.division);
      console.log('   - Actual Year:', metadata.actualYear);
      console.log('   - Budget Year:', metadata.budgetYear);
      console.log('   - Version:', metadata.version);
      console.log('   - Data Format:', metadata.dataFormat);
      console.log('   - Saved At:', metadata.savedAt);
    } catch (e) {
      console.log('   ❌ FAIL - JSON parse error:', e.message);
      allPassed = false;
    }
  } else {
    console.log('   ❌ FAIL - Could not find metadata or budget data in script');
    allPassed = false;
  }
} else {
  console.log('   ❌ FAIL - No savedBudgetData script found');
  allPassed = false;
}

// 4. Validation checks
if (metadata) {
  console.log('\n4. VALIDATION CHECKS:');
  const errors = [];
  
  if (metadata.dataFormat !== 'divisional_budget_import') {
    errors.push('Invalid dataFormat (expected: divisional_budget_import, got: ' + metadata.dataFormat + ')');
  }
  if (metadata.version !== '1.0') {
    errors.push('Invalid version (expected: 1.0, got: ' + metadata.version + ')');
  }
  if (!metadata.division || typeof metadata.division !== 'string') {
    errors.push('Invalid or missing division');
  }
  if (!metadata.budgetYear || metadata.budgetYear < 2020 || metadata.budgetYear > 2100) {
    errors.push('Invalid budget year (must be 2020-2100)');
  }
  
  if (errors.length > 0) {
    errors.forEach(e => console.log('   ❌', e));
    allPassed = false;
  } else {
    console.log('   ✅ All metadata validations PASS');
  }
}

// 5. Budget Data Check
if (budgetData) {
  console.log('\n5. BUDGET DATA CHECK:');
  console.log('   Records count:', budgetData.length);
  
  if (budgetData.length === 0) {
    console.log('   ❌ FAIL - No budget records found');
    allPassed = false;
  } else if (budgetData.length > 10000) {
    console.log('   ❌ FAIL - Too many records (max 10,000)');
    allPassed = false;
  } else {
    const recordErrors = [];
    const validRecords = [];
    
    budgetData.forEach((r, i) => {
      const e = [];
      if (!r.productGroup || typeof r.productGroup !== 'string' || r.productGroup.trim() === '') {
        e.push('missing/invalid productGroup');
      }
      if (!r.month || typeof r.month !== 'number' || r.month < 1 || r.month > 12) {
        e.push('invalid month (must be 1-12)');
      }
      if (r.value === undefined || r.value === null) {
        e.push('missing value');
      } else if (typeof r.value !== 'number' || isNaN(r.value)) {
        e.push('invalid value (must be number)');
      } else if (r.value === 0) {
        e.push('zero value not allowed');
      } else if (r.value < 0) {
        e.push('negative value not allowed');
      } else if (r.value > 1000000000) {
        e.push('value too large (max 1B KGS)');
      }
      
      if (e.length > 0) {
        recordErrors.push({ index: i + 1, record: r, errors: e });
      } else {
        validRecords.push(r);
      }
    });
    
    if (recordErrors.length > 0) {
      console.log('   ⚠️ Found', recordErrors.length, 'invalid records:');
      recordErrors.forEach(r => {
        console.log('     Record #' + r.index + ':', r.record.productGroup || '(no name)', '| Month', r.record.month, '| Value:', r.record.value);
        console.log('       Errors:', r.errors.join(', '));
      });
      
      const errorRate = recordErrors.length / budgetData.length;
      if (errorRate > 0.1) {
        console.log('   ❌ FAIL - Error rate too high (' + Math.round(errorRate * 100) + '% > 10%)');
        allPassed = false;
      } else {
        console.log('   ⚠️ WARNING - ' + validRecords.length + ' valid records will be imported');
      }
    } else {
      console.log('   ✅ All', budgetData.length, 'records are valid');
    }
    
    console.log('\n   Data preview (first 5 records):');
    budgetData.slice(0, 5).forEach(r => {
      const mtValue = r.value / 1000;
      console.log('   -', r.productGroup, '| Month', r.month, '|', r.value, 'KGS (' + mtValue.toFixed(2) + ' MT)');
    });
    if (budgetData.length > 5) {
      console.log('   ... and', budgetData.length - 5, 'more records');
    }
  }
}

// Final Result
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ FILE IS VALID - Ready for upload!');
} else {
  console.log('❌ FILE HAS ISSUES - Please fix before uploading');
}
console.log('='.repeat(50));
