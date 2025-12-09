// Save this to check-visible-tables.js
console.log('🔍 Checking what tables are visible in the DOM...');
console.log('');

const tables = {
  'Product Group': 'table.product-group-table',
  'P&L Financial': 'table.pl-financial-table',
  'Sales by Customer': 'table.sales-by-customer-table',
  'Sales by Sales Rep': 'table.sales-by-sales-rep-table',
  'Sales by Country': 'table.sales-by-country-table'
};

const cards = {
  'Divisional KPIs': '.divisional-dashboard__card',
  'KPI Dashboard': '.kpi-dashboard'
};

console.log('📊 TABLES IN DOM:');
Object.entries(tables).forEach(([name, selector]) => {
  const found = document.querySelector(selector);
  console.log(   : );
  if (found) {
    console.log(     → Visible: );
    console.log(     → Rows: );
  }
});

console.log('');
console.log('🎴 DASHBOARD CARDS:');
const allCards = document.querySelectorAll('.divisional-dashboard__card');
console.log(  Found  cards);
allCards.forEach((card, i) => {
  const title = card.querySelector('.divisional-dashboard__card-title');
  console.log(  . );
});

console.log('');
console.log('📦 KPI CONTAINER:');
const kpi = document.querySelector('.kpi-dashboard');
console.log(   .kpi-dashboard found);
if (kpi) {
  console.log(     → Visible: );
}

console.log('');
console.log('🎯 OVERLAY STATE:');
const overlay = document.querySelector('.divisional-dashboard__overlay');
console.log(   .divisional-dashboard__overlay found);
if (overlay) {
  console.log(     → Display: );
}
