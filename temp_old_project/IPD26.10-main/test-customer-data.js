// Test script to check what data is being retrieved for customers
const fetch = require('node-fetch');

async function testCustomerData() {
  console.log('🔍 Testing Sales by Customer Data Retrieval...\n');
  
  // The three columns from the screenshot appear to be:
  // 1. 2025 Jan-Oct Actual
  // 2. 2025 Nov-Dec Estimate  
  // 3. 2025 Year Estimate (Jan-Dec combined)
  
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
      month: 'Year',
      type: 'Estimate',
      columnKey: '2025-Year-Estimate'
    }
  ];

  try {
    console.log('📞 Calling ULTRA-FAST API...');
    const response = await fetch('http://localhost:3001/api/sales-by-customer-ultra-fast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        division: 'FP',
        columns: testColumns
      })
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log('✅ API Response received\n');
      
      // Check each column's data
      testColumns.forEach(col => {
        const columnData = result.data[col.columnKey];
        console.log(`\n📊 Column: ${col.columnKey}`);
        console.log(`   Config: year=${col.year}, month=${col.month}, type=${col.type}`);
        
        if (columnData && columnData.length > 0) {
          console.log(`   ✅ ${columnData.length} customers found`);
          console.log(`   Top 5 customers:`);
          columnData.slice(0, 5).forEach((row, idx) => {
            console.log(`      ${idx + 1}. ${row.customer}: ${row.value.toLocaleString()}`);
          });
          
          // Calculate total
          const total = columnData.reduce((sum, row) => sum + row.value, 0);
          console.log(`   💰 Total: ${total.toLocaleString()}`);
        } else {
          console.log(`   ❌ No data returned`);
        }
      });
      
      // Check if all columns return identical data (the bug)
      console.log('\n\n🔍 Checking for duplicate data bug...');
      const keys = Object.keys(result.data);
      if (keys.length >= 2) {
        const firstColumnData = result.data[keys[0]];
        const secondColumnData = result.data[keys[1]];
        
        if (firstColumnData && secondColumnData && firstColumnData.length > 0 && secondColumnData.length > 0) {
          // Compare first customer's value
          const firstCustomerCol1 = firstColumnData[0];
          const firstCustomerCol2 = secondColumnData.find(c => c.customer === firstCustomerCol1.customer);
          
          if (firstCustomerCol2 && firstCustomerCol1.value === firstCustomerCol2.value) {
            console.log('❌ BUG DETECTED: First customer has identical values in different periods!');
            console.log(`   ${firstCustomerCol1.customer}: ${firstCustomerCol1.value.toLocaleString()} in both columns`);
            console.log('   This indicates the query might not be filtering by the correct period.');
          } else {
            console.log('✅ Values differ between columns (expected behavior)');
          }
        }
      }
      
    } else {
      console.error('❌ API Error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCustomerData();
