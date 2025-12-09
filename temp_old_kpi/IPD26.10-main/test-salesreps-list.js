// Check what sales reps exist in database
const fetch = require('node-fetch');

async function checkSalesReps() {
  console.log('🔍 Checking Sales Reps in Database...\n');

  try {
    const response = await fetch('http://localhost:3001/api/sales-reps-db?division=FP');
    const result = await response.json();

    if (result.success && result.data) {
      console.log(`✅ Found ${result.data.length} sales reps:\n`);
      result.data.forEach((rep, idx) => {
        console.log(`${idx + 1}. "${rep}"`);
      });
    } else {
      console.error('❌ API Error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSalesReps();
