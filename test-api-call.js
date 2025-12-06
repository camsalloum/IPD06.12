// Test the HTML budget customers API endpoint
const axios = require('axios');

async function testApiCall() {
  try {
    console.log('🔄 Calling html-budget-customers API...');
    
    const response = await axios.post('http://localhost:3001/api/aebf/html-budget-customers', {
      division: 'FP',
      actualYear: 2025,
      salesRep: 'Narek Koroukian'
    });
    
    if (response.data.success) {
      console.log('\n✅ API call successful!');
      console.log(`📊 Data rows: ${response.data.data?.length}`);
      console.log(`💰 Budget entries: ${Object.keys(response.data.budgetData || {}).length}`);
      
      // Show ALL data rows
      console.log('\n📋 All data rows:');
      response.data.data?.forEach((row, idx) => {
        console.log(`  ${idx+1}. [${row.customer}] | [${row.country}] | [${row.productGroup}]`);
      });
      
      // Show ALL budget entries
      console.log('\n💰 All budget entries:');
      Object.entries(response.data.budgetData || {}).forEach(([key, val]) => {
        console.log(`  [${key}] = ${val} MT`);
      });
      
      // Calculate total budget MT
      const budgetTotal = Object.values(response.data.budgetData || {}).reduce((sum, val) => sum + val, 0);
      console.log(`\n📈 Total budget MT: ${budgetTotal}`);
      
    } else {
      console.log('❌ API call failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testApiCall();
