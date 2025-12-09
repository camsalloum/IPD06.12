const axios = require('axios');

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:3001/api/aebf/budget-product-groups', {
      division: 'FP',
      budgetYear: '2026',
      salesRep: '__ALL__'
    });
    
    console.log('Success! Product Groups:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error:', error.response.data);
    }
  }
}

testAPI();
