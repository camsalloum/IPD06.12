/**
 * PLExport.js
 * Clean, dedicated module for exporting P&L Financial Table as HTML card
 * Handles all P&L-specific capture, styling, and rendering logic
 */

/**
 * Get P&L Table CSS content
 * Extracts styles from the loaded stylesheet to ensure export matches live page
 */
const getPLTableStyles = async () => {
  try {
    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    for (const sheet of styleSheets) {
      try {
        // Check if this is the PLTableStyles.css file
        const href = sheet.href || '';
        if (href.includes('PLTableStyles.css')) {
          // Extract ALL rules from this stylesheet
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          if (allStyles) {
            console.log('✅ Extracted ALL P&L styles from PLTableStyles.css stylesheet');
            return allStyles;
          }
        }
        
        // Also try to find rules by content (fallback if href doesn't match)
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const plStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            const selector = rule.selectorText || '';
            // Match any rule that mentions P&L table classes or CSS variables
            return cssText.includes('.pl-financial-table') || 
                   cssText.includes('.pl-table-') ||
                   cssText.includes('.pl-separator-row') ||
                   cssText.includes('--pl-hdr-h') ||
                   (selector === ':root' && cssText.includes('--pl-'));
          })
          .map(rule => rule.cssText)
          .join('\n');
        
        if (plStyles && plStyles.length > 1000) { // Only use if we got substantial styles
          console.log('✅ Extracted P&L styles from loaded stylesheet (by content)');
          return plStyles;
        }
      } catch (e) {
        // Cross-origin stylesheet or access denied, skip
        continue;
      }
    }

    // Method 2: Try to fetch the CSS file (works in dev)
    try {
      const response = await fetch('/src/components/dashboard/PLTableStyles.css');
      if (response.ok) {
        const cssText = await response.text();
        console.log('✅ Fetched P&L styles from CSS file');
        return cssText;
      }
    } catch (error) {
      // Continue to fallback
    }

    // Method 3: Try alternative paths
    const alternativePaths = [
      './src/components/dashboard/PLTableStyles.css',
      '../dashboard/PLTableStyles.css',
      'PLTableStyles.css'
    ];

    for (const path of alternativePaths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ Fetched P&L styles from ${path}`);
          return cssText;
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.warn('Could not extract/fetch PLTableStyles.css, using comprehensive fallback');
  }

  // Fallback: Return comprehensive inline styles matching current PLTableStyles.css
  // This ensures export works even if CSS file can't be loaded
  // NOTE: This should be kept in sync with PLTableStyles.css
  return `
    /* ========================================
       UNIFIED P&L TABLE STYLES - EXPORT FALLBACK
       This fallback ensures export works even if CSS file can't be loaded
       Should match PLTableStyles.css for consistency
       ======================================== */
    :root {
      --pl-hdr-h: 28px;
      --z-corner: 20;
      --z-hdr4: 16;
      --z-hdr3: 15;
      --z-hdr2: 14;
      --z-hdr1: 13;
      --z-firstcol: 12;
      --z-header: 10;
      --z-separator: 1;
    }

    .pl-table-view {
      width: 100%;
      padding: 20px;
      margin-top: 20px;
      max-width: 100%;
      overflow: visible;
      box-sizing: border-box;
      background-color: #fff;
    }

    .pl-table-container {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      position: relative !important;
      overflow-x: auto !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      max-height: 80vh !important;
      min-height: 50vh !important;
      padding-bottom: 10px !important;
      background-color: #fff !important;
    }

    .pl-financial-table {
      width: 100%;
      min-width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: clamp(9px, 1.8vw, 12px);
      font-family: Arial, sans-serif;
      table-layout: fixed;
      max-width: 100%;
      background: #fff;
      background-color: #fff;
    }

    .pl-financial-table thead th {
      font-size: clamp(11px, 2.1vw, 14px);
      height: var(--pl-hdr-h) !important;
      min-height: var(--pl-hdr-h) !important;
      max-height: var(--pl-hdr-h) !important;
      position: sticky !important;
      top: 0;
      z-index: var(--z-hdr1);
      font-weight: 700;
      overflow: hidden !important;
      box-sizing: border-box !important;
      padding: 4px 6px !important;
      line-height: 1.2 !important;
      vertical-align: middle !important;
      background-color: transparent;
      background-clip: padding-box !important;
      text-align: center;
    }

    .pl-financial-table thead tr:nth-child(1) th {
      top: 0 !important;
      z-index: var(--z-hdr4) !important;
    }
    .pl-financial-table thead tr:nth-child(2) th {
      top: calc(var(--pl-hdr-h) * 1) !important;
      z-index: var(--z-hdr3) !important;
    }
    .pl-financial-table thead tr:nth-child(3) th {
      top: calc(var(--pl-hdr-h) * 2) !important;
      z-index: var(--z-hdr2) !important;
    }
    .pl-financial-table thead tr:nth-child(4) th {
      top: calc(var(--pl-hdr-h) * 3) !important;
      z-index: var(--z-hdr1) !important;
      font-size: 12px !important;
      font-family: Arial, sans-serif;
      text-align: center !important;
      padding-left: 6px !important;
      padding-right: 6px !important;
      padding-top: 4px !important;
      padding-bottom: 4px !important;
      box-sizing: border-box !important;
    }

    .pl-financial-table th,
    .pl-financial-table td {
      padding: clamp(2px, 0.5vw, 8px) clamp(3px, 0.7vw, 12px);
      vertical-align: middle;
      text-align: center;
      line-height: 1.15;
      white-space: normal;
      word-break: normal;
      overflow-wrap: anywhere;
      background-clip: border-box;
    }

    .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child {
      position: sticky !important;
      left: 0 !important;
      z-index: var(--z-firstcol) !important;
      background-color: transparent;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 28ch;
      min-width: 120px;
      box-sizing: border-box;
    }

    /* RECTANGLE BORDERS - 1px solid black borders */
    .pl-financial-table thead tr:first-child th {
      border-top: 1px solid black !important;
    }

    .pl-financial-table tbody tr:last-child td {
      border-bottom: 1px solid black !important;
    }

    /* SEPARATOR ROW - 8px height, no internal vertical borders */
    .pl-financial-table .pl-separator-row {
      height: 8px !important;
      line-height: 8px !important;
      padding: 0 !important;
    }

    .pl-financial-table .pl-separator-row td {
      position: sticky !important;
      top: calc(var(--pl-hdr-h) * 4) !important;
      z-index: var(--z-hdr1) !important;
      height: 8px !important;
      padding: 0 !important;
      background-color: white !important;
      border-top: 1px solid black !important;
      border-bottom: 1px solid black !important;
      border-left: none !important;
      border-right: none !important;
      background-clip: padding-box !important;
    }

    .pl-financial-table .pl-separator-row td:first-child {
      position: sticky !important;
      left: 0 !important;
      top: calc(var(--pl-hdr-h) * 4) !important;
      z-index: var(--z-corner) !important;
      background-color: white !important;
      border-top: 1px solid black !important;
      border-bottom: 1px solid black !important;
      border-left: 1px solid black !important;
      border-right: none !important;
      height: 8px !important;
      padding: 0 !important;
      margin: 0 !important;
      vertical-align: top !important;
    }

    .pl-financial-table .pl-separator-row td:nth-child(n+2):not(:last-child) {
      border-left: none !important;
      border-right: none !important;
    }

    .pl-financial-table .pl-separator-row td:last-child {
      border-right: 1px solid black !important;
      border-left: none !important;
    }

    /* LEDGER COLUMN BORDERS */
    .pl-financial-table thead tr:first-child th.pl-ledger-header {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    .pl-financial-table tbody tr td:nth-child(1) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    /* PERIOD BORDERS - Header rows 1-3 */
    .pl-financial-table thead tr:nth-child(1) th:nth-child(2),
    .pl-financial-table thead tr:nth-child(2) th:nth-child(1),
    .pl-financial-table thead tr:nth-child(3) th:nth-child(1) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    .pl-financial-table thead tr:nth-child(1) th:nth-child(3),
    .pl-financial-table thead tr:nth-child(2) th:nth-child(2),
    .pl-financial-table thead tr:nth-child(3) th:nth-child(2) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    .pl-financial-table thead tr:nth-child(1) th:nth-child(4),
    .pl-financial-table thead tr:nth-child(2) th:nth-child(3),
    .pl-financial-table thead tr:nth-child(3) th:nth-child(3) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    .pl-financial-table thead tr:nth-child(1) th:nth-child(5),
    .pl-financial-table thead tr:nth-child(2) th:nth-child(4),
    .pl-financial-table thead tr:nth-child(3) th:nth-child(4) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    .pl-financial-table thead tr:nth-child(1) th:nth-child(6),
    .pl-financial-table thead tr:nth-child(2) th:nth-child(5),
    .pl-financial-table thead tr:nth-child(3) th:nth-child(5) {
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }

    /* HEADER ROW 4: Period borders */
    .pl-financial-table thead tr:nth-child(4) th:nth-child(1) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(3) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(4) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(6) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(7) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(9) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(10) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(12) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(13) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table thead tr:nth-child(4) th:nth-child(15) {
      border-right: 1px solid black !important;
    }

    /* BODY ROWS: Period borders */
    .pl-financial-table tbody tr td:nth-child(2) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(4) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(5) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(7) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(8) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(10) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(11) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(13) {
      border-right: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(14) {
      border-left: 1px solid black !important;
    }
    .pl-financial-table tbody tr td:nth-child(16) {
      border-right: 1px solid black !important;
    }

    .pl-financial-table thead tr:first-child th.pl-ledger-header {
      position: sticky !important;
      left: 0 !important;
      top: 0 !important;
      z-index: var(--z-corner) !important;
      background-color: transparent;
      text-align: center !important;
      vertical-align: middle !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 120px;
      max-width: 30ch;
      box-sizing: border-box;
    }

    .pl-financial-table td:first-child {
      text-align: left;
      padding-left: 12px;
    }

    @media (min-width: 1200px) {
      .pl-financial-table {
        font-size: 12px;
        min-width: 100%;
      }
      .pl-financial-table thead th {
        font-size: 14px;
        padding: 4px 6px !important;
      }
      .pl-financial-table thead tr:nth-child(4) th {
        font-size: 12px !important;
        font-family: Arial, sans-serif;
      }
      .pl-financial-table td {
        padding: 8px 12px;
      }
    }

    @media print {
      .pl-financial-table { font-size: 10px; background:#fff; }
      .pl-financial-table th, .pl-financial-table td { padding: 4px 6px; }
    }
  `;
};

/**
 * Wait for table data to load
 * @param {string} selector - CSS selector for the table
 * @param {number} timeout - Maximum wait time in milliseconds
 */
const waitForTableData = (selector, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(checkInterval);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, 100);
  });
};

/**
 * Navigate to P&L tab and ensure it's active
 */
const ensurePLTabActive = async () => {
  const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
  const plTab = allButtons.find(el => {
    const text = el.textContent?.trim();
    return (text === 'P&L' || text === 'P&L Financial' || text.includes('P&L')) && text.length < 50;
  });

  if (plTab) {
    const isActive = plTab.classList.contains('active') ||
                    plTab.getAttribute('aria-selected') === 'true';
    if (!isActive) {
      console.log('🔄 Switching to P&L tab for capture...');
      plTab.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};

/**
 * Capture the live P&L Financial table from the DOM
 * @returns {Promise<string>} HTML string of the captured table
 */
export const capturePLTable = async () => {
  try {
    // Navigate to P&L tab
    await ensurePLTabActive();

    // Find the P&L table using multiple selectors
    let plTable = document.querySelector('table.pl-financial-table') ||
                 document.querySelector('table.financial-table') ||
                 document.querySelector('.table-view table');

    if (!plTable) {
      // Fallback: search for table with financial metrics
      const allTables = Array.from(document.querySelectorAll('table'));
      plTable = allTables.find(table => {
        const tableText = table.textContent || '';
        const hasFinancialMetrics = tableText.includes('Revenue') ||
                                   tableText.includes('Sales') ||
                                   tableText.includes('Gross Profit') ||
                                   tableText.includes('EBITDA') ||
                                   tableText.includes('Operating') ||
                                   tableText.includes('Net Income');

        const isInTableView = table.closest('.table-view');
        return hasFinancialMetrics && isInTableView;
      });
    }

    if (!plTable) {
      throw new Error('P&L Financial table not found');
    }

    console.log('✅ P&L table found, cloning and processing...');

    // Clone the table to avoid modifying the live version
    const clonedTable = plTable.cloneNode(true);

    // Add the standard class name for consistent styling
    clonedTable.classList.add('pl-financial-table');

    // Remove unwanted inline styles while preserving background colors
    const removeInlineStyles = (element, preserveProps = ['background-color', 'background']) => {
      if (element.hasAttribute && element.hasAttribute('style')) {
        const style = element.getAttribute('style');
        const preserved = {};

        // Extract preserved properties
        preserveProps.forEach(prop => {
          const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i');
          const match = style.match(regex);
          if (match) {
            preserved[prop] = match[1].trim();
          }
        });

        // Clear all styles
        element.removeAttribute('style');

        // Restore preserved properties
        Object.entries(preserved).forEach(([prop, value]) => {
          element.style[prop.replace(/-./g, x => x[1].toUpperCase())] = value;
        });
      }
    };

    // Clean up table element
    removeInlineStyles(clonedTable);

    // Clean up all rows, cells
    clonedTable.querySelectorAll('tr, th, td').forEach(el => {
      removeInlineStyles(el, ['background-color', 'background']);
    });

    // Remove empty rows from thead
    const theadRows = clonedTable.querySelectorAll('thead tr');
    theadRows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const hasContent = Array.from(cells).some(cell => {
        const text = cell.textContent?.trim();
        return text && text.length > 0 && text !== ' ' && text !== '\u00A0';
      });
      if (!hasContent) {
        row.remove();
      }
    });

    // Fix header text formatting
    const headerCells = clonedTable.querySelectorAll('thead tr th');
    headerCells.forEach(th => {
      const text = th.textContent?.trim();
      // Update "% of Sales" to "% of Sls"
      if (text.includes('%') && (text.includes('Sales') || text.includes('Sls'))) {
        if (!text.includes('Sls')) {
          th.innerHTML = '% of Sls';
        }
      }
      // Update "per Kg" to "/ Kg" (preserve currency symbol if present)
      if (text.includes('Kg') && (text.includes('per') || text.includes('/'))) {
        if (text.includes('per')) {
          // Check if there's a currency symbol in the original HTML
          const originalHTML = th.innerHTML;
          if (originalHTML.includes('Đ') || originalHTML.includes('AED') || originalHTML.includes('د.إ')) {
            th.innerHTML = 'Đ / Kg';
          } else {
            th.innerHTML = '/ Kg';
          }
        }
      }
      // Add currency symbol if needed
      if (text === 'Amount' || text.includes('AED')) {
        const currentText = th.textContent.trim();
        if (!currentText.includes('AED')) {
          th.innerHTML = `${currentText}<br/><small>AED</small>`;
        }
      }
    });

    // Preserve colgroup for column widths
    const colgroup = clonedTable.querySelector('colgroup');
    if (colgroup) {
      console.log('✅ Preserving colgroup widths');
    }

    return clonedTable.outerHTML;

  } catch (error) {
    console.error('❌ Error capturing P&L table:', error);
    throw error;
  }
};

/**
 * Generate complete HTML for P&L export card
 * @param {string} tableHTML - The captured table HTML
 * @param {string} divisionName - Division name for the title
 * @returns {Promise<string>} Complete HTML card with styles
 */
export const generatePLCard = async (tableHTML, divisionName = 'Division') => {
  const plTableStyles = await getPLTableStyles();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>P&L Financial Statement - ${divisionName}</title>
  <style>
    /* ========================================
       GLOBAL RESET & BASE STYLES
       ======================================== */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      padding: 20px;
      margin: 0;
    }

    /* ========================================
       CARD CONTAINER
       ======================================== */
    .chart-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 20px auto;
      max-width: 1400px;
      overflow: hidden;
    }

    /* ========================================
       BLUE RIBBON HEADER
       ======================================== */
    .blue-ribbon {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 20px;
      text-align: center;
      border-bottom: 3px solid #1e40af;
    }

    .blue-ribbon h2 {
      font-size: 1.8rem;
      font-weight: bold;
      margin: 0;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    }

    .blue-ribbon .subtitle {
      font-size: 1rem;
      margin-top: 8px;
      opacity: 0.95;
      font-style: italic;
    }

    /* ========================================
       P&L TABLE STYLES (IMPORTED FROM PLTableStyles.css)
       ======================================== */
    ${plTableStyles}

    /* ========================================
       EXPORT-SPECIFIC OVERRIDES
       ======================================== */
    .pl-table-view {
      width: 100%;
      padding: 20px;
      margin-top: 0;
      max-width: 100%;
      overflow: visible;
      box-sizing: border-box;
      background-color: #fff;
    }

    .pl-table-container {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      position: relative !important;
      overflow-x: auto !important;
      overflow-y: auto !important;  /* ✅ Enable vertical scrolling for sticky headers */
      -webkit-overflow-scrolling: touch !important;
      max-height: 80vh !important;
      min-height: 50vh !important;
      padding-bottom: 10px !important;
      background-color: #fff !important;
    }

    /* ========================================
       PRINT STYLES
       ======================================== */
    @media print {
      body {
        background-color: white;
        padding: 0;
      }

      .chart-card {
        box-shadow: none;
        margin: 0;
        max-width: 100%;
      }

      .pl-financial-table {
        font-size: 10px;
      }

      .pl-financial-table th,
      .pl-financial-table td {
        padding: 4px 6px;
      }
    }
  </style>
</head>
<body>
  <div class="chart-card" id="pl-financial-card">
    <!-- Blue ribbon header -->
    <div class="blue-ribbon">
      <h2>Profit and Loss Statement</h2>
      <div class="subtitle">${divisionName} - Comprehensive Financial Overview</div>
    </div>

    <!-- P&L Table Content -->
    <div class="pl-table-view">
      <div class="pl-table-container">
        ${tableHTML}
      </div>
    </div>
  </div>

  <script>
    // Log successful load
    console.log('✅ P&L Financial Card loaded successfully');

    // Ensure table is visible
    document.addEventListener('DOMContentLoaded', function() {
      const table = document.querySelector('.pl-financial-table');
      if (table) {
        console.log('✅ P&L table found and ready');
        console.log('📊 Table dimensions:', {
          width: table.offsetWidth,
          height: table.offsetHeight,
          rows: table.querySelectorAll('tbody tr').length,
          headerRows: table.querySelectorAll('thead tr').length
        });
      } else {
        console.error('❌ P&L table not found in DOM');
      }
    });
  </script>
</body>
</html>
  `.trim();
};

/**
 * Export P&L Financial table as standalone HTML file
 * @param {string} divisionName - Division name for the title
 * @returns {Promise<void>}
 */
export const exportPLAsCard = async (divisionName = 'Division') => {
  try {
    console.log('🚀 Starting P&L export...');

    // Capture the live P&L table
    const tableHTML = await capturePLTable();

    // Generate complete HTML card
    const htmlContent = await generatePLCard(tableHTML, divisionName);

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PL-Financial-${divisionName}-${new Date().toISOString().split('T')[0]}.html`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ P&L export completed successfully');
    return htmlContent;

  } catch (error) {
    console.error('❌ P&L export failed:', error);
    throw error;
  }
};

export default {
  capturePLTable,
  generatePLCard,
  exportPLAsCard
};
