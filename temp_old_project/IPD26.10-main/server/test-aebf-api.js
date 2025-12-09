/**
 * Test Script for AEBF API Endpoints
 * Step 3: Backend API Testing
 * 
 * Run this after restarting the server to test all endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/aebf';

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testEndpoint(name, url, params = {}) {
  try {
    console.log(`\n${colors.blue}Testing: ${name}${colors.reset}`);
    console.log(`URL: ${url}`);
    if (Object.keys(params).length > 0) {
      console.log(`Params:`, params);
    }
    
    const response = await axios.get(url, { params });
    
    console.log(`${colors.green}✓ SUCCESS${colors.reset}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log('Error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(`${colors.yellow}======================================${colors.reset}`);
  console.log(`${colors.yellow}AEBF API Endpoint Tests${colors.reset}`);
  console.log(`${colors.yellow}======================================${colors.reset}`);
  
  const results = [];
  
  // Test 1: Health Check
  results.push(await testEndpoint(
    'Health Check',
    `${BASE_URL}/health`
  ));
  
  // Test 2: Get Actual Data (FP division)
  results.push(await testEndpoint(
    'Get Actual Data - FP Division (First Page)',
    `${BASE_URL}/actual`,
    { division: 'FP', page: 1, pageSize: 10 }
  ));
  
  // Test 3: Get Actual Data with filters
  results.push(await testEndpoint(
    'Get Actual Data - FP Division (Year 2024)',
    `${BASE_URL}/actual`,
    { division: 'FP', year: 2024, pageSize: 5 }
  ));
  
  // Test 4: Get Actual Data - AMOUNT only
  results.push(await testEndpoint(
    'Get Actual Data - FP Division (AMOUNT only)',
    `${BASE_URL}/actual`,
    { division: 'FP', values_type: 'AMOUNT', pageSize: 5 }
  ));
  
  // Test 5: Get Budget Data
  results.push(await testEndpoint(
    'Get Budget Data - FP Division',
    `${BASE_URL}/budget`,
    { division: 'FP', page: 1, pageSize: 10 }
  ));
  
  // Test 6: Get Summary Statistics
  results.push(await testEndpoint(
    'Get Summary Statistics - FP Division',
    `${BASE_URL}/summary`,
    { division: 'FP' }
  ));
  
  // Test 7: Get Summary for Actual only
  results.push(await testEndpoint(
    'Get Summary - FP Division (Actual only)',
    `${BASE_URL}/summary`,
    { division: 'FP', type: 'Actual' }
  ));
  
  // Test 8: Error test - Missing division
  results.push(await testEndpoint(
    'Error Test - Missing Division Parameter',
    `${BASE_URL}/actual`,
    { page: 1 }
  ));
  
  // Test 9: Error test - Invalid division
  results.push(await testEndpoint(
    'Error Test - Invalid Division',
    `${BASE_URL}/actual`,
    { division: 'INVALID', page: 1 }
  ));
  
  // Test 10: Sorting by values (descending)
  results.push(await testEndpoint(
    'Sorting Test - Sort by values DESC',
    `${BASE_URL}/actual`,
    { division: 'FP', sortBy: 'values', sortOrder: 'desc', pageSize: 5 }
  ));
  
  // Test 11: Search across fields
  results.push(await testEndpoint(
    'Search Test - Search for "FILM"',
    `${BASE_URL}/actual`,
    { division: 'FP', search: 'FILM', pageSize: 5 }
  ));
  
  // Test 12: Get distinct customer names
  results.push(await testEndpoint(
    'Distinct Values - Customer Names',
    `${BASE_URL}/distinct/customername`,
    { division: 'FP' }
  ));
  
  // Test 13: Get distinct years
  results.push(await testEndpoint(
    'Distinct Values - Years',
    `${BASE_URL}/distinct/year`,
    { division: 'FP' }
  ));
  
  // Test 14: Filter by customer name (partial match)
  results.push(await testEndpoint(
    'Filter Test - Customer name contains "MISC"',
    `${BASE_URL}/actual`,
    { division: 'FP', customername: 'MISC', pageSize: 5 }
  ));
  
  // Summary
  console.log(`\n${colors.yellow}======================================${colors.reset}`);
  console.log(`${colors.yellow}Test Summary${colors.reset}`);
  console.log(`${colors.yellow}======================================${colors.reset}`);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${results.length}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}✗ Some tests failed${colors.reset}`);
  }
}

// Run tests
runTests().catch(console.error);
