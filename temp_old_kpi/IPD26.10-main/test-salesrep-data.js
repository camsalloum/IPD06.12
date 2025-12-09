// Test script to check Sales Rep data for Nov-Dec Estimate
const fetch = require('node-fetch');

async function testSalesRepData() {
  console.log('🔍 Testing Sales Rep Divisional Data...\n');
  
  // Get sample sales reps
  const testSalesReps = ['Sojy & Direct Sales', 'Riad & Nidal', 'Narek Koroukian'];
  
  const testColumns = [
    {
      year: 2025,
      month: 'Jan-Oct',
      months: [1,2,3,4,5,6,7,8,9,10],
      type: 'Actual',
      columnKey: '2025-Jan-Oct-Actual'
    },
    {
      year: 2025,
      month: 'Nov-Dec',
      months: [11,12],
      type: 'Estimate',
      columnKey: '2025-Nov-Dec-Estimate'
    },
    {
      year: 2025,
      month: 'FY',
      type: 'Estimate',
      columnKey: '2025-FY-Estimate'
    }
  ];

  try {
    console.log('📞 Calling ULTRA-FAST Sales Rep Divisional API...');
    const response = await fetch('http://localhost:3001/api/sales-rep-divisional-ultra-fast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        division: 'FP',
        salesReps: testSalesReps,
        columns: testColumns
      })
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log('✅ API Response received\n');
      
      // Check each sales rep's data
      testSalesReps.forEach(rep => {
        const repUpper = rep.trim().toUpperCase();
        const repData = result.data[repUpper];
        
        console.log(`\n📊 Sales Rep: ${rep}`);
        if (repData) {
          testColumns.forEach(col => {
            const value = repData[col.columnKey] || 0;
            console.log(`   ${col.columnKey}: ${value.toLocaleString()}`);
          });
        } else {
          console.log('   ❌ No data found');
        }
      });
      
      // Check if Nov-Dec has data
      console.log('\n\n🔍 Checking Nov-Dec Estimate data...');
      let hasNovDecData = false;
      testSalesReps.forEach(rep => {
        const repUpper = rep.trim().toUpperCase();
        const repData = result.data[repUpper];
        const novDecValue = repData?.['2025-Nov-Dec-Estimate'] || 0;
        if (novDecValue > 0) {
          hasNovDecData = true;
          console.log(`   ✅ ${rep}: ${novDecValue.toLocaleString()}`);
        }
      });
      
      if (!hasNovDecData) {
        console.log('   ❌ No Nov-Dec Estimate data found for any sales rep!');
        console.log('   This means either:');
        console.log('   1. Database has no Estimate records for Nov-Dec');
        console.log('   2. Backend query is not filtering correctly');
      }
      
    } else {
      console.error('❌ API Error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSalesRepData();
