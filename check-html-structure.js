const fs = require('fs');
const path = require('path');

// Read a sample HTML export file if it exists
const files = fs.readdirSync('.');
const htmlFile = files.find(f => f.includes('BUDGET_') && f.endsWith('.html'));

if (htmlFile) {
  console.log('Found HTML file:', htmlFile);
  const content = fs.readFileSync(htmlFile, 'utf8');
  
  // Check for actual-row structure
  const actualRowMatch = content.match(/<tr class="actual-row">(.*?)<\/tr>/s);
  if (actualRowMatch) {
    console.log('\n✓ Found actual-row structure');
    console.log('Sample:', actualRowMatch[1].substring(0, 200));
  }
  
  // Check for customer list
  const customersMatch = content.match(/const mergedCustomers = (\[.*?\]);/s);
  if (customersMatch) {
    console.log('\n✓ Found mergedCustomers list');
    const customers = JSON.parse(customersMatch[1]);
    console.log('Sample customers:', customers.slice(0, 5));
  }
} else {
  console.log('No HTML budget file found in current directory');
  console.log('Files:', files.filter(f => f.endsWith('.html')).slice(0, 10));
}
