import React, { useState } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { useFilter } from '../../contexts/FilterContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import { formatCustomRangeDisplay } from '../../utils/periodHelpers';
// CSS is extracted at runtime from loaded stylesheets - ensures exports match live CSS
import './PLTableStyles.css'; // Unified P&L table styling
import './ProductGroupTableStyles.css'; // Product Group table styling
import './SalesByCountryTableStyles.css'; // Sales by Country table styling
import './SalesByCustomerTableNew.css'; // Sales by Customer table styling
import ipTransparentLogo from '../../assets/IP transparent-.jpg';

/**
 * ⚠️ STRING CONCATENATION PATTERN GUIDE:
 * 
 * CORRECT: Use function calls with string concatenation
 * ✅ html += getUAEDirhamSymbolHTML() + ' ' + value;
 * ✅ html += '<div>' + someFunction() + '</div>';
 * 
 * INCORRECT: Template literals inside single quotes don't evaluate
 * ❌ html += '${getUAEDirhamSymbolHTML()} ' + value;  // Shows literal text!
 * ❌ html += '<div>${someFunction()}</div>';  // Shows literal text!
 * 
 * This file uses string concatenation for HTML generation to maintain
 * consistency and avoid template literal evaluation issues in exported HTML.
 */

// Added missing table style extraction helpers (referenced later in export assembly)
// Lightweight versions: attempt stylesheet extraction, fall back to static import or empty string.
const getSalesByCountryTableStyles = async () => {
  try {
    console.log('🔍 Starting Sales by Country CSS extraction...');

    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    console.log(`📄 Found ${styleSheets.length} stylesheets to check`);

    for (const sheet of styleSheets) {
      try {
        const href = sheet.href || '';
        console.log(`🔍 Checking stylesheet: ${href || '(inline)'}`);

        // Check for SalesByCountryTableStyles.css file
        if (href.includes('SalesByCountryTableStyles.css')) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          console.log(`📊 Extracted ${allStyles.length} characters, ${rules.length} rules from ${href}`);

          if (allStyles && allStyles.length > 1000) {
            console.log('✅ SUCCESS: Extracted ALL Sales by Country styles from SalesByCountryTableStyles.css stylesheet');
            console.log(`📏 Total CSS size: ${allStyles.length} characters`);
            console.log(`📝 First 500 chars: ${allStyles.substring(0, 500)}`);
            return allStyles;
          }
        }

        // Also try to find rules by content - MUST HAVE .sales-by-country-table
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const sbcStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            return cssText.includes('.sales-by-country-table') ||
                   cssText.includes('.country-table-container') ||
                   cssText.includes('--sbc-');
          })
          .map(rule => rule.cssText)
          .join('\n');

        if (sbcStyles && sbcStyles.length > 1000) {
          console.log(`✅ SUCCESS: Extracted Sales by Country styles from loaded stylesheet (by content)`);
          console.log(`📏 Total CSS size: ${sbcStyles.length} characters`);
          console.log(`📝 First 500 chars: ${sbcStyles.substring(0, 500)}`);
          return sbcStyles;
        }
      } catch (e) {
        console.warn(`⚠️ Could not access stylesheet rules (CORS or other issue):`, e.message);
        continue;
      }
    }

    console.log('⚠️ Method 1 failed, trying Method 2: Direct file fetch');

    // Method 2: Try to fetch the CSS file
    const alternativePaths = [
      '/src/components/dashboard/SalesByCountryTableStyles.css',
      './src/components/dashboard/SalesByCountryTableStyles.css',
      '../dashboard/SalesByCountryTableStyles.css',
      'SalesByCountryTableStyles.css'
    ];

    for (const path of alternativePaths) {
      try {
        console.log(`🔍 Trying to fetch: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ SUCCESS: Fetched Sales by Country styles from ${path}`);
          console.log(`📏 Total CSS size: ${cssText.length} characters`);
          console.log(`📝 First 500 chars: ${cssText.substring(0, 500)}`);
          return cssText;
        } else {
          console.log(`❌ Failed to fetch ${path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching ${path}:`, error.message);
        continue;
      }
    }

    console.error('❌ All CSS extraction methods failed!');
  } catch (error) {
    console.error('❌ CRITICAL: Could not extract/fetch Sales by Country Table styles:', error);
  }

  // No hardcoded fallback - runtime extraction is the source of truth
  console.warn('⚠️ Sales by Country CSS extraction failed');
  return '';
};

const getSalesByCustomerTableStyles = async () => {
  try {
    console.log('🔍 Starting Sales by Customer CSS extraction...');

    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    console.log(`📄 Found ${styleSheets.length} stylesheets to check`);

    for (const sheet of styleSheets) {
      try {
        const href = sheet.href || '';
        console.log(`🔍 Checking stylesheet: ${href || '(inline)'}`);

        // Check for SalesByCustomerTableNew.css file - if found, extract ALL rules
        if (href.includes('SalesByCustomerTable') || href.includes('SalesByCustomerTableNew.css')) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          console.log(`📊 Extracted ${allStyles.length} characters, ${rules.length} rules from ${href}`);

          if (allStyles && allStyles.length > 10000) { // Increased threshold for this large file
            console.log('✅ SUCCESS: Extracted ALL Sales by Customer styles from SalesByCustomerTableNew.css stylesheet');
            console.log(`📏 Total CSS size: ${allStyles.length} characters`);
            console.log(`📝 First 500 chars: ${allStyles.substring(0, 500)}`);
            return allStyles;
          }
        }

        // Content-based fallback: Try to find rules by content
        // Only use this if href-based extraction failed
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const sbcStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            // Match Sales by Customer specific classes
            // Use --sbc- variables but exclude --sbsr- (sales rep variables)
            const hasCustomerClasses = cssText.includes('.sales-by-customer-table') ||
                                      cssText.includes('.customer-name-cell') ||
                                      cssText.includes('.customer-header-row');
            const hasCustomerVars = cssText.includes('--sbc-') && !cssText.includes('--sbsr-');
            const isCountryTable = cssText.includes('.sales-by-country-table');
            const isSalesRepTable = cssText.includes('.sales-by-sales-rep-table') || cssText.includes('.sbsr-');
            
            return (hasCustomerClasses || hasCustomerVars) && !isCountryTable && !isSalesRepTable;
          })
          .map(rule => rule.cssText)
          .join('\n');

        if (sbcStyles && sbcStyles.length > 10000) {
          console.log(`✅ SUCCESS: Extracted Sales by Customer styles from loaded stylesheet (by content)`);
          console.log(`📏 Total CSS size: ${sbcStyles.length} characters`);
          console.log(`📝 First 500 chars: ${sbcStyles.substring(0, 500)}`);
          return sbcStyles;
        }
      } catch (e) {
        console.warn(`⚠️ Could not access stylesheet rules (CORS or other issue):`, e.message);
        continue;
      }
    }

    console.log('⚠️ Method 1 failed, trying Method 2: Direct file fetch');

    // Method 2: Try to fetch the CSS file
    const alternativePaths = [
      '/src/components/dashboard/SalesByCustomerTableNew.css',
      './src/components/dashboard/SalesByCustomerTableNew.css',
      '../dashboard/SalesByCustomerTableNew.css',
      'SalesByCustomerTableNew.css'
    ];

    for (const path of alternativePaths) {
      try {
        console.log(`🔍 Trying to fetch: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ SUCCESS: Fetched Sales by Customer styles from ${path}`);
          console.log(`📏 Total CSS size: ${cssText.length} characters`);
          console.log(`📝 First 500 chars: ${cssText.substring(0, 500)}`);
          return cssText;
        } else {
          console.log(`❌ Failed to fetch ${path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching ${path}:`, error.message);
        continue;
      }
    }

    console.error('❌ All CSS extraction methods failed!');
  } catch (error) {
    console.error('❌ CRITICAL: Could not extract/fetch Sales by Customer Table styles:', error);
  }

  // Fallback: Return empty string and log warning
  console.warn('⚠️⚠️⚠️ FALLING BACK TO EMPTY CSS - Export may not have proper styling! ⚠️⚠️⚠️');
  return '';
};

// Helper function to get UAE Dirham symbol SVG for HTML strings (standalone)
const getUAEDirhamSymbolHTML = () => {
  return '<svg class="uae-dirham-symbol" viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style="display: inline-block; vertical-align: -0.1em; width: 1em; height: 1em; margin-right: 0.2em;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>';
};

// Helper function to get currency symbol HTML for exports (supports dynamic currency)
const getCurrencySymbolHTML = (currency) => {
  if (!currency || currency.code === 'AED') {
    return getUAEDirhamSymbolHTML();
  }
  // For other currencies, return a simple span with the symbol
  return `<span style="margin-right: 0.2em; font-weight: 600;">${currency.symbol || currency.code}</span>`;
};

/**
 * Get Product Group Table CSS content
 * Extracts styles from the loaded stylesheet to ensure export matches live page
 */
const getProductGroupTableStyles = async () => {
  try {
    console.log('🔍 Starting Product Group CSS extraction...');

    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    console.log(`📄 Found ${styleSheets.length} stylesheets to check`);

    for (const sheet of styleSheets) {
      try {
        const href = sheet.href || '';
        console.log(`🔍 Checking stylesheet: ${href || '(inline)'}`);

        // Check for ProductGroupTableStyles.css file
        if (href.includes('ProductGroupTableStyles.css') || href.includes('product-group-table')) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          console.log(`📊 Extracted ${allStyles.length} characters, ${rules.length} rules from ${href}`);

          if (allStyles && allStyles.length > 1000) {
            console.log('✅ SUCCESS: Extracted ALL Product Group styles from ProductGroupTableStyles.css stylesheet');
            console.log(`📏 Total CSS size: ${allStyles.length} characters`);
            console.log(`📝 First 500 chars: ${allStyles.substring(0, 500)}`);
            return allStyles;
          }
        }

        // Also try to find rules by content - MUST HAVE .product-group-table
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const pgStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            // CRITICAL: Must contain .product-group-table
            return cssText.includes('.product-group-table') ||
                   cssText.includes('.pg-table-container') ||
                   cssText.includes('.pg-separator-row') ||
                   cssText.includes('--pg-');
          })
          .map(rule => rule.cssText)
          .join('\n');

        if (pgStyles && pgStyles.length > 1000) {
          console.log(`✅ SUCCESS: Extracted Product Group styles from loaded stylesheet (by content)`);
          console.log(`📏 Total CSS size: ${pgStyles.length} characters`);
          console.log(`📝 First 500 chars: ${pgStyles.substring(0, 500)}`);
          return pgStyles;
        }
      } catch (e) {
        console.warn(`⚠️ Could not access stylesheet rules (CORS or other issue):`, e.message);
        continue;
      }
    }

    console.log('⚠️ Method 1 failed, trying Method 2: Direct file fetch');

    // Method 2: Try to fetch the CSS file
    const alternativePaths = [
      '/src/components/dashboard/ProductGroupTableStyles.css',
      './src/components/dashboard/ProductGroupTableStyles.css',
      '../dashboard/ProductGroupTableStyles.css',
      'ProductGroupTableStyles.css'
    ];

    for (const path of alternativePaths) {
      try {
        console.log(`🔍 Trying to fetch: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ SUCCESS: Fetched Product Group styles from ${path}`);
          console.log(`📏 Total CSS size: ${cssText.length} characters`);
          console.log(`📝 First 500 chars: ${cssText.substring(0, 500)}`);
          return cssText;
        } else {
          console.log(`❌ Failed to fetch ${path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching ${path}:`, error.message);
        continue;
      }
    }

    console.error('❌ All CSS extraction methods failed!');
  } catch (error) {
    console.error('❌ CRITICAL: Could not extract/fetch Product Group Table styles:', error);
  }

  // Fallback: Return empty string and log warning
  console.warn('⚠️⚠️⚠️ FALLING BACK TO EMPTY CSS - Export may not have proper styling! ⚠️⚠️⚠️');
  return '';
};

/**
 * Sales by Sales Rep Table Styles - Extract from loaded stylesheet
 * Extracts styles from the loaded stylesheet to ensure export matches live page
 */
const getSalesBySalesRepTableStyles = async () => {
  try {
    console.log('🔍 Starting Sales by Sales Rep CSS extraction...');

    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    console.log(`📄 Found ${styleSheets.length} stylesheets to check`);

    for (const sheet of styleSheets) {
      try {
        const href = sheet.href || '';
        console.log(`🔍 Checking stylesheet: ${href || '(inline)'}`);

        // Check for SalesBySalesRepTable.css file - if found, extract ALL rules
        if (href.includes('SalesBySalesRepTable.css') || href.includes('sales-by-sales-rep')) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          console.log(`📊 Extracted ${allStyles.length} characters, ${rules.length} rules from ${href}`);

          if (allStyles && allStyles.length > 10000) { // Increased threshold for this large file
            console.log('✅ SUCCESS: Extracted ALL Sales by Sales Rep styles from SalesBySalesRepTable.css stylesheet');
            console.log(`📏 Total CSS size: ${allStyles.length} characters`);
            console.log(`📝 First 500 chars: ${allStyles.substring(0, 500)}`);
            return allStyles;
          }
        }

        // Content-based fallback: Try to find rules by content
        // Only use this if href-based extraction failed
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const sbsrStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            // Match Sales by Sales Rep specific classes, variables, AND :root for CSS variables
            return cssText.includes('.sales-by-sales-rep-table') ||
                   cssText.includes('.sbsr-table-container') ||
                   cssText.includes('.sbsr-table-view') ||
                   cssText.includes('.sales-rep-name-cell') ||
                   cssText.includes('.sbsr-separator-row') ||
                   cssText.includes('--sbsr-') ||
                   (cssText.startsWith(':root') && cssText.includes('--sbsr-'));
          })
          .map(rule => rule.cssText)
          .join('\n');

        if (sbsrStyles && sbsrStyles.length > 10000) {
          console.log(`✅ SUCCESS: Extracted Sales by Sales Rep styles from loaded stylesheet (by content)`);
          console.log(`📏 Total CSS size: ${sbsrStyles.length} characters`);
          console.log(`📝 First 500 chars: ${sbsrStyles.substring(0, 500)}`);
          return sbsrStyles;
        }
      } catch (e) {
        console.warn(`⚠️ Could not access stylesheet rules (CORS or other issue):`, e.message);
        continue;
      }
    }

    console.log('⚠️ Method 1 failed, trying Method 2: Direct file fetch');

    // Method 2: Try to fetch the CSS file
    const alternativePaths = [
      '/src/components/dashboard/SalesBySalesRepTable.css',
      './src/components/dashboard/SalesBySalesRepTable.css',
      '../dashboard/SalesBySalesRepTable.css',
      'SalesBySalesRepTable.css'
    ];

    for (const path of alternativePaths) {
      try {
        console.log(`🔍 Trying to fetch: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ SUCCESS: Fetched Sales by Sales Rep styles from ${path}`);
          console.log(`📏 Total CSS size: ${cssText.length} characters`);
          console.log(`📝 First 500 chars: ${cssText.substring(0, 500)}`);
          return cssText;
        } else {
          console.log(`❌ Failed to fetch ${path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching ${path}:`, error.message);
        continue;
      }
    }

    console.error('❌ All CSS extraction methods failed!');
  } catch (error) {
    console.error('❌ CRITICAL: Could not extract/fetch SalesBySalesRepTable styles:', error);
  }

  // Fallback: Return empty string and log warning
  console.warn('⚠️⚠️⚠️ FALLING BACK TO EMPTY CSS - Export may not have proper styling! ⚠️⚠️⚠️');
  return '';
};

/**
 * P&L Table Styles - Extract from loaded stylesheet
 * Extracts styles from the loaded stylesheet to ensure export matches live page
 */
const getPLTableStyles = async () => {
  try {
    console.log('🔍 Starting P&L Table CSS extraction...');

    // Method 1: Try to extract from loaded stylesheet (BEST - automatically gets latest styles)
    const styleSheets = Array.from(document.styleSheets);
    console.log(`📄 Found ${styleSheets.length} stylesheets to check`);

    for (const sheet of styleSheets) {
      try {
        const href = sheet.href || '';
        console.log(`🔍 Checking stylesheet: ${href || '(inline)'}`);

        // Check for PLTableStyles.css file - if found, extract ALL rules
        if (href.includes('PLTableStyles.css') || href.includes('pl-table')) {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const allStyles = rules.map(rule => rule.cssText).join('\n');
          console.log(`📊 Extracted ${allStyles.length} characters, ${rules.length} rules from ${href}`);

          if (allStyles && allStyles.length > 5000) { // PLTableStyles.css is ~27KB
            console.log('✅ SUCCESS: Extracted ALL P&L Table styles from PLTableStyles.css stylesheet');
            console.log(`📏 Total CSS size: ${allStyles.length} characters`);
            console.log(`📝 First 500 chars: ${allStyles.substring(0, 500)}`);
            return allStyles;
          }
        }

        // Content-based fallback: Try to find rules by content
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        const plStyles = rules
          .filter(rule => {
            const cssText = rule.cssText || '';
            // Match P&L Table specific classes, variables, AND :root for CSS variables
            return cssText.includes('.pl-table') ||
                   cssText.includes('.pl-ledger-cell') ||
                   cssText.includes('.pl-metric-row') ||
                   cssText.includes('.pl-separator-row') ||
                   cssText.includes('--pl-') ||
                   cssText.includes('--z-corner') ||
                   cssText.includes('--z-hdr') ||
                   cssText.includes('--z-firstcol') ||
                   (cssText.startsWith(':root') && (cssText.includes('--pl-') || cssText.includes('--z-')));
          })
          .map(rule => rule.cssText)
          .join('\n');

        if (plStyles && plStyles.length > 5000) {
          console.log(`✅ SUCCESS: Extracted P&L Table styles from loaded stylesheet (by content)`);
          console.log(`📏 Total CSS size: ${plStyles.length} characters`);
          console.log(`📝 First 500 chars: ${plStyles.substring(0, 500)}`);
          return plStyles;
        }
      } catch (e) {
        console.warn(`⚠️ Could not access stylesheet rules (CORS or other issue):`, e.message);
        continue;
      }
    }

    console.log('⚠️ Method 1 failed, trying Method 2: Direct file fetch');

    // Method 2: Try to fetch the CSS file
    const alternativePaths = [
      '/src/components/dashboard/PLTableStyles.css',
      './src/components/dashboard/PLTableStyles.css',
      '../dashboard/PLTableStyles.css',
      'PLTableStyles.css'
    ];

    for (const path of alternativePaths) {
      try {
        console.log(`🔍 Trying to fetch: ${path}`);
        const response = await fetch(path);
        if (response.ok) {
          const cssText = await response.text();
          console.log(`✅ SUCCESS: Fetched P&L Table styles from ${path}`);
          console.log(`📏 Total CSS size: ${cssText.length} characters`);
          console.log(`📝 First 500 chars: ${cssText.substring(0, 500)}`);
          return cssText;
        } else {
          console.log(`❌ Failed to fetch ${path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching ${path}:`, error.message);
        continue;
      }
    }

    console.error('❌ All CSS extraction methods failed!');
  } catch (error) {
    console.error('❌ CRITICAL: Could not extract/fetch P&L Table styles:', error);
  }

  // Fallback: Return empty string and log warning
  console.warn('⚠️⚠️⚠️ P&L TABLE: FALLING BACK TO EMPTY CSS - Export may not have proper styling! ⚠️⚠️⚠️');
  return '';
};

/**
 * Safely escape closing script tags inside inline script content.
 * Prevents prematurely terminating the <script> element when injecting bundles.
 */
const escapeScriptContent = (scriptText = '') =>
  scriptText.replace(/<\/script>/gi, '<\\/script>');

/**
 * Escape content for safe embedding in template literals
 * Escapes backticks and ${} to prevent breaking the template literal
 */
const escapeForTemplateLiteral = (str = '') => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/`/g, '\\`')        // Escape backticks
    .replace(/\$\{/g, '\\${');   // Escape template literal placeholders
};

/**
 * Fetch helper that tries multiple URLs until a script is successfully retrieved.
 */
const fetchTextWithFallbacks = async (paths = []) => {
  for (const url of paths) {
    if (!url) continue;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 0) {
          console.log(`✅ Loaded script from ${url} (size: ${text.length} chars)`);
          return text;
        }
      } else {
        console.warn(`⚠️ Script fetch responded ${response.status} for ${url}`);
      }
    } catch (error) {
      console.warn(`⚠️ Script fetch failed for ${url}:`, error.message);
    }
  }
  return null;
};

/**
 * Load the ECharts bundle so the exported HTML works fully offline.
 * Tries local assets first (if provided), falls back to CDN as a last resort.
 */
const getEChartsBundle = async () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const candidatePaths = [
    '/export-libs/echarts.min.js',
    '/echarts.min.js',
    origin ? `${origin}/export-libs/echarts.min.js` : '',
    origin ? `${origin}/echarts.min.js` : '',
    'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js'
  ];

  console.log('Attempting to load ECharts bundle from:', candidatePaths.filter(Boolean));
  const script = await fetchTextWithFallbacks(candidatePaths);
  
  if (!script) {
    const errorMsg = 'Unable to load ECharts bundle. Tried local paths and CDN fallback. Check network connection and ensure echarts.min.js is accessible.';
    console.error(errorMsg);
    console.error('Attempted paths:', candidatePaths.filter(Boolean));
    throw new Error(errorMsg);
  }
  
  console.log('Successfully loaded ECharts bundle (' + (script.length / 1024).toFixed(0) + ' KB)');
  return script;
};

const MultiChartHTMLExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { excelData, selectedDivision } = useExcelData();
  const { companyCurrency } = useCurrency();
const {
    columnOrder,
    basePeriodIndex,
    // chartVisibleColumns, // unused
    isColumnVisibleInChart,
    dataGenerated
  } = useFilter();

  // Extract KPI CSS from loaded stylesheets (live version - single source of truth)
  const extractLiveKPICSS = () => {
    try {
      const allCSS = [];
      
      // Get all stylesheets
      for (const stylesheet of document.styleSheets) {
        try {
          // Try to access rules (might fail for cross-origin sheets)
          const rules = stylesheet.cssRules || stylesheet.rules;
          if (!rules) continue;
          
          for (const rule of rules) {
            const cssText = rule.cssText;
            // Check if this rule is related to KPI - comprehensive list
            if (cssText.includes('.kpi-') || 
                cssText.includes('.uae-') || 
                cssText.includes('.rotating-emoji') ||
                cssText.includes('.region-') ||
                cssText.includes('.financial-performance') ||
                cssText.includes('.product-performance') ||
                cssText.includes('.geographic-distribution') ||
                cssText.includes('.revenue-drivers') ||
                cssText.includes('.revenue-driver-') ||
                cssText.includes('.export-regions') ||
                cssText.includes('.export-connector') ||
                cssText.includes('.arrow-positive') ||
                cssText.includes('.arrow-negative') ||
                cssText.includes('.category-highlight') ||
                cssText.includes('.category-cards') ||
                cssText.includes('.category-card') ||
                cssText.includes('.category-title') ||
                cssText.includes('.category-metric') ||
                cssText.includes('.growth-') ||
                cssText.includes('.customer-insights') ||
                cssText.includes('.customer-line') ||
                cssText.includes('.customer-name') ||
                cssText.includes('.customer-names-small') ||
                cssText.includes('.customer-dots') ||
                cssText.includes('.customer-percentage') ||
                cssText.includes('.customer-subtitle') ||
                cssText.includes('.customer-avg-') ||
                cssText.includes('@keyframes') ||
                cssText.includes('.back-button')) {
              allCSS.push(cssText);
            }
          }
        } catch (e) {
          // Skip cross-origin sheets
          console.warn('Could not access stylesheet:', stylesheet.href);
        }
      }
      
      return allCSS.join('\n');
    } catch (err) {
      console.error('Failed to extract live KPI CSS:', err);
      // No hardcoded fallback - runtime extraction is the source of truth
      return '';
    }
  };

  // Extract overlay/banner CSS from loaded stylesheets
  const extractOverlayCSS = () => {
    try {
      const allCSS = [];
      
      // Get all stylesheets
      for (const stylesheet of document.styleSheets) {
        try {
          const rules = stylesheet.cssRules || stylesheet.rules;
          if (!rules) continue;
          
          for (const rule of rules) {
            const cssText = rule.cssText;
            // Check if this rule is related to overlay/banner, table details, P&L table, Sales Volume, Margin Analysis, Manufacturing Cost, or Combined Trends
            if (cssText.includes('.divisional-dashboard__overlay') ||
                cssText.includes('.divisional-dashboard__overlay-banner') ||
                cssText.includes('.divisional-dashboard__overlay-title') ||
                cssText.includes('.divisional-dashboard__overlay-close') ||
                cssText.includes('.divisional-dashboard__overlay-period') ||
                cssText.includes('.divisional-dashboard__overlay-scroll') ||
                cssText.includes('.divisional-dashboard__overlay-heading') ||
                cssText.includes('.divisional-dashboard__overlay-description') ||
                cssText.includes('.divisional-dashboard__overlay-currency') ||
                cssText.includes('.divisional-dashboard__overlay-icon') ||
                // Table Detail wrapper styles (used by P&L, Product Group, etc.)
                cssText.includes('.table-detail') ||
                cssText.includes('.table-detail__wrapper') ||
                // P&L Table specific styles
                cssText.includes('.pl-table-view') ||
                cssText.includes('.pl-table-container') ||
                cssText.includes('.pl-financial-table') ||
                cssText.includes('.pl-ledger-header') ||
                cssText.includes('.pl-separator-row') ||
                cssText.includes('.pl-data-cell') ||
                cssText.includes('.pl-calculated-cell') ||
                // Sales by Sales Rep specific styles
                cssText.includes('.sbsr-table-view') ||
                cssText.includes('.sbsr-table-container') ||
                cssText.includes('.sales-by-sales-rep-table') ||
                // Product Group specific styles
                cssText.includes('.pg-table-view') ||
                cssText.includes('.product-group-table') ||
                // Sales by Customer specific styles
                cssText.includes('.sales-by-customer-table') ||
                // Sales by Country specific styles
                cssText.includes('.sales-by-country-table') ||
                cssText.includes('.sales-country-') ||
                // Chart styles
                cssText.includes('.sales-volume-chart') ||
                cssText.includes('.sales-volume-overlay') ||
                cssText.includes('.sales-volume-detail') ||
                cssText.includes('.bar-chart-container') ||
                cssText.includes('.bar-chart') ||
                cssText.includes('.margin-analysis-detail') ||
                cssText.includes('.modern-margin-gauge') ||
                cssText.includes('.modern-gauge-') ||
                cssText.includes('.gauge-') ||
                cssText.includes('.manufacturing-cost-detail') ||
                cssText.includes('.manufacturing-cost-chart') ||
                // Combined Trends CSS
                cssText.includes('.combined-trends-detail') ||
                cssText.includes('.trend-card') ||
                cssText.includes('.trend-connector') ||
                cssText.includes('.trend-variance') ||
                cssText.includes('.trend-kpi-section') ||
                cssText.includes('.trend-cards-row') ||
                cssText.includes('.expenses-trend-container') ||
                cssText.includes('.profit-trend-container')) {
              allCSS.push(cssText);
            }
          }
        } catch (e) {
          console.warn('Could not access stylesheet:', stylesheet.href);
        }
      }
      
      const extractedCSS = allCSS.join('\n');
      
      // Fallback: If extraction yielded minimal CSS (< 1000 chars), inject critical inline styles
      if (extractedCSS.length < 1000) {
        console.warn('CSS extraction yielded minimal content, adding fallback styles');
        const fallbackCSS = `
          .manufacturing-cost-detail__chart-wrapper { width: 100%; margin: 20px 0; }
        `;
        return extractedCSS + fallbackCSS;
      }
      
      return extractedCSS;
    } catch (err) {
      console.error('Failed to extract overlay CSS:', err);
      // Return minimal fallback CSS instead of empty string
      return `
        .manufacturing-cost-detail__chart-wrapper { width: 100%; margin: 20px 0; }
        
        /* Manufacturing Cost Totals - Full CSS from ManufacturingCostTotals.css */
        .totals-scroll-container {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-around;
            gap: 5px;
            margin-top: 20px;
            margin-bottom: 0;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
        }
        
        .manufacturing-totals-card {
            padding: 12px 10px;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.07);
            min-width: 150px;
            max-width: 180px;
            flex: 1;
            text-align: center;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
            box-sizing: border-box;
        }
        
        .totals-connector {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            align-self: center;
            margin: 0 2px;
            min-width: 40px;
            width: 40px;
            min-height: 60px;
            height: auto;
            flex-shrink: 0;
        }
        
        .totals-card-title {
            font-size: 14px;
            font-weight: 500;
            margin-top: 8px;
            margin-bottom: 0;
            line-height: 1.2;
        }
        
        .totals-card-value {
            font-size: 22px;
            font-weight: bold;
            margin-top: 8px;
            margin-bottom: 0;
        }
        
        .totals-card-subtitle {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 0;
        }
        
        .variance-arrow {
            font-size: 22px;
            font-weight: bold;
            line-height: 1;
            margin: 0;
        }
        
        .variance-text {
            font-size: 18px;
            font-weight: bold;
            line-height: 1.1;
            margin: 0;
        }
        
        .variance-percent {
            font-size: 16px;
            font-weight: bold;
            line-height: 1.1;
            margin: 0;
        }
      `;
    }
  };

  // ⚠️ ROBUST DATA WAITING FUNCTION - Replace arbitrary timeouts
  // Waits for table data to be fully rendered before capturing
  // Increased to 20s to handle slower data loading and network conditions
  const waitForTableData = async (selector, maxWait = 20000) => {
    console.log(`⏳ Waiting for table data: ${selector}`);
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWait) {
      attempts++;
      const table = document.querySelector(selector);

      if (table) {
        const rows = table.querySelectorAll('tr');
        const hasData = rows.length > 1; // Header + at least one data row

        if (hasData) {
          // Extra buffer to ensure rendering is complete
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(`✅ Table data ready after ${attempts} attempts (${Date.now() - startTime}ms): ${selector}`);
          return true;
        }
      }

      // Check every 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.error(`❌ Timeout waiting for table data: ${selector} (waited ${maxWait}ms)`);
    throw new Error(`Timeout waiting for ${selector} - table data not rendered after ${maxWait}ms`);
  };

  // Capture Product Group table HTML (same as Comprehensive HTML Export)
  const captureProductGroupTable = async () => {
    console.log('🔍 Capturing Product Group table...');

    // Wait for table data to be fully rendered
    await waitForTableData('.product-group-table', 10000);

    // Helper function to process and return table HTML
    const processTable = (table) => {
      const clonedTable = table.cloneNode(true);
      // Replace "Product Group" with "Product Groups" in all cells AND add class for styling
      const allCells = clonedTable.querySelectorAll('td, th');
      allCells.forEach(cell => {
        if (cell.textContent && cell.textContent.trim() === 'Product Group') {
          cell.textContent = 'Product Groups';
          cell.classList.add('table-main-label'); // Add class for font size styling
        }
      });
      return clonedTable.outerHTML;
    };

    // APPROACH 1: Look for Product Group table by class
    const productGroupTable = document.querySelector('table.product-group-table');

    if (productGroupTable) {
      console.log('✅ Found Product Group table by class');
      return processTable(productGroupTable);
    }

    // APPROACH 2: Look for table with product-header-row (unique to Product Group)
    const tableWithProductHeaders = document.querySelector('table .product-header-row')?.closest('table');

    if (tableWithProductHeaders) {
      console.log('✅ Found Product Group table by product-header-row');
      return processTable(tableWithProductHeaders);
    }
    
    // APPROACH 3: Look for table containing product group specific text
    const allTables = Array.from(document.querySelectorAll('table'));
    console.log('Available tables count:', allTables.length);
    
    const productGroupTableByContent = allTables.find(table => {
      const tableText = table.textContent || '';
      const hasProductGroupContent = tableText.includes('Total Product Group') ||
                                    tableText.includes('Product Group') ||
                                    tableText.includes('Process Categories') ||
                                    tableText.includes('Material Categories') ||
                                    tableText.includes('PE Films') ||
                                    tableText.includes('Laminates') ||
                                    tableText.includes('Shrink');
      
      const hasTableStructure = table.querySelector('thead') && table.querySelector('tbody');
      
      console.log(`Checking table for Product Group content:`, {
        hasProductGroupContent,
        hasTableStructure,
        textPreview: tableText.substring(0, 100)
      });
      
      return hasProductGroupContent && hasTableStructure;
    });
    
    if (productGroupTableByContent) {
      console.log('✅ Found Product Group table by content analysis');
      return processTable(productGroupTableByContent);
    }
    
    console.error('❌ No Product Group table found after enhanced search');
    console.log('Available tables count:', allTables.length);
    
    allTables.forEach((table, index) => {
      console.log(`Table ${index}:`, {
        classes: table.className,
        hasProductHeaders: !!table.querySelector('.product-header-row'), 
        hasProductHeader: !!table.querySelector('.product-header'),
        tableView: table.closest('.table-view')?.querySelector('h3')?.textContent,
        hasProductGroupClass: table.classList.contains('product-group-table'),
        firstRowText: table.querySelector('tr')?.textContent?.substring(0, 50)
      });
    });
    
    // Try to get any table that looks like it might be the Product Group table
    const fallbackTable = allTables.find(table => 
      table.querySelector('.product-header-row') ||
      table.querySelector('.product-header') ||
      table.classList.contains('product-group-table') ||
      table.closest('.table-view')?.textContent?.includes('Product Group')
    );
    
    if (fallbackTable) {
      console.log('🎯 Using fallback table that seems to be Product Group table');
      return processTable(fallbackTable);
    }
    
    throw new Error('Product Group table not found. Please visit the Product Group tab first.');
  };

  // Capture P&L Financial table HTML (same as Comprehensive HTML Export)
  const capturePLFinancialTable = async () => {
    try {
      // Navigate to P&L tab using the same logic as ensurePLTabActive()
      const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const plTab = allButtons.find(el => {
        const text = el.textContent?.trim();
        return (text === 'P&L' || text === 'P&L Financial' || text.includes('P&L')) && text.length < 50;
      });

      if (plTab) {
        const isActive = plTab.classList.contains('active') ||
                        plTab.getAttribute('aria-selected') === 'true';
        if (!isActive) {
          console.log('🔄 Switching to P&L tab for HTML capture...');
          plTab.click();
          // Wait for the tab to load and render
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Look for P&L table using multiple selectors
      let plTable = document.querySelector('table.pl-financial-table') || 
                   document.querySelector('table.financial-table') ||
                   document.querySelector('.table-view table');

      if (!plTable) {
        // Enhanced fallback: look for any table that contains financial data
        const allTables = Array.from(document.querySelectorAll('table'));
        console.log('Available tables count for P&L:', allTables.length);
        
        plTable = allTables.find(table => {
          const tableText = table.textContent || '';
          const hasFinancialMetrics = tableText.includes('Revenue') || 
                                     tableText.includes('Sales') || 
                                     tableText.includes('Gross Profit') ||
                                     tableText.includes('EBITDA') ||
                                     tableText.includes('Operating') ||
                                     tableText.includes('Net Income') ||
                                     tableText.includes('Cost of Goods') ||
                                     tableText.includes('Margin');
          
          const isInTableView = table.closest('.table-view');
          
          console.log(`Checking table for P&L:`, {
            hasFinancialMetrics,
            isInTableView: !!isInTableView,
            classes: table.className,
            textPreview: tableText.substring(0, 100)
          });
          
          return hasFinancialMetrics && isInTableView;
        });
        
        if (!plTable) {
          // Final fallback: any table in table-view
          plTable = allTables.find(table => {
            const tableView = table.closest('.table-view');
            return tableView && table.querySelector('thead') && table.querySelector('tbody');
          });
        }
        
        if (!plTable) {
          throw new Error('P&L Financial table not found. Please visit the P&L tab first and ensure the table is loaded.');
        }
      }

      // Clone the table to modify it
      const clonedTable = plTable.cloneNode(true);
      
      // Change the table class to use our custom CSS
      clonedTable.className = 'pl-financial-table';
      
      // Remove only conflicting inline styles while preserving colors
      clonedTable.removeAttribute('style');
      
      // Remove only specific conflicting styles from th and td elements, keep background colors
      const allCells = clonedTable.querySelectorAll('th, td');
      allCells.forEach(cell => {
        // Remove conflicting styles but KEEP background-color and other visual styling
        cell.style.removeProperty('border');
        cell.style.removeProperty('padding');
        cell.style.removeProperty('font-size');
        cell.style.removeProperty('font-family');
        cell.style.removeProperty('text-align');
        cell.style.removeProperty('height');
        cell.style.removeProperty('line-height');
        cell.style.removeProperty('vertical-align');
        cell.style.removeProperty('width');
        cell.style.removeProperty('min-width');
        cell.style.removeProperty('max-width');
        cell.style.removeProperty('white-space');
        cell.style.removeProperty('overflow');
        cell.style.removeProperty('text-overflow');
        // Keep background-color, color, font-weight, etc.
      });
      
      // Remove only conflicting styles from tr elements, keep background colors
      const allRows = clonedTable.querySelectorAll('tr');
      allRows.forEach(row => {
        // Remove conflicting styles but KEEP background-color
        row.style.removeProperty('border');
        row.style.removeProperty('height');
        row.style.removeProperty('width');
        // Keep background-color, color, etc.
      });
      
      // Preserve width constraints from colgroup elements for proper column proportions
      // Keep widths for P&L table, Sales Rep table, AND Sales by Customer table
      const allColgroups = clonedTable.querySelectorAll('colgroup, col');
      // Check if this is the Sales Rep table by looking for the first header cell
      const firstHeader = clonedTable.querySelector('thead tr th.empty-header');
      const isSalesRepTable = firstHeader && firstHeader.textContent?.includes('Sales Rep');
      // Check if this is the Sales by Customer table by checking table class
      const isSalesByCustomerTable = clonedTable.classList.contains('sales-by-customer-table');
      // Check if this is P&L Financial table
      const isPLTable = clonedTable.classList.contains('pl-financial-table');

      allColgroups.forEach(col => {
        // KEEP width for P&L table, Sales Rep table, and Sales by Customer table
        // Only remove widths for other tables
        if (!isSalesRepTable && !isSalesByCustomerTable && !isPLTable) {
          col.style.removeProperty('width');
          col.style.removeProperty('min-width');
          col.style.removeProperty('max-width');
        }
        // Keep other styling for all tables
      });
      
      // Add space after currency symbols
      const currencySymbols = clonedTable.querySelectorAll('.uae-symbol');
      currencySymbols.forEach(symbol => {
        if (symbol.textContent && !symbol.textContent.includes(' ')) {
          symbol.textContent = symbol.textContent + ' ';
        }
      });
      
      // Remove empty rows from thead (the 2 unwanted rows above headers)
      const theadRows = clonedTable.querySelectorAll('thead tr');
      theadRows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const hasContent = Array.from(cells).some(cell => {
          const text = cell.textContent?.trim();
          return text && text.length > 0 && text !== ' ' && text !== '\u00A0';
        });
        // Remove row if it's completely empty or has only whitespace
        if (!hasContent) {
          row.remove();
        }
      });

      // Verify separator row exists after cleanup
      const separatorRow = clonedTable.querySelector('tbody tr.pl-separator-row');
      if (!separatorRow && isPLTable) {
        console.warn('⚠️ Separator row missing, re-adding...');
        const tbody = clonedTable.querySelector('tbody');
        const firstDataRow = Array.from(tbody.rows).find(r => !r.classList.contains('pl-separator-row'));
        if (firstDataRow) {
          const totalCols = firstDataRow.cells.length;
          
          const newSeparatorRow = document.createElement('tr');
          newSeparatorRow.className = 'pl-separator-row';
          for (let i = 0; i < totalCols; i++) {
            newSeparatorRow.appendChild(document.createElement('td'));
          }
          tbody.insertBefore(newSeparatorRow, tbody.firstChild);
        }
      }

      // Fix the header structure - ensure headers are on single lines (no breaks)
      const headerCells = clonedTable.querySelectorAll('thead tr th');
      headerCells.forEach(th => {
        // Remove any existing line breaks and ensure single-line headers
        const text = th.textContent?.trim();
        if (text.includes('%') && text.includes('Sales')) {
          th.innerHTML = '% of Sls';
        } else if (text.includes('per') && text.includes('Kg')) {
          th.innerHTML = getUAEDirhamSymbolHTML() + ' / Kg';
        }
      });

      // Return the modified HTML
      return clonedTable.outerHTML;
      
    } catch (error) {
      console.error('❌ Failed to capture P&L table HTML:', error);
      throw new Error(`Failed to capture P&L table HTML: ${error.message}`);
    }
  };

  // Generate KPI Summary HTML (same as Comprehensive HTML Export)
  // Helper function to ensure Product Group tab is active
  const ensureProductGroupTabActive = () => {
    console.log('🔍 Checking if Product Group tab is active...');
    
    // Find the Product Group tab specifically - look for small clickable elements only
    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    const productGroupTab = allButtons.find(el => {
      const text = el.textContent?.trim();
      return text === 'Product Group' && text.length < 50; // Must be exact match and short text
    });
    
    if (!productGroupTab) {
      console.warn('⚠️ Product Group tab button not found');
      console.log('Available tab-like buttons:', allButtons.map(b => b.textContent?.trim()).filter(t => t && t.length < 50));
      return Promise.resolve();
    }
    
    console.log('🔍 Found Product Group tab button:', productGroupTab.textContent?.trim());
    
    // Check if it's already active
    const isActive = productGroupTab.classList.contains('active') || 
                    productGroupTab.getAttribute('aria-selected') === 'true';
                    
    if (!isActive) {
      console.log('🔄 Clicking Product Group tab...');
      productGroupTab.click();
      // Give it time to mount and render
      return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✅ Product Group tab is already active');
    }
    
    return Promise.resolve();
  };

  // Capture Sales by Customer table HTML (same as Comprehensive HTML Export)
  const captureSalesCustomerTable = async () => {
    console.log('🔍 Capturing Sales by Customer table...');

    // Check if "Hide Sales Rep" checkbox is checked
    const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let hideSalesRep = false;

    console.log('🔍 DEBUG: Found', allCheckboxes.length, 'checkboxes on page');

    // Look for the "Hide Sales Rep" checkbox specifically
    for (const checkbox of allCheckboxes) {
      const label = checkbox.closest('label');
      console.log('🔍 DEBUG: Checkbox label text:', label ? label.textContent.trim() : 'NO LABEL');

      if (label && label.textContent.includes('Hide Sales Rep')) {
        hideSalesRep = checkbox.checked;
        console.log('🔍 Found Hide Sales Rep checkbox, checked:', hideSalesRep);
        break;
      }
    }

    // Also try alternative detection methods
    if (!hideSalesRep) {
      // Try finding by text content in the page
      const hideSalesRepText = document.body.textContent;
      if (hideSalesRepText.includes('Hide Sales Rep')) {
        console.log('🔍 DEBUG: Found "Hide Sales Rep" text in page, but checkbox detection failed');
      }

      // Try finding the checkbox by looking for the specific text pattern
      const allLabels = Array.from(document.querySelectorAll('label'));
      for (const label of allLabels) {
        if (label.textContent.includes('Hide Sales Rep')) {
          const checkbox = label.querySelector('input[type="checkbox"]');
          if (checkbox) {
            hideSalesRep = checkbox.checked;
            console.log('🔍 Found Hide Sales Rep checkbox via label search, checked:', hideSalesRep);
            break;
          }
        }
      }
    }

    console.log('🔍 Hide Sales Rep setting:', hideSalesRep ? 'HIDDEN' : 'VISIBLE');

    // Look for the Sales by Customer table in the DOM
    const allTables = Array.from(document.querySelectorAll('table'));
    console.log('Available tables count for Sales Customer:', allTables.length);

    // Find table that looks like Sales by Customer - it should have customer names
    const customerTable = allTables.find(table => {
      const tableText = table.textContent || '';
      const hasCustomerData = tableText.includes('Customer') ||
                             tableText.includes('Total') ||
                             tableText.includes('Sales') ||
                             tableText.includes('AED') ||
                             tableText.includes('Amount');

      const isInTableView = table.closest('.table-view') || table.closest('.sales-customer-table');

      console.log(`Checking table for Sales Customer:`, {
        hasCustomerData,
        isInTableView: !!isInTableView,
        classes: table.className,
        textPreview: tableText.substring(0, 100)
      });

      return hasCustomerData && isInTableView;
    });

    // Helper function to process Customer table - replace singular with plural
    const processCustomerTable = (table) => {
      const clonedTable = table.cloneNode(true);
      const allCells = clonedTable.querySelectorAll('td, th');
      allCells.forEach(cell => {
        const text = cell.textContent?.trim();
        if (text === 'Customer' || text === 'Sales Rep') {
          cell.textContent = text === 'Customer' ? 'Customers' : 'Sales Reps';
        }
      });
      return clonedTable.outerHTML;
    };

    if (customerTable) {
      console.log('✅ Found Sales by Customer table');

      // Store the hideSalesRep setting for later use in rendering
      window.salesCustomerHideSalesRep = hideSalesRep;

      return processCustomerTable(customerTable);
    }

    // Fallback: look for any table that might be the sales customer table
    const fallbackTable = allTables.find(table => {
      const tableView = table.closest('.table-view');
      const hasSalesData = table.textContent?.includes('Sales') || table.textContent?.includes('Amount');
      return tableView && hasSalesData && table.querySelector('thead') && table.querySelector('tbody');
    });

    if (fallbackTable) {
      console.log('🎯 Using fallback table for Sales by Customer');

      // Store the hideSalesRep setting for later use in rendering
      window.salesCustomerHideSalesRep = hideSalesRep;

      return processCustomerTable(fallbackTable);
    }

    throw new Error('Sales by Customer table not found. Please visit the Sales by Customer tab first.');
  };

  // Function to capture Sales by Country table HTML
  const captureSalesCountryTable = async () => {
    console.log('🔍 Capturing Sales by Country table...');
    
    // Check if "Hide Budget & Forecast" checkbox is checked
    const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let hideBudgetForecast = false;
    
    console.log('🔍 DEBUG: Found', allCheckboxes.length, 'checkboxes on page');
    
    // Look for the "Hide Budget & Forecast" checkbox
    for (const checkbox of allCheckboxes) {
      const label = checkbox.closest('label');
      const labelText = label ? label.textContent.trim() : '';
      console.log('🔍 DEBUG: Checkbox label text:', labelText);
      
      if (label && (label.textContent.includes('Hide Budget') || label.textContent.includes('Hide Budget & Forecast'))) {
        hideBudgetForecast = checkbox.checked;
        console.log('🔍 Found Hide Budget checkbox, checked:', hideBudgetForecast);
        break;
      }
    }
    
    console.log('🔍 Hide Budget & Forecast setting:', hideBudgetForecast ? 'HIDDEN' : 'VISIBLE');
    
    // Look for the Sales by Country table in the DOM
    const allTables = Array.from(document.querySelectorAll('table'));
    console.log('Available tables count for Sales Country:', allTables.length);
    
    // Find table that looks like Sales by Country - it should have country names
    const countryTable = allTables.find(table => {
      const tableText = table.textContent || '';
      const hasCountryData = tableText.includes('Country') || 
                            tableText.includes('Total') ||
                            tableText.includes('Europe') ||
                            tableText.includes('UAE');
      
      const isInTableView = table.closest('.table-view') || table.classList.contains('sales-by-country-table');
      
      console.log(`Checking table for Sales Country:`, {
        hasCountryData,
        isInTableView: !!isInTableView,
        classes: table.className,
        textPreview: tableText.substring(0, 100)
      });
      
      return hasCountryData && isInTableView;
    });
    
    // Helper function to process Country table - replace singular with plural
    const processCountryTable = (table) => {
      const clonedTable = table.cloneNode(true);
      const allCells = clonedTable.querySelectorAll('td, th');
      allCells.forEach(cell => {
        const text = cell.textContent?.trim();
        if (text === 'Country') {
          cell.textContent = 'Country Names';
        }
      });
      return clonedTable.outerHTML;
    };

    if (countryTable) {
      console.log('✅ Found Sales by Country table');
      return processCountryTable(countryTable);
    }

    // Fallback: look for any table that might be the sales country table
    const fallbackTable = allTables.find(table => {
      const tableView = table.closest('.table-view');
      const hasCountryData = table.textContent?.includes('Country') || table.textContent?.includes('Europe');
      return tableView && hasCountryData && table.querySelector('thead') && table.querySelector('tbody');
    });

    if (fallbackTable) {
      console.log('🎯 Using fallback table for Sales by Country');
      return processCountryTable(fallbackTable);
    }
    
    throw new Error('Sales by Country table not found. Please visit the Sales by Country tab first.');
  };

  // Function to capture Sales by Sales Rep table HTML
  const captureSalesRepTable = async () => {
    console.log('🔍 Capturing Sales by Sales Rep table...');

    // Check if "Hide Budget & Forecast" checkbox is checked
    const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let hideBudgetForecast = false;

    console.log('🔍 DEBUG: Found', allCheckboxes.length, 'checkboxes on page for Sales Rep');

    // Look for the "Hide Budget & Forecast" checkbox
    for (const checkbox of allCheckboxes) {
      const label = checkbox.closest('label');
      const labelText = label ? label.textContent.trim() : '';

      if (label && (label.textContent.includes('Hide Budget') || label.textContent.includes('Hide Budget & Forecast'))) {
        hideBudgetForecast = checkbox.checked;
        console.log('🔍 Found Hide Budget & Forecast checkbox for Sales Rep, checked:', hideBudgetForecast);
        break;
      }
    }

    console.log('🔍 Hide Budget & Forecast setting for Sales Rep:', hideBudgetForecast ? 'HIDDEN' : 'VISIBLE');

    // Look for the Sales by Sales Rep table in the DOM
    const allTables = Array.from(document.querySelectorAll('table'));
    console.log('Available tables count for Sales Rep:', allTables.length);

    // Find table that looks like Sales by Sales Rep - it should have sales rep names
    const salesRepTable = allTables.find(table => {
      const tableText = table.textContent || '';
      const hasSalesRepData = tableText.includes('Sales Rep') ||
                             tableText.includes('Total Sales') ||
                             tableText.includes('Reps');

      const isInTableView = table.closest('.sbsr-table-view') || table.closest('.sales-by-sales-rep-table');

      console.log(`Checking table for Sales Rep:`, {
        hasSalesRepData,
        isInTableView: !!isInTableView,
        classes: table.className,
        textPreview: tableText.substring(0, 100)
      });

      return hasSalesRepData && isInTableView;
    });

    // Helper function to process Sales Rep table
    const processSalesRepTable = (table) => {
      const clonedTable = table.cloneNode(true);
      // No text replacement needed for Sales Rep table
      return clonedTable.outerHTML;
    };

    if (salesRepTable) {
      console.log('✅ Found Sales by Sales Rep table');

      // Store the hideBudgetForecast setting for later use in rendering
      window.salesRepHideBudgetForecast = hideBudgetForecast;

      return processSalesRepTable(salesRepTable);
    }

    // Fallback: look for any table that might be the sales rep table
    const fallbackTable = allTables.find(table => {
      const tableView = table.closest('.sbsr-table-view');
      const hasSalesData = table.textContent?.includes('Sales') || table.textContent?.includes('Rep');
      return tableView && hasSalesData && table.querySelector('thead') && table.querySelector('tbody');
    });

    if (fallbackTable) {
      console.log('🎯 Using fallback table for Sales by Sales Rep');

      // Store the hideBudgetForecast setting for later use in rendering
      window.salesRepHideBudgetForecast = hideBudgetForecast;

      return processSalesRepTable(fallbackTable);
    }

    throw new Error('Sales by Sales Rep table not found. Please visit the Sales by Sales Rep tab first.');
  };

  // Helper function to ensure Sales by Customer tab is active
  const ensureSalesCustomerTabActive = () => {
    console.log('🔍 Checking if Sales by Customer tab is active...');
    
    // Find the Sales by Customer tab specifically
    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    const salesCustomerTab = allButtons.find(el => {
      const text = el.textContent?.trim();
      return (text === 'Sales by Customer' || text.includes('Customer')) && text.length < 50;
    });
    
    if (!salesCustomerTab) {
      console.warn('⚠️ Sales by Customer tab button not found');
      console.log('Available tab-like buttons:', allButtons.map(b => b.textContent?.trim()).filter(t => t && t.length < 50));
      return Promise.resolve();
    }
    
    console.log('🔍 Found Sales by Customer tab button:', salesCustomerTab.textContent?.trim());
    
    // Check if it's already active
    const isActive = salesCustomerTab.classList.contains('active') || 
                    salesCustomerTab.getAttribute('aria-selected') === 'true';
                    
    if (!isActive) {
      console.log('🔄 Clicking Sales by Customer tab...');
      salesCustomerTab.click();
      // Give it time to mount and render
      return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✅ Sales by Customer tab is already active');
    }
    
    return Promise.resolve();
  };

  // Helper function to ensure Sales by Sales Rep Divisional tab is active
  const ensureSalesSaleRepTabActive = () => {
    console.log('🔍 Checking if Sales by Sales Rep Divisional tab is active...');
    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    const salesRepTab = allButtons.find(el => {
      const text = el.textContent?.trim();
      return text === 'Sales by Sales Rep Divisional';
    });
    if (!salesRepTab) {
      console.warn('⚠️ Sales by Sales Rep Divisional tab button not found');
      return Promise.resolve();
    }
    
    // Check if the tab is already active by looking for the SalesBySalesRepDivisional component
    const salesRepDivisionalTable = Array.from(document.querySelectorAll('.table-view')).find(tableView => {
      const title = tableView.querySelector('h2')?.textContent;
      return title && title.includes('Sales by Sales Rep');
    });
    if (salesRepDivisionalTable) {
      console.log('✅ Sales by Sales Rep Divisional tab is already active');
      return Promise.resolve();
    }
    console.log('🔍 Found Sales by Sales Rep Divisional tab button:', salesRepTab.textContent?.trim());
    const isActive = salesRepTab.classList.contains('active') || salesRepTab.getAttribute('aria-selected') === 'true';
    if (!isActive) {
      console.log('🔄 Clicking Sales by Sales Rep Divisional tab...');
      salesRepTab.click();
      return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✅ Sales by Sales Rep Divisional tab is already active');
    }
    return Promise.resolve();
  };

  // Helper function to ensure Sales by Country tab is active
  const ensureSalesCountryTabActive = () => {
    console.log('🔍 Checking if Sales by Country tab is active...');
    
    // Find the Sales by Country tab specifically
    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    const salesCountryTab = allButtons.find(el => {
      const text = el.textContent?.trim();
      return text && text.includes('Sales by Country') && !text.includes('Customer');
    });
    
    if (!salesCountryTab) {
      console.warn('⚠️ Sales by Country tab not found');
      return Promise.resolve();
    }
    
    console.log('🔍 Found Sales by Country tab button:', salesCountryTab.textContent);
    
    // Check if it's already active
    const isActive = salesCountryTab.classList.contains('active') || 
                    salesCountryTab.getAttribute('aria-selected') === 'true';
                    
    if (!isActive) {
      console.log('🔄 Clicking Sales by Country tab...');
      salesCountryTab.click();
      // Give it time to mount and render
      return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✅ Sales by Country tab is already active');
    }
    
    return Promise.resolve();
  };

  // ⚠️ ROBUST KPI READINESS - Validate actual numeric data, not just spinner gone
  async function waitForKpiNumbers({
    containerSelector = '.divisional-dashboard__overlay .kpi-dashboard, .kpi-dashboard',
    valueSelectors = ['.kpi-value', '.metric-value', '[data-kpi-value]'],
    minCount = 5,  // Increased from 3 - require more KPI elements to be loaded
    minNumericRatio = 0.75,  // Increased from 0.6 - require 75% numeric values
    maxTries = 15,  // Increased from 10 - allow more time for data to load
    delayMs = 600  // Increased from 500ms - longer interval between checks
  } = {}) {
    for (let i = 1; i <= maxTries; i++) {
      const root = document.querySelector(containerSelector);
      if (!root) {
        console.log(`⏳ Try ${i}/${maxTries}: Container '${containerSelector}' not found`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }

      // Find all KPI value elements
      const nodes = valueSelectors.flatMap(sel => Array.from(root.querySelectorAll(sel)));
      const uniqueNodes = Array.from(new Set(nodes));
      const texts = uniqueNodes.map(n => (n.textContent || '').trim());

      // Enhanced logging - show what we found
      if (i === 1 || i === maxTries) {
        console.log(`📊 Try ${i} - Found ${uniqueNodes.length} KPI elements with values:`, texts.slice(0, 10));
      }

      // Check which texts contain numeric data (allow percentages, currency, negative numbers)
      const numericFlags = texts.map(t => {
        // Consider it numeric if it has digits and is not just a placeholder like "Please wait", "-", etc.
        const hasDigit = /\d/.test(t);
        // Expanded placeholder detection to catch loading states
        const isPlaceholder = /^(please wait|loading|calculating|fetching|--|—|…|⋯|n\/a|na|tbd|pending|\.\.\.)$/i.test(t.replace(/\s/g, ''));
        // Also reject if it's just a single zero or dash (common skeleton state)
        const isSkeletonState = /^[0-]$/.test(t.trim());
        return hasDigit && !isPlaceholder && !isSkeletonState;
      });

      const numericCount = numericFlags.filter(Boolean).length;

      // Extract numeric values (handle currency symbols, percentages, commas, negative signs)
      const numericValues = texts
        .map(t => {
          // Remove currency symbols, spaces, commas
          let cleaned = (t || '').replace(/[,¥€£$₽₹₪₩₫₨₴₸₼₾₿\s%]/g, '');
          // Handle negative numbers with various dash types
          cleaned = cleaned.replace(/^[–—−]/, '-');
          return parseFloat(cleaned);
        })
        .filter(v => !Number.isNaN(v) && Number.isFinite(v));

      const hasMin = uniqueNodes.length >= minCount;
      const ratio = numericFlags.length ? (numericCount / numericFlags.length) : 0;
      const hasNumbers = numericCount > 0;  // Just need SOME numeric values
      const notAllZero = numericValues.some(v => Math.abs(v) > 0.001);  // At least one non-zero value

      if (hasMin && ratio >= minNumericRatio && hasNumbers && notAllZero) {
        console.log(`✅ KPI numeric check passed on try ${i}:`);
        console.log(`   - Elements found: ${uniqueNodes.length} (min: ${minCount})`);
        console.log(`   - Numeric values: ${numericCount} of ${texts.length} (${(ratio * 100).toFixed(0)}%)`);
        console.log(`   - Sample values:`, texts.slice(0, 5));
        return;
      }

      console.log(`⏳ KPI numeric check try ${i}/${maxTries}:`);
      console.log(`   - Elements: ${uniqueNodes.length}/${minCount} ✓`);
      console.log(`   - Numeric ratio: ${(ratio * 100).toFixed(0)}%/${(minNumericRatio * 100).toFixed(0)}% ${ratio >= minNumericRatio ? '✓' : '✗'}`);
      console.log(`   - Has numbers: ${hasNumbers ? '✓' : '✗'}`);
      console.log(`   - Not all zero: ${notAllZero ? '✓' : '✗'}`);

      await new Promise(r => setTimeout(r, delayMs));
    }

    // Final diagnostic before failing
    const root = document.querySelector(containerSelector);
    const nodes = valueSelectors.flatMap(sel => Array.from((root || document).querySelectorAll(sel)));
    const texts = nodes.map(n => (n.textContent || '').trim());
    console.error('❌ KPI validation failed after all retries. Final state:');
    console.error('   - Found values:', texts);

    throw new Error('KPI data not fully loaded: numeric readiness failed. Please keep the KPI tab open a bit longer and try again.');
  }

  const generateOutstandingKPISummary = async () => {
    try {
      // FIRST: Check if KPI is already visible in the DivisionalDashboardLanding overlay
      let kpiComponent = document.querySelector('.divisional-dashboard__overlay .kpi-dashboard');
      
      if (kpiComponent) {
        console.log('✅ Found KPI in DivisionalDashboardLanding overlay');
      } else {
        // Try to find and click the Divisional KPIs card to open the overlay
        const kpiCard = Array.from(document.querySelectorAll('.divisional-dashboard__card')).find(card => {
          const title = card.querySelector('.divisional-dashboard__card-title');
          return title && title.textContent?.includes('Divisional KPIs');
        });
        
        if (kpiCard) {
          console.log('🔄 Clicking Divisional KPIs card to open overlay...');
          kpiCard.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          // Fallback: Try the old tab-based approach
          const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
          const kpiTab = allButtons.find(el => {
            const text = el.textContent?.trim();
            return (text === 'KPI' || text === 'Executive Summary' || text.includes('KPI')) && text.length < 50;
          });

          if (kpiTab) {
            console.log('🔄 Switching to KPI tab for HTML capture (forcing fresh data fetch)...');
            kpiTab.click();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
      
      // Wait for loading spinners to disappear (up to 20 seconds for API calls)
      console.log('⏳ Waiting for KPI data to finish loading...');
      const maxWaitTime = 20000; // 20 seconds max (increased to allow for API fetch)
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const loadingSpinners = document.querySelectorAll('.kpi-dashboard .loading-spinner, .kpi-dashboard .spinner, .kpi-dashboard .loading');
        if (loadingSpinners.length === 0) {
          console.log('✅ KPI loading complete! Data is ready for capture.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // Check every 200ms
      }
      
      // Give it extra time to ensure all API calls are complete and DOM is fully updated
      console.log('⏳ Waiting for API data to settle...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Extended wait for API data

      // ⚠️ NUMERIC VALIDATION - Ensure KPI values are actually loaded, not just placeholders
      console.log('🔢 Validating KPI numeric data...');
      await waitForKpiNumbers();
      console.log('✅ KPI numeric validation passed!');
      
      // Extra stabilization delay to ensure React has fully committed all state updates
      console.log('⏳ Stabilizing KPI data (final wait)...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ KPI data stabilized and ready for capture');

      // Capture the FULL OVERLAY (includes banner + KPI) - same as tables
      const overlayElement = document.querySelector('.divisional-dashboard__overlay');
      if (overlayElement) {
        console.log('✅ Capturing full overlay with banner for KPI');
        const clonedOverlay = overlayElement.cloneNode(true);
        
        // Add space after currency symbols in the cloned overlay
        const currencySymbols = clonedOverlay.querySelectorAll('.uae-symbol');
        currencySymbols.forEach(symbol => {
          if (symbol.textContent && !symbol.textContent.includes(' ')) {
            symbol.textContent = symbol.textContent + ' ';
          }
        });

        // Get the actual KPI CSS content using runtime extraction
        const kpiCSS = extractLiveKPICSS();
        const overlayCSS = extractOverlayCSS();

        // Return the modified HTML + CSS (overlay includes banner + KPI)
        return `
          <style>
            ${overlayCSS}
            ${kpiCSS}
          </style>
          ${clonedOverlay.outerHTML}
        `;
      }
      
      // Fallback: If no overlay, capture just the KPI component
      const kpiComponentFinal = document.querySelector('.kpi-dashboard');
      if (!kpiComponentFinal) {
        throw new Error('KPI component not found. Please open the Divisional KPIs view and wait for data to load before exporting.');
      }

      // Clone the component to modify it
      const clonedComponent = kpiComponentFinal.cloneNode(true);
      
      // Add space after currency symbols
      const currencySymbols = clonedComponent.querySelectorAll('.uae-symbol');
      currencySymbols.forEach(symbol => {
        if (symbol.textContent && !symbol.textContent.includes(' ')) {
          symbol.textContent = symbol.textContent + ' ';
        }
      });

      // Get the actual KPI CSS content using runtime extraction
      const kpiCSS = extractLiveKPICSS();

      // Return the modified HTML + CSS
      return `
        <style>
          ${kpiCSS}
        </style>
        ${clonedComponent.outerHTML}
      `;
      
    } catch (error) {
      console.error('❌ Failed to capture live KPI HTML:', error);
      throw new Error(`Failed to capture live KPI HTML: ${error.message}`);
    }
  };

  // ⚠️ TAB RESTORATION HELPERS - Return user to original tab after export
  function getActiveTabButton() {
    const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
    return tabs.find(el => el.classList.contains('active') || el.getAttribute('aria-selected') === 'true') || null;
  }

  async function restoreOriginalTab(originalTabEl, originalTabName) {
    try {
      if (originalTabEl && typeof originalTabEl.click === 'function') {
        console.log('🔄 Restoring original tab:', originalTabName || '(unknown)');
        originalTabEl.click();
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.warn('⚠️ Failed to restore original tab:', e);
    }
  }

  const handleExport = async () => {
    console.log('🔥🔥🔥 MULTICHART EXPORT STARTED - This should generate 5 cards!');
    setIsExporting(true);

    // ⚠️ EXPORT STATE - Scoped object to avoid localStorage pollution
    // No cross-tab/state leakage, no cleanup needed
    const exportState = {
      hideSalesRep: false,
      hideBudgetForecast: false,
      originalTabEl: null,
      originalTabName: null,
      startedAt: Date.now()
    };

    // 📌 CAPTURE ORIGINAL TAB - For restoration after export
    exportState.originalTabEl = getActiveTabButton();
    exportState.originalTabName = exportState.originalTabEl?.textContent?.trim() || null;
    console.log('📌 Original tab captured:', exportState.originalTabName || '(no tab detected)');

    // 🚨 CRITICAL: Capture checkbox states RIGHT NOW before switching any tabs!
    console.log('🔍 INITIAL CHECK: Looking for checkboxes on current tab...');
    const initialCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    for (const checkbox of initialCheckboxes) {
      const label = checkbox.closest('label');
      if (label) {
        if (label.textContent.includes('Hide Sales Rep')) {
          exportState.hideSalesRep = checkbox.checked;
          console.log('💾 CAPTURED at start: Hide Sales Rep =', exportState.hideSalesRep);
        } else if (label.textContent.includes('Hide Budget')) {
          exportState.hideBudgetForecast = checkbox.checked;
          console.log('💾 CAPTURED at start: Hide Budget & Forecast =', exportState.hideBudgetForecast);
        }
      }
    }
    
    try {
      // Compute cell values - EXACT same logic as ChartContainer
      const divisionData = excelData[selectedDivision] || [];
      const computeCellValue = (rowIndex, column) =>
        sharedComputeCellValue(divisionData, rowIndex, column);

      // Numeric sanitizer to handle formatted strings
      const sanitizeNumeric = (value) => {
        if (value === null || value === undefined) return 0;

        if (typeof value === 'string') {
          const cleaned = value.replace(/[,¥€£$₽₹₪₩₫₨₴₸₼₾₿\s]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        }

        const num = Number(value);
        return isNaN(num) ? 0 : num;
      };

      // ⚠️ UNIFIED PERIOD KEY BUILDER - Use everywhere for consistency
      // Prevents data lookup failures due to key mismatches
      const buildPeriodKey = (period) => {
        if (period.isCustomRange) {
          return `${period.year}-${period.month}-${period.type}`;
        }
        return `${period.year}-${period.month || 'Year'}-${period.type}`;
      };

      // Build chart data with validation - EXACT same logic as ChartContainer
      const periods = columnOrder;
      if (!periods || periods.length === 0) {
        throw new Error('No periods available. Please generate data first.');
      }
      
      const basePeriod = periods[basePeriodIndex];
      const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));
      
      if (visiblePeriods.length === 0) {
        throw new Error('No visible periods in chart. Please make at least one period visible.');
      }

      // Capture actual data from original charts - this gets the REAL figures currently displayed
      const captureActualChartData = () => {
        const actualData = {};

        visiblePeriods.forEach(period => {
          const periodKey = buildPeriodKey(period);
          actualData[periodKey] = {
            sales: computeCellValue(3, period),
            materialCost: computeCellValue(5, period),
            salesVolume: computeCellValue(7, period),
            productionVolume: computeCellValue(8, period),
            // Manufacturing Cost data - EXACT same as original charts
            labour: computeCellValue(9, period),
            depreciation: computeCellValue(10, period),
            electricity: computeCellValue(12, period),
            othersMfgOverheads: computeCellValue(13, period),
            totalDirectCost: computeCellValue(14, period),
            // Below GP Expenses data - EXACT same as original charts
            sellingExpenses: computeCellValue(31, period),
            transportation: computeCellValue(32, period),
            administration: computeCellValue(40, period),
            bankInterest: computeCellValue(42, period),
            totalBelowGPExpenses: computeCellValue(52, period),
            // Combined Trends data - EXACT same as original charts
            netProfit: computeCellValue(54, period),
            ebitda: computeCellValue(56, period)
          };
        });

        return actualData;
      };

      const capturedActualData = captureActualChartData();

      // ⚠️ VALIDATE CAPTURED DATA - Ensure we got data before proceeding
      const dataKeys = Object.keys(capturedActualData);
      if (dataKeys.length === 0) {
        console.error('❌ No chart data was captured!');
        throw new Error('No chart data was captured. Please ensure all tabs have loaded properly and data has been generated.');
      }

      console.log('✅ Captured data for', dataKeys.length, 'periods');
      console.log('📊 Data keys:', dataKeys);

      // Validate that each period has the required KPIs
      const requiredKPIs = ['salesRevenue', 'salesVolume', 'grossProfit', 'grossProfitMargin', 'operatingProfit', 'operatingProfitMargin'];
      let missingDataWarnings = [];

      dataKeys.forEach(periodKey => {
        const periodData = capturedActualData[periodKey];
        requiredKPIs.forEach(kpi => {
          if (periodData[kpi] === undefined || periodData[kpi] === null) {
            missingDataWarnings.push(`${periodKey}.${kpi}`);
          }
        });
      });

      if (missingDataWarnings.length > 0) {
        console.warn('⚠️ Some KPI data is missing:', missingDataWarnings);
        console.warn('This might indicate incomplete data generation. Export will continue but some values may be zero.');
      }

      // Get division display name
      const getDivisionDisplayName = () => {
        const divisionNames = {
          'FP-Product Group': 'Flexible Packaging',
          'SB-Product Group': 'Shopping Bags',
          'TF-Product Group': 'Thermoforming Products',
          'HCM-Product Group': 'Harwal Container Manufacturing'
        };
        return divisionNames[selectedDivision] || selectedDivision.split('-')[0];
      };

      // Get base period display text
      const getBasePeriodText = () => {
        if (basePeriodIndex !== null && columnOrder[basePeriodIndex]) {
          const period = columnOrder[basePeriodIndex];
          const monthDisplay = period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : period.month;
          return `${period.year} ${monthDisplay} ${period.type}`;
        }
        return 'No Base Period Selected';
      };

      // Convert logo to base64 for embedding
      const getBase64Logo = async () => {
        try {
          const response = await fetch(ipTransparentLogo);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn('Could not load IP transparent logo for charts export:', error);
          return null;
        }
      };
      
      const chartData = {};
      const colsToIterate = visiblePeriods.length ? visiblePeriods : periods;

      colsToIterate.forEach(col => {
        const key = buildPeriodKey(col);

        const salesRaw = computeCellValue(3, col);
        const materialRaw = computeCellValue(5, col);
        const salesVolRaw = computeCellValue(7, col);
        const prodVolRaw = computeCellValue(8, col);
        
        // Sanitize all numeric values
        const sales = sanitizeNumeric(salesRaw);
        const material = sanitizeNumeric(materialRaw);
        const salesVol = sanitizeNumeric(salesVolRaw);
        const prodVol = sanitizeNumeric(prodVolRaw);
        
        chartData[key] = {
          sales,
          materialCost: material,
          salesVolume: salesVol,
          productionVolume: prodVol,
          marginPerKg: salesVol > 0 ? (sales - material) / salesVol : 0
        };
      });

      // ⚠️ VALIDATE CHART DATA - Ensure we got data before proceeding
      const chartDataKeys = Object.keys(chartData);
      if (chartDataKeys.length === 0) {
        console.error('❌ No chart data was built!');
        throw new Error('No chart data was built. Please ensure data has been generated properly.');
      }

      console.log('✅ Built chart data for', chartDataKeys.length, 'periods');
      console.log('📊 Chart data keys:', chartDataKeys);

      // Validate that each period has sales data (main indicator)
      let zeroSalesCount = 0;
      chartDataKeys.forEach(key => {
        if (chartData[key].sales === 0 && chartData[key].salesVolume === 0) {
          zeroSalesCount++;
        }
      });

      if (zeroSalesCount === chartDataKeys.length) {
        console.error('❌ All periods have zero sales data!');
        throw new Error('All periods have zero sales data. Please ensure the Excel data has been loaded and processed correctly.');
      }

      if (zeroSalesCount > 0) {
        console.warn(`⚠️ ${zeroSalesCount} out of ${chartDataKeys.length} periods have zero sales data`);
      }

      // Create period key helper function - EXACT same as BarChart
      const createPeriodKey = (period) => {
        if (period.isCustomRange) {
          return `${period.year}-${period.month}-${period.type}`;
        } else {
          return `${period.year}-${period.month || 'Year'}-${period.type}`;
        }
      };

      // Get base period key
      const basePeriodKey = basePeriod ? createPeriodKey(basePeriod) : '';

      // Build period labels - EXACT same as BarChart
      const periodLabels = visiblePeriods.map(period => {
        if (period.isCustomRange) {
          return `${period.year}-${period.displayName}-${period.type}`;
        } else if (period.month) {
          return `${period.year}-${period.month}-${period.type}`;
        }
        return `${period.year}-${period.type}`;
      });

      // Build series data - EXACT same as BarChart
      const seriesData = visiblePeriods.map(period => {
        const periodKey = createPeriodKey(period);
        return chartData[periodKey]?.sales || 0;
      });

      // Sales Volume data - EXACT same as BarChart
      const salesVolumeData = visiblePeriods.map(period => {
        const periodKey = createPeriodKey(period);
        return chartData[periodKey]?.salesVolume || 0;
      });

      // Calculate % variance - EXACT same as BarChart
      const percentVariance = seriesData.map((value, idx) => {
        if (idx === 0) return null;
        const prevValue = seriesData[idx - 1];
        if (prevValue === 0) return null;
        return ((value - prevValue) / Math.abs(prevValue)) * 100;
      });

      // Color schemes - EXACT same as BarChart
      const colorSchemes = [
        { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
        { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
        { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
        { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
        { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
      ];

      // Get bar colors - EXACT same as BarChart
      const barColors = visiblePeriods.map((period) => {
        if (period.customColor) {
          const scheme = colorSchemes.find(s => s.name === period.customColor);
          if (scheme) {
            return scheme.primary;
          }
        }
        
        if (period.month === 'Q1' || period.month === 'Q2' || period.month === 'Q3' || period.month === 'Q4') {
          return '#FF6B35';
        } else if (period.month === 'January') {
          return '#FFD700';
        } else if (period.month === 'Year') {
          return '#288cfa';
        } else if (period.type === 'Budget') {
          return '#2E865F';
        }
        
        return '#288cfa';
      });

      // Get logo and division info for header
      const logoBase64 = await getBase64Logo();
      const divisionName = getDivisionDisplayName();
      const periodDisplayText = getBasePeriodText(); // Fixed variable name conflict

      // 🎯 Capture live KPI data by programmatically opening the card
      console.log('🔥 Step: Capturing KPI data...');
      let kpiSummaryHTML = '<div class="placeholder-content"><h3>KPI Summary</h3><p>KPI data not available.</p></div>';
      try {
        // First check if overlay is already visible
        let overlayContainer = document.querySelector('.divisional-dashboard__overlay');
        
        if (!overlayContainer) {
          // Overlay not visible, need to open the KPI card
          console.log('🔍 Looking for Divisional KPIs card...');
          const kpiCard = Array.from(document.querySelectorAll('.divisional-dashboard__card')).find(card => {
            const title = card.querySelector('.divisional-dashboard__card-title');
            return title && title.textContent?.includes('Divisional KPIs');
          });
          
          if (kpiCard) {
            console.log('✅ Found Divisional KPIs card, clicking it...');
            kpiCard.click();
            
            // Wait for overlay to open and KPI to render
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Now try to find the overlay
            overlayContainer = document.querySelector('.divisional-dashboard__overlay');
          }
        }
        
        if (overlayContainer) {
          const clonedOverlay = overlayContainer.cloneNode(true);
          
          // Get the KPI CSS styles from live stylesheets + overlay CSS
          const kpiCSS = extractLiveKPICSS();
          const overlayCSS = extractOverlayCSS();
          
          // Wrap overlay HTML with its CSS
          kpiSummaryHTML = `
            <style>
              ${overlayCSS}
              ${kpiCSS}
            </style>
            ${clonedOverlay.outerHTML}
          `;
          
          console.log('✅ KPI overlay captured successfully with banner and CSS');
          
          // Close the overlay by clicking back button
          const backButton = document.querySelector('.divisional-dashboard__overlay-close');
          if (backButton) {
            backButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          console.warn('⚠️ Overlay container not found in DOM');
        }
      } catch (err) {
        console.error('❌ KPI capture failed:', err);
      }

      // 🎯 Capture table data by programmatically opening cards
      console.log('🔥 Step: Capturing table data...');
      
      let productGroupTableHTML = '<div class="placeholder-content"><h3>Product Group</h3><p>Not available</p></div>';
      let plFinancialTableHTML = '<div class="placeholder-content"><h3>P&L Financial</h3><p>Not available</p></div>';
      let salesCustomerTableHTML = '<div class="placeholder-content"><h3>Sales by Customer</h3><p>Not available</p></div>';
      let salesRepTableHTML = '<div class="placeholder-content"><h3>Sales by Sales Rep</h3><p>Not available</p></div>';
      let salesCountryTableHTML = '<div class="placeholder-content"><h3>Sales by Countries</h3><p>Not available</p></div>';
      
      // Helper function to open card, capture overlay with table, and close
      const captureTableFromCard = async (cardTitle, tableSelector, subCardTitle = null) => {
        try {
          console.log(`📋 Capturing ${cardTitle}${subCardTitle ? ` > ${subCardTitle}` : ''}...`);
          
          // Find and click the card
          const card = Array.from(document.querySelectorAll('.divisional-dashboard__card')).find(c => {
            const title = c.querySelector('.divisional-dashboard__card-title');
            return title && title.textContent?.includes(cardTitle);
          });
          
          if (!card) {
            console.warn(`⚠️ Card not found: ${cardTitle}`);
            return null;
          }
          
          card.click();
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for overlay to load
          
          // If this card has sub-cards (like Sales by Countries), switch view using exposed global function
          if (subCardTitle) {
            const overlay = document.querySelector('.divisional-dashboard__overlay');
            if (overlay) {
              let subCardFound = false;
              
              // Wait a bit more for the component to mount and expose the global function
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Method 1: Use the globally exposed setActiveView function (most reliable!)
              if (window.__salesCountrySetActiveView) {
                console.log(`📋 Using window.__salesCountrySetActiveView to switch to "${subCardTitle}"`);
                const viewId = subCardTitle.toLowerCase().replace(' 2d', ''); // 'Table' -> 'table', 'Map 2D' -> 'map'
                console.log(`📋 Calling setActiveView with viewId: "${viewId}"`);
                window.__salesCountrySetActiveView(viewId);
                subCardFound = true;
                
                // Wait for React to re-render
                await new Promise(resolve => setTimeout(resolve, 2500));
                
                // For Chart and Map views, wait additional time for complex components to render
                if (viewId === 'chart' || viewId === 'map') {
                  console.log(`📋 ${viewId} view detected - waiting additional time for component rendering...`);
                  await new Promise(resolve => setTimeout(resolve, 3000)); // Extra 3s for ECharts/Leaflet
                  
                  // Poll for content to ensure it's actually rendered
                  let attempts = 0;
                  while (attempts < 10) {
                    const hasCanvas = overlay.querySelector('canvas');
                    const hasLeaflet = overlay.querySelector('.leaflet-container');
                    const hasContent = (viewId === 'chart' && hasCanvas) || (viewId === 'map' && hasLeaflet);
                    
                    if (hasContent) {
                      console.log(`📋 ${viewId} content detected after ${attempts} attempts`);
                      break;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                  }
                  
                  if (attempts >= 10) {
                    console.warn(`⚠️ ${viewId} content not detected after 10 attempts (5 seconds)`);
                  }
                }
                
                // Verify the view changed
                const hasContent = overlay.querySelector('table, canvas, .leaflet-container, .sbc-table, .recharts-wrapper');
                console.log(`📋 After setActiveView: hasContent=${!!hasContent}`);
              } else {
                console.log(`📋 window.__salesCountrySetActiveView not found, trying click methods...`);
                
                // Fallback: Try clicking the sub-cards
                const salesCountrySubCards = overlay.querySelectorAll('.sales-country-subcard');
                console.log(`📋 Found ${salesCountrySubCards.length} sales-country-subcard elements`);
                
                for (const subCard of salesCountrySubCards) {
                  const titleElem = subCard.querySelector('.sales-country-subcard-title');
                  const titleText = titleElem?.textContent?.trim() || '';
                  console.log(`📋 Sub-card title: "${titleText}"`);
                  
                  if (titleText.toLowerCase() === subCardTitle.toLowerCase()) {
                    console.log(`📋 ✅ Found matching sub-card: ${subCardTitle}, attempting to click...`);
                    
                    // Get element position for realistic event coordinates
                    const rect = subCard.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    // Simulate full pointer event sequence (what framer-motion listens to)
                    const pointerDown = new PointerEvent('pointerdown', {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      clientX: centerX,
                      clientY: centerY,
                      pointerId: 1,
                      pointerType: 'mouse',
                      isPrimary: true,
                      button: 0,
                      buttons: 1
                    });
                    
                    const pointerUp = new PointerEvent('pointerup', {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      clientX: centerX,
                      clientY: centerY,
                      pointerId: 1,
                      pointerType: 'mouse',
                      isPrimary: true,
                      button: 0,
                      buttons: 0
                    });
                    
                    const clickEvt = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                      clientX: centerX,
                      clientY: centerY,
                      button: 0
                    });
                    
                    // Dispatch in sequence
                    subCard.dispatchEvent(pointerDown);
                    await new Promise(r => setTimeout(r, 50));
                    subCard.dispatchEvent(pointerUp);
                    await new Promise(r => setTimeout(r, 50));
                    subCard.dispatchEvent(clickEvt);
                    
                    // Also try React fiber props directly
                    const reactPropsKey = Object.keys(subCard).find(key => key.startsWith('__reactProps$'));
                    if (reactPropsKey && subCard[reactPropsKey]?.onClick) {
                      console.log(`📋 Also calling React onClick from __reactProps$`);
                      try {
                        subCard[reactPropsKey].onClick({ 
                          preventDefault: () => {}, 
                          stopPropagation: () => {},
                          nativeEvent: clickEvt,
                          target: subCard,
                          currentTarget: subCard
                        });
                      } catch (e) {
                        console.warn('React onClick call failed:', e);
                      }
                    }
                    
                    subCardFound = true;
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for sub-view to load
                    break;
                  }
                }
              }
              
              if (!subCardFound) {
                console.warn(`⚠️ Sub-card "${subCardTitle}" not found in ${cardTitle}`);
              } else {
                // Verify the table/content loaded after clicking sub-card
                const overlayAfterClick = document.querySelector('.divisional-dashboard__overlay');
                const hasTable = overlayAfterClick?.querySelector('table, .sales-by-country-table, .sbc-table, canvas, .leaflet-container');
                const stillHasSubCards = overlayAfterClick?.querySelector('.sales-country-subcard');
                console.log(`📋 After sub-card click: hasTable/Chart/Map=${!!hasTable}, stillHasSubCards=${!!stillHasSubCards}`);
                
                if (stillHasSubCards && !hasTable) {
                  console.warn(`⚠️ Sub-card click may not have worked - still showing sub-cards`);
                }
              }
            }
          }
          
          // Capture the entire overlay (includes banner + table)
          const overlay = document.querySelector('.divisional-dashboard__overlay');
          if (overlay) {
            // Debug: Log what we're about to capture
            const overlayTitle = overlay.querySelector('.divisional-dashboard__overlay-title')?.textContent || 'Unknown';
            const hasSubCards = overlay.querySelector('.sales-country-subcard');
            const hasSBCTable = overlay.querySelector('.sbc-table, .sales-by-country-table');
            const hasCanvas = overlay.querySelector('canvas');
            const hasLeaflet = overlay.querySelector('.leaflet-container');
            console.log(`📋 CAPTURE DEBUG for ${cardTitle}${subCardTitle ? ' > ' + subCardTitle : ''}:`);
            console.log(`   - Overlay title: "${overlayTitle}"`);
            console.log(`   - hasSubCards: ${!!hasSubCards}`);
            console.log(`   - hasSBCTable: ${!!hasSBCTable}`);
            console.log(`   - hasCanvas: ${!!hasCanvas}`);
            console.log(`   - hasLeaflet: ${!!hasLeaflet}`);
            
            // Convert all canvas elements to images BEFORE cloning
            const canvases = overlay.querySelectorAll('canvas');
            canvases.forEach(canvas => {
              try {
                // Create an image element
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/png');
                img.style.width = canvas.style.width || canvas.width + 'px';
                img.style.height = canvas.style.height || canvas.height + 'px';
                img.style.display = canvas.style.display || 'block';
                img.className = canvas.className;
                
                // Replace canvas with image in the DOM temporarily
                canvas.parentNode.replaceChild(img, canvas);
              } catch (e) {
                console.warn('Failed to convert canvas to image:', e);
              }
            });
            
            const cloned = overlay.cloneNode(true);
            console.log(`✅ ${cardTitle} overlay captured (${canvases.length} canvas elements converted)`);
            
            // Close overlay (this also restores the original canvases)
            const backButton = document.querySelector('.divisional-dashboard__overlay-close');
            if (backButton) {
              backButton.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // IMPORTANT: Don't reset view here - let the component unmount naturally
            // This ensures each new capture starts fresh with the component mounting from scratch
            
            return cloned.outerHTML;
          } else {
            console.warn(`⚠️ Overlay not found for ${cardTitle}`);
            return null;
          }
        } catch (err) {
          console.error(`❌ Failed to capture ${cardTitle}:`, err);
          return null;
        }
      };
      
      // Capture each table sequentially
      // NOTE: Card titles must match EXACTLY what's displayed in DivisionalDashboardLanding.js
      const pgTable = await captureTableFromCard('Product Groups', 'table.product-group-table');
      if (pgTable) {
        const overlayCSS = extractOverlayCSS();
        productGroupTableHTML = `<style>${overlayCSS}</style>${pgTable}`;
      }
      
      // P&L card title is "Profit and Loss Statement" in the live app
      const plTable = await captureTableFromCard('Profit and Loss', 'table.pl-financial-table');
      if (plTable) {
        const overlayCSS = extractOverlayCSS();
        plFinancialTableHTML = `<style>${overlayCSS}</style>${plTable}`;
      }
      
      const scTable = await captureTableFromCard('Sales by Customers', 'table.sales-by-customer-table');
      if (scTable) {
        const overlayCSS = extractOverlayCSS();
        salesCustomerTableHTML = `<style>${overlayCSS}</style>${scTable}`;
      }
      
      const srTable = await captureTableFromCard('Sales by Sales Reps', 'table.sales-by-sales-rep-table');
      if (srTable) {
        const overlayCSS = extractOverlayCSS();
        salesRepTableHTML = `<style>${overlayCSS}</style>${srTable}`;
      }
      
      // Sales by Countries - capture table view directly (no sub-cards)
      console.log('🔥 Capturing Sales by Countries - Table view...');
      const coTable = await captureTableFromCard('Sales by Countries', 'table.sales-by-country-table', 'Table');
      if (coTable) {
        const overlayCSS = extractOverlayCSS();
        salesCountryTableHTML = `<style>${overlayCSS}</style>${coTable}`;
      }
      
      // 🎯 Capture chart overlays (same approach as tables)
      console.log('🔥 Step: Capturing chart overlays...');
      
      let salesVolumeHTML = '<div class="placeholder-content"><h3>Sales & Volume Analysis</h3><p>Not available</p></div>';
      let marginAnalysisHTML = '<div class="placeholder-content"><h3>Margin Analysis</h3><p>Not available</p></div>';
      let manufacturingCostHTML = '<div class="placeholder-content"><h3>Manufacturing Cost</h3><p>Not available</p></div>';
      let belowGPExpensesHTML = '<div class="placeholder-content"><h3>Below GP Expenses</h3><p>Not available</p></div>';
      let combinedTrendsHTML = '<div class="placeholder-content"><h3>Cost & Profitability Trend</h3><p>Not available</p></div>';
      
      // Capture Sales & Volume Analysis
      const svChart = await captureTableFromCard('Sales & Volume Analysis', null);
      if (svChart) {
        const overlayCSS = extractOverlayCSS();
        salesVolumeHTML = `<style>${overlayCSS}</style>${svChart}`;
      }
      
      // Capture Margin Analysis
      const maChart = await captureTableFromCard('Margin Analysis', null);
      if (maChart) {
        const overlayCSS = extractOverlayCSS();
        marginAnalysisHTML = `<style>${overlayCSS}</style>${maChart}`;
      }
      
      // Capture Manufacturing Cost
      const mcChart = await captureTableFromCard('Manufacturing Cost', null);
      if (mcChart) {
        const overlayCSS = extractOverlayCSS();
        manufacturingCostHTML = `<style>${overlayCSS}</style>${mcChart}`;
      }
      
      // Capture Below GP Expenses
      const bgChart = await captureTableFromCard('Below GP Expenses', null);
      if (bgChart) {
        const overlayCSS = extractOverlayCSS();
        belowGPExpensesHTML = `<style>${overlayCSS}</style>${bgChart}`;
      }
      
      // Capture Combined Trends
      const ctChart = await captureTableFromCard('Cost & Profitability Trend', null);
      if (ctChart) {
        const overlayCSS = extractOverlayCSS();
        combinedTrendsHTML = `<style>${overlayCSS}</style>${ctChart}`;
      }
      
      // 🎯 Extract CSS styles from loaded stylesheets (automatic sync with live page)
      console.log('🔥 Step: Extracting CSS styles from loaded stylesheets...');
      const [productGroupStyles, salesByCountryStyles, salesByCustomerStyles, salesBySalesRepStyles, plTableStyles] = await Promise.all([
        getProductGroupTableStyles(),
        getSalesByCountryTableStyles(),
        getSalesByCustomerTableStyles(),
        getSalesBySalesRepTableStyles(),
        getPLTableStyles()
      ]);
      console.log('✅ CSS styles extracted successfully');
      console.log(`📊 Product Group CSS: ${productGroupStyles.length} characters`);
      console.log(`📊 Sales by Country CSS: ${salesByCountryStyles.length} characters`);
      console.log(`📊 Sales by Customer CSS: ${salesByCustomerStyles.length} characters`);
      console.log(`📊 Sales by Sales Rep CSS: ${salesBySalesRepStyles.length} characters`);
      console.log(`📊 P&L Table CSS: ${plTableStyles.length} characters`);

      // 🚨 CRITICAL: Verify CSS was extracted
      if (salesByCustomerStyles.length < 1000) {
        console.error('❌❌❌ CRITICAL: Sales by Customer CSS extraction failed or returned insufficient data!');
        console.error(`   Only got ${salesByCustomerStyles.length} characters. Expected > 1000.`);
        console.error('   Export will NOT have proper styling for Sales by Customer table!');
      } else {
        console.log('✅ Sales by Customer CSS verified - sufficient size for proper styling');
      }

      if (salesBySalesRepStyles.length < 1000) {
        console.error('❌❌❌ CRITICAL: Sales by Sales Rep CSS extraction failed or returned insufficient data!');
        console.error(`   Only got ${salesBySalesRepStyles.length} characters. Expected > 1000.`);
        console.error('   Export will NOT have proper styling for Sales by Sales Rep table!');
      } else {
        console.log('✅ Sales by Sales Rep CSS verified - sufficient size for proper styling');
      }

      if (plTableStyles.length < 5000) {
        console.error('❌❌❌ CRITICAL: P&L Table CSS extraction failed or returned insufficient data!');
        console.error(`   Only got ${plTableStyles.length} characters. Expected > 5000.`);
        console.error('   Export will NOT have proper styling for P&L table!');
      } else {
        console.log('✅ P&L Table CSS verified - sufficient size for proper styling');
      }

      // 🔌 Load ECharts bundle to embed directly in exported HTML (offline support)
      console.log('⚙️ Loading ECharts bundle for offline export...');
      const echartsBundleRaw = await getEChartsBundle();
      const echartsBundle = escapeScriptContent(echartsBundleRaw);
      console.log('✅ ECharts bundle loaded and sanitized');

      // Generate the comprehensive HTML with EXACT same charts as main Charts page
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${divisionName} - Comprehensive Report</title>
    <script>
${echartsBundle}
    </script>
    <script>
        // Non-destructive fallback - track ECharts availability without wiping page
        window.__chartsUnavailable = false;
        window.addEventListener('load', function () {
            if (typeof echarts === 'undefined') {
                console.error('⚠️ ECharts failed to load from CDN');
                window.__chartsUnavailable = true;
                var banner = document.createElement('div');
                banner.setAttribute('role', 'status');
                banner.style.cssText = 'background:#fff3cd;border:2px solid #ffc107;padding:12px 16px;margin:12px;border-radius:8px;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto;';
                banner.innerHTML = '⚠️ Note: Interactive charts could not be loaded. Tables and KPI data below are still available.';
                document.body.prepend(banner);
            }
        });
    </script>
    <script>
        // Font detection removed - using SVG-based UAE symbols that render immediately
        // No font loading detection needed since we use getUAEDirhamSymbolHTML() SVG approach
        
        // Fallback for ECharts loading
        // ECharts loading is now handled by waitForECharts() function with proper retry mechanism
        // See the DOMContentLoaded event listener below
    </script>
    <script>
        // Orientation / small-screen landscape advisory banner
        (function(){
          var STORAGE_KEY='ipd-rotate-hint-dismissed';
          function isPortrait(){
            try { return window.matchMedia('(orientation: portrait)').matches; } catch(e){ return (window.innerHeight||0) >= (window.innerWidth||0); }
          }
            function shouldShow(){
              try { if(localStorage.getItem(STORAGE_KEY)==='1') return false; } catch(e){}
              var w=window.innerWidth||document.documentElement.clientWidth||0;
              return w < 768 && isPortrait();
            }
            function ensureEl(){
              var el=document.getElementById('orientation-hint');
              if(!el){
                el=document.createElement('div');
                el.id='orientation-hint';
                el.className='orientation-hint';
                el.setAttribute('role','status');
                el.setAttribute('aria-live','polite');
                el.innerHTML="<div class='oh-text'>For the best experience, rotate your phone to landscape.</div>"+
                  "<div class='oh-actions'>"+
                  "<button type='button' class='oh-close' aria-label='Dismiss message'>Got it</button>"+
                  "<button type='button' class='oh-never' aria-label='Don't show again'>Don't show again</button>"+
                  "</div>";
                document.body.appendChild(el);
                var close=el.querySelector('.oh-close');
                var never=el.querySelector('.oh-never');
                if(close) close.addEventListener('click',function(){ el.classList.remove('show'); });
                if(never) never.addEventListener('click',function(){ try{localStorage.setItem(STORAGE_KEY,'1');}catch(e){} el.classList.remove('show'); });
              }
              return el;
            }
            function update(){
              var el=ensureEl();
              if(shouldShow()) el.classList.add('show'); else el.classList.remove('show');
            }
            window.addEventListener('resize',update);
            window.addEventListener('orientationchange',update);
            if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',update); else update();
        })();
    </script>
    <style>
        @font-face {
            font-family: 'UAESymbol';
            src: url('data:font/woff2;base64,d09GMgABAAAAAAQYAA0AAAAACBAAAAPDAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP0ZGVE0cBmAAgkIIBBEICoUUhCkLCgABNgIkAxAEIAWEEAcqG7YGUZQPTgfg47Apmy9iLmImDnGZy6goEb/MR/MYQbVG9uze3RO4ALBFhQoAVFiTQhIyGnVcolgBokvV/WSX/+Yu3Al08BwCbQCpXXyYbdB9UFW6f3A5/X/6J1j6rE/3ezTw3xoLs7ZIgImtaUX58mgKJJRpgon2VjNR6jPw3PkpCCJqLwS8uH9zAuBt6/4L8i7/FfljnFKSjqSrOCbPjpcmhICkbMLIBNdp7uaEepj22efcvw5Wmt7ZAQQA+kPIyOgNgcmEAr0Z6Q8UCoHPdb1urXtAQFQEvU+ii99CwG/KpmMPSCNA1LUECtCICg/wHtCKsZEAFz29WmIpx8aWRoXYmKqaKVpzXGPx4xRWxDrOiI46Pi5gYZrFV1nRURULIOacOMpfNA0OOEB0VAaxbJpa9cACVLfusOrAHHCYEXJSxuFMOMlzYrjif0QefiT+CEVJTut5CY9Q3rhrOk6ORKxIhLENPyYHzM7gNTvhyNbOyA+5cTUcxsBAwbYEz4hnOLRLvUv+pPBYyZ4Ao4LQv8rP5M8wVD4AXnPeCDrOY975thcv4RW7Nbu1u8x3fSUbxRt09Qc4BtdqBO+N0k1vktptmTo3z4ok3bC7ANk6w/v5t4cixFb5r4Qx7hewSoO10Pvjr2OEkcAWoYLFurl/zmyEQtN/3YQZ64aAodj/C3GxW7lQ9zTZa4S7P03ykfeRY/qVJdqcKi7WqGtO35P6ItlvOnmk15N2cyckpvH93UXSirc66fagHa6uBbXJS23+ca7vZswQxF4Tj19ElEbnsnt11wOWtsq+/M3LL16ExpEvXqQ0u/l86v/ogX370tJ8DDgwBNdO3jo5y7Zk7uZsJ9gAmutT+WV6dzmMm3ypofBt4uWqfDr5Sk6+TXQxu7ASArJV/NeJSG8NITj3+8alNdaT/zXi/PH0l6svQKMEAht4IsszBuSXAtMLb34AQBZGdrNA4e4LQEIITEcD0O6CAPTgD4HQZD0Ekga7IZANcU+AQlM0C1DqiHyk2hJLCUXRhIlAJ0O3TDJpt4XM5pgnC922yVLfcPicSnfEi9Ol24heLZo060e4qOOK8OXNVwAPRI1eDZp1gN8sDepcv0rmoJrehuYOgEU69WvRr12DegFg0bYL9/j6AID5GjQZ0F7RhlfKFQFm6MoV5GKvJg3HZ9K8EaEdKsu+Rl/BPPnx7NaAJ2NhnNPb1EB8aW8SSjrg9YJvsKefZ8s99YouLvbq09LbOMKbNx80b27D7W7O29uH9qaeKoYJcK2vmgiEfIGINHYBAA==') format('woff2');
        }
        
        /* ========================================
           CSS VARIABLE DEFINITIONS
           Required for P&L Table and Sales by Sales Rep sticky headers
           ======================================== */
        :root {
          /* P&L Table - Sticky header row height */
          --pl-hdr-h: 28px;

          /* P&L Table - z-index layering for sticky elements */
          --z-corner: 20;    /* Ledger header - always on top */
          --z-hdr4: 16;      /* First header row (Year) */
          --z-hdr3: 15;      /* Second header row (Month) */
          --z-hdr2: 14;      /* Third header row (Type) */
          --z-hdr1: 13;      /* Fourth header row (Metrics) - with double-line */
          --z-firstcol: 12;  /* Body first column */
          --z-header: 10;    /* Generic header fallback */
          --z-separator: 1;  /* Period separators */
          
          /* Sales by Sales Rep Table - Sticky header row height */
          --sbsr-hdr-h: 28px;

          /* Sales by Sales Rep Table - Responsive font sizing */
          --sbsr-font-base: clamp(9px, 1.8vw, 12px);
          --sbsr-font-header: clamp(11px, 2.1vw, 14px);
          --sbsr-font-label: var(--sbsr-font-base);
          --sbsr-font-accent: calc(var(--sbsr-font-base) + 1px);
          --sbsr-font-corner: calc(var(--sbsr-font-header) + 6px);
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #e3f2fd;
            min-height: 100vh;
        }
        
        .header {
            background: white;
            padding: 20px 0;
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        .logo-container {
            margin-bottom: 20px;
        }
        
        .logo {
            max-height: 80px;
            max-width: 200px;
            object-fit: contain;
        }
        
        .division-title {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
            color: #2c3e50;
        }
        
        .period-info {
            font-size: 1.1rem;
            color: #34495e;
            background: #ecf0f1;
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
            font-weight: 600;
            margin-top: 15px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Manufacturing Cost & Below GP Totals Cards - EXACT match of live */
        .totals-scroll-container {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-around;
            gap: 5px;
            margin-top: 20px;
            margin-bottom: 0;
            width: 100%;
        }
        
        .manufacturing-totals-card {
            padding: 12px 10px;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.07);
            min-width: 150px;
            max-width: 180px;
            flex: 1;
            text-align: center;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
            box-sizing: border-box;
        }
        
        .totals-connector {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            align-self: center;
            margin: 0 2px;
            min-width: 40px;
            width: 40px;
            min-height: 60px;
            height: auto;
            flex-shrink: 0;
        }
        
        .totals-card-title {
            font-size: 14px;
            font-weight: 500;
            margin-top: 8px;
            margin-bottom: 0;
            line-height: 1.2;
        }
        
        .totals-card-value {
            font-size: 22px;
            font-weight: bold;
            margin-top: 8px;
            margin-bottom: 0;
        }
        
        .totals-card-subtitle {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 0;
        }
        
        .variance-arrow {
            font-size: 22px;
            font-weight: bold;
            line-height: 1;
            margin: 0;
        }
        
        .variance-text {
            font-size: 18px;
            font-weight: bold;
            line-height: 1.1;
            margin: 0;
        }
        
        .variance-percent {
            font-size: 16px;
            font-weight: bold;
            line-height: 1.1;
            margin: 0;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 25px;
            margin-bottom: 40px;
        }
        
        /* Mobile landscape: 1-2-2-1-2-2-1 pattern with fixed card widths and horizontal scrolling */
        @media screen and (max-width: 1024px) and (orientation: landscape) and (min-width: 768px) {
            body {
                overflow-x: auto;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .container {
                min-width: 1200px;
                width: max-content;
                overflow-x: visible;
                padding-bottom: 20px;
            }
            
            /* Webkit scrollbar styling for better visibility */
            body::-webkit-scrollbar {
                height: 10px;
            }
            
            body::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
                border-radius: 5px;
            }
            
            body::-webkit-scrollbar-thumb {
                background: rgba(52, 152, 219, 0.7);
                border-radius: 5px;
            }
            
            body::-webkit-scrollbar-thumb:hover {
                background: rgba(52, 152, 219, 0.9);
            }
            
            /* KPI row: single card centered */
            .container > div[style*="grid-template-columns: 1fr"] {
                grid-template-columns: 350px !important;
                justify-content: center;
            }
            
            .container > div[style*="grid-template-columns: 1fr"] .chart-card {
                width: 350px;
                min-width: 350px;
                max-width: 350px;
                min-height: 180px;
                max-height: 180px;
                height: 180px;
            }
            
            /* Charts and Tables grids: 2-2-1 pattern */
            .charts-grid {
                grid-template-columns: repeat(2, 350px);
                justify-content: center;
                gap: 20px;
            }
            
            /* Ensure all cards have SAME fixed dimensions */
            .charts-grid .chart-card {
                width: 350px;
                min-width: 350px;
                max-width: 350px;
                min-height: 180px;
                max-height: 180px;
                height: 180px;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                padding: 20px;
                box-sizing: border-box;
            }
            
            .charts-grid .chart-card .card-icon {
                font-size: 2rem;
                margin-bottom: 10px;
            }
            
            .charts-grid .chart-card .card-title {
                font-size: 1.05rem;
                margin-bottom: 6px;
            }
            
            /* Center the 5th card (odd one out) in each 2-2-1 pattern with SAME dimensions */
            .charts-grid .chart-card:nth-child(5) {
                grid-column: 1 / -1;
                width: 350px;
                min-width: 350px;
                max-width: 350px;
                justify-self: center;
            }
        }
        
        .charts-grid.hidden {
            display: none;
        }
    /* Orientation hint banner base styles */
    .orientation-hint { position:fixed; top:0; left:0; right:0; display:none; z-index:2000; background:rgba(3,48,130,.95); color:#fff; padding:10px 14px; font:14px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif; box-shadow:0 2px 6px rgba(0,0,0,.25); border-bottom:2px solid #1e88e5; gap:12px; align-items:center; }
    .orientation-hint.show { display:flex; }
    .orientation-hint .oh-text { flex:1; }
    .orientation-hint .oh-actions { display:flex; gap:8px; }
    .orientation-hint button { background:#fff; color:#033082; border:0; border-radius:6px; padding:6px 10px; font-weight:600; cursor:pointer; }
    .orientation-hint button.oh-never { background:#bbdefb; color:#0d47a1; }
    @media (min-width:768px){ .orientation-hint { display:none !important; } }
    @media (orientation:landscape) and (max-width:767px){ .orientation-hint { display:none !important; } }
        
        .chart-card {
            background: #ffffff;
            border-radius: 15px;
            padding: 24px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            border: 2px solid transparent;
            min-height: 180px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            /* Touch optimization for mobile devices */
            -webkit-tap-highlight-color: rgba(52, 152, 219, 0.3);
            user-select: none;
        }
        
        .chart-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            border-color: #3498db;
        }
        
        .chart-card:active {
            transform: scale(0.98);
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
            border-color: #2980b9;
        }
        
        .card-icon {
            font-size: 2.5rem;
            margin-bottom: 16px;
            display: block;
        }
        
        .card-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: #444b54;
            margin-bottom: 8px;
            letter-spacing: 0.04em;
        }
        
        
        /* Full-screen chart view */
        .full-screen-chart {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: auto;
            min-height: 100vh;
            background: white;
            z-index: 1000;
            display: none;
            overflow: visible;
            box-sizing: border-box;
        }
        
        .full-screen-chart.active {
            display: block !important;
        }
        
        .full-screen-header {
            background: linear-gradient(135deg, #103766 0%, #1a4d99 50%, #2266cc 100%) !important;
            background-color: #103766 !important;
            color: white;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }
        
        .currency-badge {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            color: #fff;
            font-size: 22px;
            line-height: 1;
            pointer-events: none;
            opacity: 0.9;
        }
        
        .full-screen-title {
            font-size: 1.8rem;
            font-weight: 600;
            margin: 0;
        }
        
        /* Sales Reps table header font size */
        .sales-rep-table-container th.empty-header {
            font-size: 28px !important;
        }
        
        /* Center all figures in Sales Reps table */
        .sales-rep-table-container .metric-cell {
            text-align: center !important;
        }
        
        /* Delta cells - smaller font size */
        .sales-rep-table-container .delta-cell {
            font-size: 0.875rem !important; /* 14px - 2px smaller than regular 1rem */
        }
        
        /* Add borders to Sales Reps table */
        .sales-rep-table-container table {
            border-collapse: collapse !important;
            border: 1px solid #ddd !important;
        }
        
        .sales-rep-table-container th,
        .sales-rep-table-container td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
        }
        
        /* Make sales rep names bold */
        .sales-rep-table-container .customer-name-cell {
            font-weight: bold !important;
        }
        
        /* Hide the first row (year row) in Sales Reps table */
        .sales-rep-table-container thead tr:first-child {
            display: none !important;
        }
        
        .back-to-cards-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 2px solid white;
            border-radius: 8px;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .back-to-cards-btn:hover {
            background: white;
            color: #288cfa;
        }
        
        .full-screen-content {
            display: block;
            align-items: stretch;
            justify-content: flex-start;
            background: #ffffff;
            flex: 1;
            padding: 20px;
            overflow-y: visible;
            height: auto;
            box-sizing: border-box;
            scroll-behavior: smooth;
        }

        /* Mobile responsive styles for full-screen header and content */
        @media (max-width: 767px) {
          /* Portrait mobile */
          .full-screen-header {
            padding: 8px 12px !important;
            flex-wrap: wrap !important;
          }

          .full-screen-title {
            font-size: 1.2rem !important;
          }

          .back-to-cards-btn {
            padding: 6px 12px !important;
            font-size: 12px !important;
          }

          .currency-badge {
            position: static !important;
            transform: none !important;
            font-size: 16px !important;
            margin-left: 8px !important;
          }

          .full-screen-content {
            padding: 10px !important;
          }
        }

        @media (max-width: 1024px) and (orientation: landscape) {
          /* Landscape mobile */
          .full-screen-header {
            padding: 8px 15px !important;
          }

          .full-screen-title {
            font-size: 1.3rem !important;
          }

          .back-to-cards-btn {
            padding: 7px 14px !important;
            font-size: 13px !important;
          }

          .currency-badge {
            font-size: 18px !important;
          }

          .full-screen-content {
            padding: 12px !important;
          }
        }
        
        .full-screen-chart-container {
            width: 100%;
            height: auto;
            min-height: 60vh;
            margin-bottom: 20px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Manufacturing Cost responsive scrolling for portrait mode */
        @media (max-width: 768px) and (orientation: portrait) {
            /* Enable scrolling on the container */
            #full-screen-manufacturing-cost .modern-margin-gauge-panel {
                overflow-x: auto;
                overflow-y: visible;
                -webkit-overflow-scrolling: touch; /* smooth scrolling on iOS */
                padding-bottom: 28px;
            }

            /* Chart itself should be wide */
            #full-manufacturing-cost-chart {
                overflow: visible;
            }
        }

        .uae-symbol {
            font-family: 'UAESymbol', sans-serif;
        }
        
        .uae-symbol.fallback {
            font-family: sans-serif !important;
        }
        
        /* EXACT same styling as original charts */
        .modern-margin-gauge-panel {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .modern-gauge-heading {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2c3e50;
            margin: 0 0 20px 0;
            text-align: center;
        }
        
        .chart-data-summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        
         .additional-data {
             margin-top: 5px;
             padding: 20px;
             background: #f8f9fa;
             border-radius: 8px;
         }

        .data-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .data-label {
            font-weight: bold;
            font-size: 18px;
            min-width: 200px;
        }

        .data-values {
            display: flex;
            flex: 1;
            justify-content: space-around;
        }

        .data-value {
            font-weight: bold;
            font-size: 18px;
            text-align: center;
            min-width: 100px;
        }

        /* RESPONSIVE: Align table with chart on mobile */
        @media (max-width: 768px) {
            .additional-data {
                padding: 15px 2%; /* Match chart's 2% left/right padding */
                margin-left: 0;
                margin-right: 0;
            }

            .data-label {
                font-size: 12px;
                min-width: 100px;
            }

            .data-value {
                font-size: 12px;
                min-width: auto;
                flex: 1;
            }

            .data-values {
                justify-content: space-between; /* Align with chart bars */
                padding: 0;
            }
        }

        @media (max-width: 480px) {
            .data-label {
                font-size: 10px;
                min-width: 80px;
            }

            .data-value {
                font-size: 10px;
            }

            .additional-data {
                padding: 10px 2%; /* Match chart's 2% padding */
            }
        }
        
        .purple {
            color: #8e44ad;
        }
        
        .green {
            color: #2E865F;
        }
        
        /* EXACT same header styling as BarChartHTMLExport.js */
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px 0;
        }
        
        .title {
            font-size: 28px;
            font-weight: bold;
            margin: 0 0 10px 0;
            color: #333;
        }
        
        .subtitle {
            font-size: 18px;
            color: #888;
            margin-bottom: 10px;
        }
        
        .note {
            font-size: 14px;
            color: #666;
            font-style: italic;
        }
        
        .chart-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px 0;
        }
        
        /* EXACT same CSS as ModernMarginGauge.css */
        .modern-margin-gauge-panel {
            width: 98%;
            max-width: 1300px;
            margin: 30px auto 0;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .modern-margin-gauge-panel:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .modern-gauge-heading {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 50px;
            color: #333;
        }
        
        .modern-gauge-container {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            justify-items: center;
        }
        
        .modern-gauge-card {
            width: 100%;
            max-width: 260px;
            background-color: #fff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .modern-gauge-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2), 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        
        .gauge-body {
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .gauge-container {
            position: relative;
            width: 100%;
            height: 160px;
            margin-bottom: 20px;
            margin-top: 15px;
        }
        
        .gauge-svg {
            width: 100%;
            height: 100%;
        }
        
        .gauge-track {
            transition: stroke-dashoffset 0.5s ease;
        }
        
        .gauge-progress {
            transition: stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .gauge-absolute {
            font-size: 24px;
            font-weight: 600;
            color: #444;
            margin-bottom: 5px;
        }
        
         .gauge-title {
             padding: 12px 16px;
             text-align: center;
             font-weight: 500;
             font-size: 16px;
         }
        
        @media (max-width: 1400px) {
            .modern-gauge-container {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        
        @media (max-width: 992px) {
            .modern-gauge-container {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 768px) {
            .modern-gauge-container {
                grid-template-columns: 1fr;
            }
        }
        
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
            .title {
                font-size: 24px;
            }
            
            .subtitle {
                font-size: 16px;
            }
            
            .data-label {
                font-size: 16px;
                min-width: 150px;
            }
            
            .data-value {
                font-size: 16px;
                min-width: 80px;
            }
        }
        
        @media (max-width: 480px) {
            .title {
                font-size: 20px;
            }
            
            .subtitle {
                font-size: 14px;
            }
            
            .additional-data {
                margin-top: 10px;
                padding: 10px 15px;
            }
            
            .data-label {
                font-size: 14px;
                min-width: 120px;
            }
            
            .data-value {
                font-size: 14px;
                min-width: 60px;
            }
        }
        
        /* Keep 5 columns on larger screens - desktop & tablet maintain same layout */
        @media (max-width: 1400px) and (min-width: 768px) {
            .charts-grid {
                grid-template-columns: repeat(5, 1fr);
                gap: 20px;
            }
        }
        
        /* Mobile portrait: single column - NO CHANGES per user request */
        @media (max-width: 767px) and (orientation: portrait) {
            .logo {
                max-width: 80px;
                height: auto;
            }
            
            .header {
                padding: 12px 16px;
            }
            
            .header h1 {
                font-size: 1.5rem;
            }
            
            .charts-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            
            .chart-card-header {
                padding: 20px;
            }
            
            .chart-icon {
                width: 50px;
                height: 50px;
                font-size: 20px;
            }
            
            .chart-title {
                font-size: 1.1rem;
            }
            
            /* Mobile refinements */
            .chart-card { padding:16px; min-height:150px; }
            .gauge-container { height:130px; }
            .gauge-absolute { font-size:20px; }
            .pl-financial-table { font-size:12px; }
            .pl-financial-table th, .pl-financial-table td { padding:6px 8px; }
            .pl-table-container { overflow-x:auto; -webkit-overflow-scrolling:touch; }
            
            /* KPI Portrait Enhancements */
            .kpi-dashboard { padding:14px; }
            .kpi-section { padding:18px; }
        }
        
        @media (max-width: 480px) {
            .logo {
                max-width: 60px;
            }
            
            .header h1 {
                font-size: 1.2rem;
            }
            
            .charts-grid {
                grid-template-columns: 1fr;
                gap: 12px;
                padding: 0 8px;
            }
            
            .chart-card {
                padding: 12px;
                min-height: 120px;
            }
            
            .card-icon {
                font-size: 2rem;
                margin-bottom: 12px;
            }
            
            .card-title {
                font-size: 1.1rem;
            }
        }
        
        @media (max-width: 375px) {
            .chart-card {
                min-height: 100px;
                padding: 10px;
            }
        }
        
        /* ================================================================================================
           KPI PORTRAIT ENHANCEMENTS - Portrait Mobile Only (NOT desktop/tablet)
           ⚠️⚠️ CRITICAL SYNC WARNING ⚠️⚠️
           These rules MUST be kept in sync with src/utils/sharedStyles.js
           Any changes here must be replicated in sharedStyles.js and vice versa.
           Search for "SYNC WARNING" in both files when making changes.
           ================================================================================================ */
        @media (max-width: 768px) and (orientation: portrait) {
          /* Simple KPI Cards Horizontal Rail */
          /* ⚠️ SYNC: Must match sharedStyles.js .kpi-cards portrait rules */
          .kpi-cards:not(.category-cards):not(.export-regions) { 
            display:flex; 
            flex-wrap:nowrap; 
            overflow-x:auto; 
            -webkit-overflow-scrolling:touch; 
            gap:12px; 
            scroll-snap-type:x proximity; 
            padding:4px 4px 10px; 
            margin:0 -4px; 
          }
          .kpi-cards::-webkit-scrollbar { height:6px; }
          .kpi-cards::-webkit-scrollbar-track { background:transparent; }
          .kpi-cards::-webkit-scrollbar-thumb { background:#c5d2ec; border-radius:3px; }
          .kpi-cards:not(.category-cards):not(.export-regions) .kpi-card { 
            flex:0 0 auto; 
            min-width:clamp(220px,80vw,320px); 
            max-width:86vw; 
            scroll-snap-align:start; 
            padding:16px; 
            min-height:150px; 
            transition:none; 
          }
          /* Make the full-width revenue drivers card span the viewport to avoid truncation */
          .kpi-cards:not(.category-cards):not(.export-regions) .kpi-card.revenue-drivers {
            flex:0 0 100% !important; 
            min-width:100% !important; 
            max-width:100% !important; 
          }
          /* Category cards (Process/Material) should stack vertically, not scroll */
          .kpi-section .kpi-cards.category-cards { 
            display:grid; 
            grid-template-columns:1fr; 
            gap:16px; 
            overflow:visible; 
          }
          
          /* Region rail fallback if sharedStyles not loaded yet - PORTRAIT MOBILE ONLY */
          /* ⚠️ SYNC: Must match sharedStyles.js export-regions portrait rules */
          .export-regions { 
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: 16px !important; 
            padding: 6px 8px 10px !important; 
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior-x: contain !important;
            scroll-snap-type: x mandatory !important; 
          }
          .export-regions .kpi-card { 
            flex: 0 0 auto !important;
            min-width: clamp(220px, 80vw, 300px) !important; 
            max-width: 90vw !important;
            scroll-snap-align: start !important;
          }
          
          /* Top Revenue Drivers: allow horizontal scroll on portrait mobile only */
          /* ⚠️ SYNC: Must match sharedStyles.js revenue-drivers portrait rules */
          .kpi-card.revenue-drivers { overflow:visible !important; }
          .kpi-card.revenue-drivers .kpi-value { 
            overflow-x:auto; 
            -webkit-overflow-scrolling:touch; 
            overscroll-behavior-x: contain;
          }
          
          /* Prevent category cards vertical clipping in export HTML if sharedStyles missing */
          .product-performance-section .kpi-cards.category-cards .kpi-card { min-height:auto !important; max-height:none !important; overflow:visible !important; }
          .product-performance-section .kpi-cards.category-cards .kpi-card .kpi-value { line-height:1.4 !important; }
        }
        
        /* Global KPI refinements (all viewports) */
      .kpi-card.large { grid-column:auto; }
      .kpi-label { font-size:0.8em; letter-spacing:.02em; white-space:normal; word-break:normal; }
      .kpi-value { font-size:1.15em; margin-bottom:8px; }
      .kpi-icon { font-size:1.6em; margin-bottom:10px; }
      .kpi-trend { font-size:.72em; padding:3px 6px; }
      /* Stabilize touch: remove hover transform jump */
      .kpi-card:hover { transform:none; box-shadow:0 4px 16px rgba(0,0,0,.08); }
        
        /* Desktop/Tablet: Export-regions single-row flex layout (outside portrait query) */
        .export-regions {
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          justify-content: space-between;
          align-items: stretch;
        }
        .export-regions .kpi-card {
          flex: 1 1 0;
          min-width: 0;
          min-height: 140px;
        }
        


        /* UAE Dirham Symbol - SVG based, no font loading needed */
        .uae-dirham-symbol {
          display: inline-block;
          vertical-align: -0.1em;
          width: 1em;
          height: 1em;
          margin-right: 0.2em;
          fill: currentColor;
        }
        .table-subtitle {
            font-size: 0.9rem;
            color: #666;
            margin-top: 5px;
            text-align: center;
        }

        /* ========================================
           UNIFIED PRODUCT GROUP TABLE STYLES
           Extracted from ProductGroupTableStyles.css (automatic sync with live page)
           ======================================== */
        ${productGroupStyles}
        
        /* ========================================
           P&L Table Styles - Extracted from PLTableStyles.css (automatic sync with live page)
           ======================================== */
        ${plTableStyles}

        /* ========================================
           SALES BY COUNTRY TABLE STYLES - Extracted from live version (automatic sync)
           ======================================== */
        ${salesByCountryStyles}

        /* ========================================
           SALES BY CUSTOMER TABLE STYLES - Extracted from live version (automatic sync)
           ======================================== */
        ${salesByCustomerStyles}

        /* ========================================
           SALES BY SALES REP TABLE STYLES - Extracted from live version (automatic sync)
           ======================================== */
        ${salesBySalesRepStyles}

        /* ========================================
           MOBILE SAFARI STICKY FIX - iOS Specific
           ======================================== */
        @supports (-webkit-touch-callout: none) {
          /* iOS Safari only - Portrait mode */
          @media (max-width: 767px) {
            .pl-table-container,
            .full-screen-content .pl-table-container,
            .full-screen-content .pl-sales-customer-table-container,
            .full-screen-content .pl-sales-country-table-container,
            .full-screen-content .sales-rep-table-container,
            .full-screen-content .pl-sales-rep-table-container {
              position: relative;
              overflow: auto !important;
              -webkit-overflow-scrolling: touch;
              max-height: calc(100vh - 120px) !important;
            }
            
            .pl-financial-table thead th {
              position: -webkit-sticky !important;
              position: sticky !important;
              -webkit-backface-visibility: hidden;
              backface-visibility: hidden;
              -webkit-transform: translate3d(0, 0, 0);
              transform: translate3d(0, 0, 0);
            }
            
            .pl-financial-table tbody td:first-child {
              position: -webkit-sticky !important;
              position: sticky !important;
              -webkit-backface-visibility: hidden;
              backface-visibility: hidden;
              -webkit-transform: translate3d(0, 0, 0);
              transform: translate3d(0, 0, 0);
            }
          }
        }

        /* Sales by Customer Table export container */
        .pl-sales-customer-table-container {
          width: 100%;
          max-width: 100% !important;
          margin: 0 auto !important;
          position: relative !important;
          overflow-x: auto !important;
          overflow-y: auto !important;          /* CRITICAL: Changed from visible to auto */
          -webkit-overflow-scrolling: touch !important;
          padding-bottom: 10px !important;
          background-color: #fff !important;
          
          /* Desktop: taller responsive container for sticky - increased from 80vh */
          max-height: 85vh !important;           /* Increased for more table visibility */
          min-height: 60vh !important;           /* Increased minimum height */
          will-change: scroll-position !important; /* Optimize for scrolling */
          contain: layout !important;            /* Isolate layout calculations */
        }

        /* Explicit height for mobile browsers - optimized for smaller screens */
        @media (max-width: 1024px) {
          .pl-table-container {
            /* Height set by Portrait/Landscape specific media queries below */
            overflow-y: auto !important;
          }
        }

        /* Exported HTML needs max-height container for sticky headers to work */
        .full-screen-content .pl-table-container,
        .full-screen-content .pl-sales-customer-table-container,
        .full-screen-content .pl-sales-country-table-container,
        .full-screen-content .sales-rep-table-container,
        .full-screen-content .pl-sales-rep-table-container {
          max-height: 85vh !important;           /* Increased for more table visibility */
          min-height: 60vh !important;           /* Increased minimum height */
          overflow-y: auto !important;          /* Enable vertical scroll for sticky */
        }

        /* Mobile: Ensure proper scroll container */
        @media (max-width: 1024px) {
          .pl-table-view {
            height: 100%;
            overflow: visible;
            position: relative;
          }
          
          /* Critical: Table wrapper needs explicit dimensions */
          body {
            overflow-y: scroll !important;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Ensure table container creates stacking context */
          .pl-table-container {
            transform: translateZ(0);  /* Force GPU acceleration */
          }
        }

        /* ========================================
           HEADER & TITLE STYLING
           ======================================== */

        .pl-table-header {
          text-align: center;
          width: 100%;
          margin-bottom: 20px;
          display: flex;
          justify-content: center;
        }

        .pl-header-center {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .pl-table-title {
          margin: 0 0 8px 0;
          font-size: 1.5rem;
          color: #000;
          text-align: center;
          font-weight: bold;
        }

        .pl-table-subtitle {
          font-style: italic;
          font-weight: bold;
          text-align: center;
          color: #000;
          margin: 0 0 16px 0;
          font-size: 1rem;
        }

        /* ========================================
           CORE TABLE STYLING
           ======================================== */

        .pl-financial-table {
          width: 100%;
          min-width: 100%;
          border-collapse: separate; /* needed for sticky headers */
          border-spacing: 0;         /* remove default cell gutters that look like borders */


          font-size: clamp(9px, 1.8vw, 12px);
          font-family: Arial, sans-serif;
          table-layout: fixed;
          max-width: 100%;
          background: #fff;
          background-color: #fff;
        }

        /* Keep headers at responsive 14px - STICKY for export */
        .pl-financial-table thead th {
          font-size: clamp(11px, 2.1vw, 14px);
          height: var(--pl-hdr-h) !important;
          min-height: var(--pl-hdr-h) !important;
          max-height: var(--pl-hdr-h) !important;
          position: sticky !important;
          top: 0;
          z-index: var(--z-hdr4) !important;
          font-weight: 700;

          overflow: hidden !important;
          box-sizing: border-box !important;
          padding: 4px 6px !important; /* Fixed consistent padding */
          line-height: 1.2 !important;
          vertical-align: middle !important;
          /* IMPORTANT: let inline bg win */
          background-color: transparent;
          background-clip: padding-box !important;
        }

        /* underlay: blocks rows scrolling behind, but stays under inline color */
        /* White underlay ONLY when there is NO inline background on the cell */
        .pl-financial-table thead th:not([style*="background"]):not([style*="background-color"])::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #fff;
          z-index: -1;              /* keep it BEHIND the content and inline bg */
          pointer-events: none;
        }

        /* If the header DOES have inline bg, don't put white on top of it */
        .pl-financial-table thead th[style*="background"],
        .pl-financial-table thead th[style*="background-color"] {
          background-color: transparent;     /* let inline be visible */
        }

        /* Four sticky header tiers - stacked downwards */
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
        }

        /* Last header band (metrics - 4th row) */
        .pl-financial-table thead tr:nth-child(4) th {
          font-size: 12px !important;
          font-family: Arial, sans-serif;
        }

        /* First data column (row labels) is left-aligned */
        .pl-financial-table tbody td:first-child { text-align: left; }

        /* Keep numbers tight in non-first columns */
        .pl-financial-table td:not(:first-child),
        .pl-financial-table thead th:not(:first-child) {
          white-space: nowrap !important;
        }

        /* ========================================
           TABLE CELL STYLING
           ======================================== */

        .pl-financial-table th,
        .pl-financial-table td {
          padding: clamp(2px, 0.5vw, 8px) clamp(3px, 0.7vw, 12px);
          vertical-align: middle;
          text-align: center;
          line-height: 1.15;
          white-space: normal;   /* allow wrapping by default */
          word-break: normal;
          overflow-wrap: anywhere;
          background-clip: border-box;
        }

        /* FIRST COLUMN (ALL SCREENS) - Body cells - STICKY LEFT */
        /* Apply to body first column - EXCLUDE separator rows */
        .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child {
          position: sticky !important;
          left: 0 !important;
          z-index: var(--z-firstcol) !important;
          background-color: transparent;   /* allow row-level / inline */
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 28ch;
          min-width: 120px;
          box-sizing: border-box;
        }

        /* Pseudo-element background for first column - WHITE to prevent bleeding while maintaining white appearance */
        /* Only apply to Ledger header and body cells, not first period columns in rows 2-4 */
        /* EXCLUDE separator rows */
        /* Extend slightly beyond edges to cover borders and prevent transparency */
        .pl-financial-table thead tr:first-child th:first-child::before,
        .pl-financial-table thead tr th.pl-ledger-header::before,
        .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;  /* Don't extend - let border show */
          bottom: 0;
          background-color: #fff;
          z-index: -1;
          pointer-events: none;
        }

        /* Extend sticky underlay slightly to cover bleed from scrolling cells */
        .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child::before {
          right: -3px;
        }

        /* ========================================
           RECTANGLE BORDERS - 6 BOXES (Ledger + 5 Periods)
           1px solid black borders, matching sales by customer/product tables
           ======================================== */

        /* TOP BORDERS - First header row across all boxes */
        .pl-financial-table thead tr:first-child th {
          border-top: 1px solid black !important;
        }

        /* BOTTOM BORDERS - Last body row across all boxes */
        .pl-financial-table tbody tr:last-child td {
          border-bottom: 1px solid black !important;
        }

        /* SEPARATOR ROW between headers and body - STICKY */
        .pl-financial-table .pl-separator-row {
          height: 8px !important;
          line-height: 8px !important;
          padding: 0 !important;
        }

        .pl-financial-table .pl-separator-row td {
          position: sticky !important;
          top: calc(var(--pl-hdr-h) * 4) !important; /* Position below 4 header rows */
          z-index: var(--z-hdr1) !important;
          height: 8px !important;
          padding: 0 !important;
          background-color: white !important;
          border-top: 1px solid black !important;
          border-bottom: 1px solid black !important;
          border-left: none !important; /* Remove all internal left borders */
          border-right: none !important; /* Remove all internal right borders */
          background-clip: padding-box !important;
        }

        .pl-financial-table .pl-separator-row td::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #fff;
          z-index: -1;
          pointer-events: none;
        }

        /* First cell of separator row - STICKY TOP + LEFT (corner) */
        /* IMPORTANT: Explicitly include top, bottom, and left borders so they stick with the cell */
        /* Left border is the outer edge of the rectangle */
        .pl-financial-table .pl-separator-row td:first-child {
          position: sticky !important;
          left: 0 !important;
          top: calc(var(--pl-hdr-h) * 4) !important;
          z-index: var(--z-corner) !important;
          background-color: white !important;
          border-top: 1px solid black !important; /* Explicit top border for sticky */
          border-bottom: 1px solid black !important; /* Explicit bottom border for sticky */
          border-left: 1px solid black !important; /* Outer edge of rectangle */
          border-right: none !important; /* No internal border */
          height: 8px !important;
          padding: 0 !important;
          margin: 0 !important;
          vertical-align: top !important;
        }

        /* SEPARATOR ROW: Remove all internal vertical borders - separator row should be one continuous rectangle */
        /* Only first cell has left border (outer edge), last cell has right border (outer edge) */
        /* Override any period border rules that might apply to separator rows - ensure no internal borders */
        .pl-financial-table .pl-separator-row td:nth-child(n+2):not(:last-child) {
          border-left: none !important;
          border-right: none !important;
        }

        /* Last cell of separator row - right border only (outer edge) */
        .pl-financial-table .pl-separator-row td:last-child {
          border-right: 1px solid black !important;
          border-left: none !important;
        }

        /* LEDGER COLUMN BORDERS (column 1, only in row 1 because of rowspan) */
        .pl-financial-table thead tr:first-child th.pl-ledger-header {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* BODY LEDGER COLUMN (column 1) */
        .pl-financial-table tbody tr td:nth-child(1) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* HEADER ROWS 1-3: Period cells with colspan=3 */
        /* These are nth-child(2), nth-child(3), nth-child(4), nth-child(5), nth-child(6) */
        /* Row 1-3: Period 1 (nth-child 2) */
        .pl-financial-table thead tr:nth-child(1) th:nth-child(2),
        .pl-financial-table thead tr:nth-child(2) th:nth-child(1),
        .pl-financial-table thead tr:nth-child(3) th:nth-child(1) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* Row 1-3: Period 2 (nth-child 3 in row 1, nth-child 2 in rows 2-3) */
        .pl-financial-table thead tr:nth-child(1) th:nth-child(3),
        .pl-financial-table thead tr:nth-child(2) th:nth-child(2),
        .pl-financial-table thead tr:nth-child(3) th:nth-child(2) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* Row 1-3: Period 3 (nth-child 4 in row 1, nth-child 3 in rows 2-3) */
        .pl-financial-table thead tr:nth-child(1) th:nth-child(4),
        .pl-financial-table thead tr:nth-child(2) th:nth-child(3),
        .pl-financial-table thead tr:nth-child(3) th:nth-child(3) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* Row 1-3: Period 4 (nth-child 5 in row 1, nth-child 4 in rows 2-3) */
        .pl-financial-table thead tr:nth-child(1) th:nth-child(5),
        .pl-financial-table thead tr:nth-child(2) th:nth-child(4),
        .pl-financial-table thead tr:nth-child(3) th:nth-child(4) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* Row 1-3: Period 5 (nth-child 6 in row 1, nth-child 5 in rows 2-3) */
        .pl-financial-table thead tr:nth-child(1) th:nth-child(6),
        .pl-financial-table thead tr:nth-child(2) th:nth-child(5),
        .pl-financial-table thead tr:nth-child(3) th:nth-child(5) {
          border-left: 1px solid black !important;
          border-right: 1px solid black !important;
        }

        /* HEADER ROW 4: Individual cells (Amount, %, per Kg) */
        /* Row 4 has no Ledger because of rowspan, so first cell is nth-child(1) */
        /* Period 1: columns 1, 2, 3 in row 4 */
        .pl-financial-table thead tr:nth-child(4) th:nth-child(1) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table thead tr:nth-child(4) th:nth-child(3) {
          border-right: 1px solid black !important;
        }

        /* Period 2: columns 4, 5, 6 in row 4 */
        .pl-financial-table thead tr:nth-child(4) th:nth-child(4) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table thead tr:nth-child(4) th:nth-child(6) {
          border-right: 1px solid black !important;
        }

        /* Period 3: columns 7, 8, 9 in row 4 */
        .pl-financial-table thead tr:nth-child(4) th:nth-child(7) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table thead tr:nth-child(4) th:nth-child(9) {
          border-right: 1px solid black !important;
        }

        /* Period 4: columns 10, 11, 12 in row 4 */
        .pl-financial-table thead tr:nth-child(4) th:nth-child(10) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table thead tr:nth-child(4) th:nth-child(12) {
          border-right: 1px solid black !important;
        }

        /* Period 5: columns 13, 14, 15 in row 4 */
        .pl-financial-table thead tr:nth-child(4) th:nth-child(13) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table thead tr:nth-child(4) th:nth-child(15) {
          border-right: 1px solid black !important;
        }

        /* BODY ROWS: Period columns */
        /* Period 1: columns 2, 3, 4 */
        .pl-financial-table tbody tr td:nth-child(2) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table tbody tr td:nth-child(4) {
          border-right: 1px solid black !important;
        }

        /* Period 2: columns 5, 6, 7 */
        .pl-financial-table tbody tr td:nth-child(5) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table tbody tr td:nth-child(7) {
          border-right: 1px solid black !important;
        }

        /* Period 3: columns 8, 9, 10 */
        .pl-financial-table tbody tr td:nth-child(8) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table tbody tr td:nth-child(10) {
          border-right: 1px solid black !important;
        }

        /* Period 4: columns 11, 12, 13 */
        .pl-financial-table tbody tr td:nth-child(11) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table tbody tr td:nth-child(13) {
          border-right: 1px solid black !important;
        }

        /* Period 5: columns 14, 15, 16 */
        .pl-financial-table tbody tr td:nth-child(14) {
          border-left: 1px solid black !important;
        }
        .pl-financial-table tbody tr td:nth-child(16) {
          border-right: 1px solid black !important;
        }

        /* Ledger header - STICKY TOP + LEFT (corner) */
        .pl-financial-table thead tr:first-child th.pl-ledger-header {
          position: sticky !important;
          left: 0 !important;
          top: 0 !important;
          z-index: var(--z-corner) !important;
          background-color: transparent;     /* inline color can show */
          text-align: center !important;
          vertical-align: middle !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 120px;
          max-width: 30ch;
          box-sizing: border-box;
        }

        .pl-financial-table thead tr:first-child th.pl-ledger-header::before {
          content: '';
          position: absolute;
          inset: 0;
          background: #fff;
          z-index: -1;
          pointer-events: none;
        }

        /* Ledger header specific styling - prevent vertical wrapping beyond 4 rows */
        .pl-ledger-header {
          font-family: Arial, sans-serif;
          font-size: 22px !important;
          font-weight: bold;
          text-align: center !important;
          vertical-align: middle !important;
          word-break: break-word;
          white-space: normal;
          line-height: 1.1;
          height: calc(var(--pl-hdr-h) * 4);
          max-height: calc(var(--pl-hdr-h) * 4);
          overflow: hidden;
          box-sizing: border-box;
          display: table-cell !important;
        }

        /* Headers are center aligned */
        .pl-financial-table th {
          text-align: center;
        }

        /* First column data cells left alignment */
        .pl-financial-table td:first-child {
          text-align: left;
          padding-left: 12px;
        }

        /* Header rows styling - maintain border structure */
        .pl-financial-table thead tr:nth-child(1) th,
        .pl-financial-table thead tr:nth-child(2) th,
        .pl-financial-table thead tr:nth-child(3) th {
          margin: 0;
          padding: 8px 12px;
          line-height: 1;
        }

        /* Ensure no spacing between header rows */
        .pl-financial-table thead tr:nth-child(1),
        .pl-financial-table thead tr:nth-child(2),
        .pl-financial-table thead tr:nth-child(3) {
          margin: 0;
          padding: 0;
          border-spacing: 0;
        }

        /* ========================================
           SPECIAL ROWS / LABELS
           ======================================== */

        .pl-table-main-label { font-size: 28px !important; }
        .pl-financial-table th.pl-empty-header { font-size: 28px !important; }

        .pl-financial-table .pl-important-row { font-weight: bold; }

        /* Row styling */
        .pl-product-header-row td:first-child {
          color: white;
          font-weight: bold;
        }

        .pl-category-header-row td:first-child {
          color: white;
          font-weight: bold;
        }

        .pl-total-header-row td:first-child {
          color: white;
          font-weight: bold;
        }

        /* ========================================
           RESPONSIVE BREAKPOINTS
           ======================================== */

        /* Desktop - Default (1200px+) */
        @media (min-width: 1200px) {
          .pl-financial-table {
            font-size: 12px;
            min-width: 100%;
          }

          /* Keep headers at 14px */
          .pl-financial-table thead th {
            font-size: 14px;
            padding: 4px 6px !important; /* Fixed padding for header height consistency */
          }

          /* Override font size for metric headers (Amount, % of Sales, per Kg) */
          .pl-financial-table thead tr:nth-child(4) th {
            font-size: 12px !important;
            font-family: Arial, sans-serif;
          }

          .pl-financial-table td {
            padding: 8px 12px;
          }
        }

        /* Tablet - Medium screens (768px - 1199px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          .pl-financial-table {
            font-size: 10px;
            min-width: 100%;
          }

          /* Keep headers at 12px for tablet */
          .pl-financial-table thead th {
            font-size: 12px;
          }

          /* Override font size for metric headers (Amount, % of Sales, per Kg) */
          .pl-financial-table thead tr:last-child th {
            font-size: 11px !important;
            font-family: Arial, sans-serif;
          }

          .pl-financial-table th,
          .pl-financial-table td {
            padding: 6px 8px;
          }

          /* Adjust column widths for tablet */
          .pl-financial-table colgroup:first-child col {
            width: 23% !important; /* Ledger column - increased by 10% from period columns */
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(1) {
            width: 12.6% !important; /* Amount column - reduced by 10% */
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(2) {
            width: 9% !important; /* % of Sales column - reduced by 10% */
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(3) {
            width: 8.1% !important; /* AED per Kg column - reduced by 10% */
          }
        }

        /* Responsive column widths for optimal layout */
        .pl-financial-table colgroup:first-child col {
          width: 25% !important; /* Ledger column - increased by 10% from period columns */
        }

        /* Amount columns - reduced by 10% */
        .pl-financial-table colgroup.period-column-group col:nth-child(1) {
          width: 11.7% !important; /* Amount column - reduced by 10% */
        }

        /* Percentage columns - reduced by 10% */
        .pl-financial-table colgroup.period-column-group col:nth-child(2) {
          width: 8.1% !important; /* % of Sales column - reduced by 10% */
        }

        /* Per Kg columns - reduced by 10% */
        .pl-financial-table colgroup.period-column-group col:nth-child(3) {
          width: 7.2% !important; /* AED per Kg column - reduced by 10% */
        }

        /* Mobile adjustments - Portrait */
        /* Applies to: Portrait mode (width < 768px) */
        @media (max-width: 767px) {
          /* Table responsive behavior */
          .pl-financial-table {
            font-size: 9px;
            min-width: 100%;
            width: 100%;
            table-layout: auto;
          }

          /* Optimize column widths for mobile */
          .pl-financial-table colgroup col {
            width: auto !important;
          }

          /* Container scrolling */
          .pl-table-view {
            padding: 8px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .pl-table-container,
          .full-screen-content .pl-table-container,
          .full-screen-content .pl-sales-customer-table-container,
          .full-screen-content .pl-sales-country-table-container,
          .full-screen-content .sales-rep-table-container,
          .full-screen-content .pl-sales-rep-table-container {
            max-height: calc(100vh - 120px) !important;
            overflow-x: auto !important;
            overflow-y: auto !important;  /* FIXED: Changed from visible to auto for mobile */
            -webkit-overflow-scrolling: touch !important;
          }

          /* Title sizing */
          .pl-table-title {
            font-size: 1.2rem;
          }

          .pl-table-subtitle {
            font-size: 0.9rem;
          }

          /* Keep headers readable - STICKY for mobile with hardware acceleration */
          .pl-financial-table thead th {
            font-size: 10px;
            padding: 4px 2px;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            position: sticky !important;
            top: 0;
            z-index: var(--z-hdr4) !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }

          /* Mobile - Four sticky header tiers with hardware acceleration */
          .pl-financial-table thead tr:nth-child(1) th {
            top: 0 !important;
            z-index: var(--z-hdr4) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(2) th {
            top: calc(var(--pl-hdr-h) * 1) !important;
            z-index: var(--z-hdr3) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(3) th {
            top: calc(var(--pl-hdr-h) * 2) !important;
            z-index: var(--z-hdr2) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(4) th {
            top: calc(var(--pl-hdr-h) * 3) !important;
            z-index: var(--z-hdr1) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }

          /* Override font size for metric headers */
          .pl-financial-table thead tr:last-child th {
            font-size: 10px !important;
            font-family: Arial, sans-serif;
          }

          .pl-financial-table th,
          .pl-financial-table td {
            padding: 3px 2px;
            white-space: nowrap;
            line-height: 1.2;
            text-overflow: ellipsis;
            overflow: hidden;
            max-width: none;
          }

          /* Mobile column optimization */
          .pl-financial-table colgroup:first-child col {
            width: auto !important;
            min-width: 80px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(1) {
            width: auto !important;
            min-width: 60px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(2) {
            width: auto !important;
            min-width: 45px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(3) {
            width: auto !important;
            min-width: 45px;
          }

          /* Ledger header readability */
          .pl-ledger-header {
            font-family: Arial, sans-serif;
            font-size: 22px !important;
            line-height: 1.0 !important;
            padding: 4px 2px !important;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }

          /* Mobile - Separator row STICKY TOP */
          .pl-financial-table .pl-separator-row td {
            position: sticky !important;
            top: calc(var(--pl-hdr-h) * 4) !important;
            z-index: var(--z-hdr1) !important;
            background-color: white !important;
            height: 8px !important;
            border-top: 1px solid black !important;
            border-bottom: 1px solid black !important;
            border-left: none !important;
            border-right: none !important;
          }

          /* Mobile - Separator first cell STICKY TOP + LEFT */
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

          /* White underlay for separator row to prevent content showing through */
          .pl-financial-table .pl-separator-row td::before {
            content: '';
            position: absolute;
            inset: 0;
            background: #fff;
            z-index: -1;
            pointer-events: none;
          }

          /* White underlay for first column to prevent content showing through */
          .pl-financial-table thead tr:first-child th.pl-ledger-header::before,
          .pl-financial-table tbody tr td:first-child::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0; /* Don't extend - let border show */
            bottom: 0;
            background-color: #fff;
            z-index: -1;
            pointer-events: none;
          }

          /* Mobile - Ledger header STICKY TOP + LEFT with hardware acceleration */
          .pl-financial-table thead tr th.pl-ledger-header,
          .pl-financial-table thead tr:first-child th:first-child {
            position: sticky !important;
            left: 0 !important;
            top: 0 !important;
            z-index: var(--z-corner) !important;
            min-width: 80px;
            background-color: transparent !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari double-sticky */
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }

          /* Mobile - body first column STICKY LEFT with hardware acceleration */
          .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child,
          .pl-financial-table tbody tr td.row-label {
            position: sticky !important;
            left: 0 !important;
            z-index: var(--z-firstcol) !important;
            min-width: 80px;
            background-color: transparent !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari */
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }

          /* Tighten ledger header on mobile */
          .pl-ledger-header {
            font-size: 13px !important;
            line-height: 1.05 !important;
          }
        }

        /* Mobile adjustments - Landscape (tablets/phones) */
        /* Applies to: Landscape mode on devices up to 1024px width */
        @media (max-width: 1024px) and (orientation: landscape) {
          /* Table responsive behavior */
          .pl-financial-table {
            font-size: 9px;
            min-width: 100%;
            width: 100%;
            table-layout: auto;
          }

          /* Optimize column widths for mobile */
          .pl-financial-table colgroup col {
            width: auto !important;
          }

          /* Container scrolling */
          .pl-table-view {
            padding: 8px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .pl-table-container,
          .full-screen-content .pl-table-container,
          .full-screen-content .pl-sales-customer-table-container,
          .full-screen-content .pl-sales-country-table-container,
          .full-screen-content .sales-rep-table-container,
          .full-screen-content .pl-sales-rep-table-container {
            max-height: calc(100vh - 100px) !important;
            overflow-x: auto !important;
            overflow-y: auto !important;  /* FIXED: Changed from visible to auto for mobile */
            -webkit-overflow-scrolling: touch !important;
          }

          /* Title sizing */
          .pl-table-title {
            font-size: 1.2rem;
          }

          .pl-table-subtitle {
            font-size: 0.9rem;
          }

          /* Keep headers readable - STICKY for mobile with hardware acceleration */
          .pl-financial-table thead th {
            font-size: 10px;
            padding: 4px 2px;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            position: sticky !important;
            top: 0;
            z-index: var(--z-hdr4) !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari */
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }

          /* Mobile - Four sticky header tiers with hardware acceleration */
          .pl-financial-table thead tr:nth-child(1) th {
            top: 0 !important;
            z-index: var(--z-hdr4) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(2) th {
            top: calc(var(--pl-hdr-h) * 1) !important;
            z-index: var(--z-hdr3) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(3) th {
            top: calc(var(--pl-hdr-h) * 2) !important;
            z-index: var(--z-hdr2) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
          .pl-financial-table thead tr:nth-child(4) th {
            top: calc(var(--pl-hdr-h) * 3) !important;
            z-index: var(--z-hdr1) !important;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }

          /* Override font size for metric headers */
          .pl-financial-table thead tr:last-child th {
            font-size: 10px !important;
            font-family: Arial, sans-serif;
          }

          .pl-financial-table th,
          .pl-financial-table td {
            padding: 3px 2px;
            white-space: nowrap;
            line-height: 1.2;
            text-overflow: ellipsis;
            overflow: hidden;
            max-width: none;
          }

          /* Mobile column optimization */
          .pl-financial-table colgroup:first-child col {
            width: auto !important;
            min-width: 80px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(1) {
            width: auto !important;
            min-width: 60px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(2) {
            width: auto !important;
            min-width: 45px;
          }

          .pl-financial-table colgroup.period-column-group col:nth-child(3) {
            width: auto !important;
            min-width: 45px;
          }

          /* Ledger header readability */
          .pl-ledger-header {
            font-family: Arial, sans-serif;
            font-size: 22px !important;
            line-height: 1.0 !important;
            padding: 4px 2px !important;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }

          /* Mobile - Separator row STICKY TOP */
          .pl-financial-table .pl-separator-row td {
            position: sticky !important;
            top: calc(var(--pl-hdr-h) * 4) !important;
            z-index: var(--z-hdr1) !important;
            background-color: white !important;
            height: 8px !important;
            border-top: 1px solid black !important;
            border-bottom: 1px solid black !important;
            border-left: none !important;
            border-right: none !important;
          }

          /* Mobile - Separator first cell STICKY TOP + LEFT */
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

          /* White underlay for separator row to prevent content showing through */
          .pl-financial-table .pl-separator-row td::before {
            content: '';
            position: absolute;
            inset: 0;
            background: #fff;
            z-index: -1;
            pointer-events: none;
          }

          /* White underlay for first column to prevent content showing through */
          .pl-financial-table thead tr:first-child th.pl-ledger-header::before,
          .pl-financial-table tbody tr td:first-child::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0; /* Don't extend - let border show */
            bottom: 0;
            background-color: #fff;
            z-index: -1;
            pointer-events: none;
          }

          /* Mobile - Ledger header STICKY TOP + LEFT with hardware acceleration */
          .pl-financial-table thead tr th.pl-ledger-header,
          .pl-financial-table thead tr:first-child th:first-child {
            position: sticky !important;
            left: 0 !important;
            top: 0 !important;
            z-index: var(--z-corner) !important;
            min-width: 80px;
            background-color: transparent !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari double-sticky */
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }

          /* Mobile - body first column STICKY LEFT with hardware acceleration */
          .pl-financial-table tbody tr:not(.pl-separator-row) td:first-child,
          .pl-financial-table tbody tr td.row-label {
            position: sticky !important;
            left: 0 !important;
            z-index: var(--z-firstcol) !important;
            min-width: 80px;
            background-color: transparent !important;
            background-clip: padding-box !important;
            
            /* CRITICAL for mobile Safari */
            -webkit-transform: translate3d(0, 0, 0);
            transform: translate3d(0, 0, 0);
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }

          /* Tighten ledger header on mobile landscape */
          .pl-ledger-header {
            font-size: 13px !important;
            line-height: 1.05 !important;
          }
        }

        /* Sales by Customer Table export container */
        .pl-sales-customer-table-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
        }

        /* Combined Trends (Expenses + Profitability) - SINGLE SOURCE OF TRUTH (matches CombinedTrends.css) */
        /* Main container for Expenses Trend */
        .expenses-trend-container {
            margin-top: 60px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            padding: 20px;
            width: 95%;
            margin-left: auto;
            margin-right: auto;
            box-sizing: border-box;
        }

        /* Main container for Profit Trend */
        .profit-trend-container {
            margin-top: 30px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            padding: 20px;
            width: 95%;
            margin-left: auto;
            margin-right: auto;
            box-sizing: border-box;
        }

        /* Combined container for export (holds both) */
        .combined-trends-container {
            margin-top: 30px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            padding: 20px;
            width: 95%;
            margin-left: auto;
            margin-right: auto;
            box-sizing: border-box;
            min-height: 800px;
            overflow: visible;
        }

        /* Period Legend for export */
        .trend-legend {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }

        .trend-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
        }

        .trend-legend-color {
            width: 20px;
            height: 20px;
            min-width: 20px;
            max-width: 20px;
            border-radius: 4px;
            flex-shrink: 0;
        }

        .trend-legend-text {
            font-size: 14px;
            font-weight: 500;
            color: #333;
            white-space: nowrap;
        }

        /* Section Heading - EXACT from live */
        .trend-heading {
            text-align: center;
            font-size: 18px;
            margin-bottom: 20px;
            color: #333;
            font-weight: 600;
        }

        /* KPI Section wrapper */
        .trend-kpi-section {
            margin-bottom: 30px;
        }

        /* Cards Row Container - EXACT from live */
        .trend-cards-row {
            display: flex;
            flex-wrap: nowrap;
            justify-content: space-around;
            align-items: center;
            gap: 5px;
            margin-top: 20px;
            margin-bottom: 0;
            width: 100%;
            padding: 0 24px;
            box-sizing: border-box;
        }

        /* Profit section uses margin-top: 10px */
        .trend-cards-row.profit-row {
            margin-top: 10px;
        }

        /* Individual Trend Card - EXACT from live */
        .trend-card {
            padding: 12px 15px;
            border-radius: 6px;
            border: 1px solid;
            box-shadow: 0 2px 6px rgba(0,0,0,0.07);
            min-width: 150px;
            max-width: 180px;
            flex: 1;
            text-align: center;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .trend-card:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        /* Card title - period name - EXACT from live */
        .trend-card-title {
            font-size: 14px;
            font-weight: 500;
            margin-top: 4px;
        }

        /* Card main value - EXACT from live */
        .trend-card-value {
            font-weight: bold;
            font-size: 22px;
            margin-top: 8px;
        }

        /* Card metrics row - EXACT from live */
        .trend-card-metrics {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
            margin-top: 8px;
            width: 100%;
        }

        /* Variance Connector - EXACT from live */
        .trend-connector {
            align-self: center;
            margin: 0 2px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 40px;
            width: 40px;
            height: 60px;
            justify-content: center;
        }

        /* Variance arrow - EXACT from live */
        .trend-variance-arrow {
            font-size: 16px;
            font-weight: bold;
            line-height: 1;
        }

        /* Variance value - EXACT from live */
        .trend-variance-value {
            font-size: 14px;
            font-weight: bold;
            line-height: 1.1;
        }

        /* Variance percent - EXACT from live */
        .trend-variance-percent {
            font-size: 12px;
            font-weight: bold;
            line-height: 1.1;
        }

        /* N/A text for null variance */
        .trend-variance-na {
            color: #888;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
        }

        /* Variance colors */
        .trend-variance-positive {
            color: #2E865F;
        }

        .trend-variance-negative {
            color: #cf1322;
        }

        .trend-variance-neutral {
            color: #888;
        }

        /* Invisible spacer after last card - EXACT from live */
        .trend-spacer {
            flex: 0 0 40px;
        }

        @media (max-width: 768px) and (orientation: portrait) {
            .trend-cards-row {
                flex-wrap: nowrap;
                justify-content: flex-start;
                overflow-x: auto;
                overflow-y: hidden;
                -webkit-overflow-scrolling: touch;
                padding: 0 16px 16px 16px;
                gap: 12px;
            }

            .trend-card {
                flex: 0 0 220px;
                min-width: 220px;
                max-width: 220px;
            }

            .trend-connector {
                flex: 0 0 56px;
                min-width: 56px;
                max-width: 56px;
            }

            .trend-legend {
                flex-direction: column;
                gap: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <div class="logo-container">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Company Logo" class="logo">` : ''}
            </div>
            <h1 class="division-title">${divisionName} - Comprehensive Report</h1>
            <div class="period-info">${periodDisplayText}</div>
        </div>
    </div>
    
    <!-- Back to Dashboard Button -->
    <button id="back-to-dashboard-btn" class="overlay-close-btn" onclick="hideAllCharts()" style="display: none;">
        ← Back
    </button>
    
    <div class="container">
        <!-- Row 1: Divisional KPIs (alone) -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 25px; margin-bottom: 30px; justify-items: center;">
            <div class="chart-card" onclick="showChart('divisional-kpis')" style="max-width: 400px; width: 100%;">
                <span class="card-icon">📈</span>
                <div class="card-title">Divisional KPIs</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Key performance indicators and metrics overview
                </div>
            </div>
        </div>

        <!-- Row 2: Chart Cards -->
        <div class="charts-grid">
            <!-- Sales & Volume Analysis Card -->
            <div class="chart-card" onclick="showChart('sales-volume')">
                <span class="card-icon">📊</span>
                <div class="card-title">Sales & Volume Analysis</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Visual analysis of sales revenue and volume trends across different time periods
                </div>
            </div>

            <!-- Margin Analysis Card -->
            <div class="chart-card" onclick="showChart('margin-analysis')">
                <span class="card-icon">📋</span>
                <div class="card-title">Margin Analysis</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Detailed breakdown of profit margins over material costs with trend analysis
                </div>
            </div>

            <!-- Manufacturing Cost Card -->
            <div class="chart-card" onclick="showChart('manufacturing-cost')">
                <span class="card-icon">🏭</span>
                <div class="card-title">Manufacturing Cost</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Analysis of direct manufacturing costs including materials, labor, and production expenses
                </div>
            </div>

            <!-- Below GP Expenses Card -->
            <div class="chart-card" onclick="showChart('below-gp-expenses')">
                <span class="card-icon">📊</span>
                <div class="card-title">Below GP Expenses</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Operating expenses below gross profit including administrative and selling costs
                </div>
            </div>

            <!-- Combined Trends Card -->
            <div class="chart-card" onclick="showChart('combined-trends')">
                <span class="card-icon">📈</span>
                <div class="card-title">Cost & Profitability Trend</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Historical trends showing cost evolution and profitability patterns over time
                </div>
            </div>
        </div>

        <!-- Row 3: Table Cards -->
        <div class="charts-grid" style="margin-top: 30px; margin-bottom: 60px;">
            <div class="chart-card" onclick="showChart('pl-financial')">
                <span class="card-icon">💰</span>
                <div class="card-title">Profit and Loss Statement</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Complete Profit & Loss statement with detailed financial performance breakdown
                </div>
            </div>
            <div class="chart-card" onclick="showChart('product-group')">
                <span class="card-icon">📊</span>
                <div class="card-title">Product Groups</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Performance analysis by product categories including sales, margins, and growth metrics
                </div>
            </div>
            <div class="chart-card" onclick="showChart('sales-rep')">
                <span class="card-icon">🧑‍💼</span>
                <div class="card-title">Sales by Sales Reps</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Sales representative performance analysis and individual contribution breakdown
                </div>
            </div>
            <div class="chart-card" onclick="showChart('sales-customer')">
                <span class="card-icon">👥</span>
                <div class="card-title">Sales by Customers</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Top customer analysis showing sales performance and contribution by key accounts
                </div>
            </div>
            <div class="chart-card" onclick="showChart('sales-country')">
                <span class="card-icon">🌍</span>
                <div class="card-title">Sales by Countries</div>
                <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 8px; line-height: 1.4;">
                    Geographic distribution of sales performance across different countries and regions
                </div>
            </div>
        </div>
    </div>
    
    <!-- Full-screen chart views with EXACT same charts as main Charts page -->
    <!-- Divisional KPIs Chart -->
    <div class="full-screen-chart" id="full-screen-divisional-kpis">
        <div class="full-screen-content" id="full-divisional-kpis-chart">
            <!-- Captured overlay with banner will be rendered here -->
        </div>
    </div>
    
    <!-- Profit and Loss Statement Chart -->
    <div class="full-screen-chart" id="full-screen-pl-financial">
        <div class="full-screen-content" id="full-pl-financial-chart">
            <!-- Captured overlay with banner will be rendered here -->
        </div>
    </div>
    
        <!-- Product Groups Chart -->
        <div class="full-screen-chart" id="full-screen-product-group">
            <div class="full-screen-content" id="full-product-group-chart">
                <!-- Captured overlay with banner will be rendered here -->
            </div>
        </div>

        <!-- Sales by Customers Chart -->
        <div class="full-screen-chart" id="full-screen-sales-customer">
            <div class="full-screen-content" id="full-sales-customer-chart">
                <!-- Captured overlay with banner will be rendered here -->
            </div>
        </div>

        <!-- Sales by Sales Reps Chart -->
        <div class="full-screen-chart" id="full-screen-sales-rep">
            <div class="full-screen-content" id="full-sales-rep-chart">
                <!-- Captured overlay with banner will be rendered here -->
            </div>
        </div>

    <!-- Sales by Countries Chart -->
        <div class="full-screen-chart" id="full-screen-sales-country">
            <div class="full-screen-content" id="full-sales-country-chart">
                <!-- Captured overlay with banner will be rendered here -->
            </div>
        </div>
    
    <!-- Sales & Volume Analysis Chart -->
    <div class="full-screen-chart" id="full-screen-sales-volume">
         <div class="full-screen-content" id="full-sales-volume-chart">
             <!-- Captured overlay with banner will be rendered here -->
         </div>
    </div>
    
    <div class="full-screen-chart" id="full-screen-margin-analysis">
        <div class="full-screen-content">
            <div class="modern-margin-gauge-panel">
                <div class="full-screen-chart-container" id="full-margin-analysis-chart"></div>
            </div>
        </div>
    </div>
    
     <div class="full-screen-chart" id="full-screen-manufacturing-cost">
         <div class="full-screen-content">
             <div class="modern-margin-gauge-panel">
                 <div class="full-screen-chart-container" id="full-manufacturing-cost-chart"></div>
                 <div id="manufacturing-cost-totals"></div>
             </div>
         </div>
     </div>
    
    <div class="full-screen-chart" id="full-screen-below-gp-expenses">
        <div class="full-screen-content">
            <div class="modern-margin-gauge-panel">
                <div class="full-screen-chart-container" id="full-below-gp-expenses-chart"></div>
                <div id="below-gp-expenses-totals" style="display: flex; flex-wrap: wrap; justify-content: space-around; align-items: flex-end; gap: 5px; margin-top: 20px; width: 100%;"></div>
            </div>
        </div>
    </div>
    
    <div class="full-screen-chart" id="full-screen-combined-trends">
        <div class="full-screen-content">
                <div class="full-screen-chart-container" id="full-expenses-chart"></div>
        </div>
    </div>

     <script>
         // ============================================
         // CRITICAL: Define card click handlers FIRST
         // This ensures they're available immediately
         // ============================================
         console.log('🚀 Script execution started - defining click handlers');
         
         // Add global error handler to catch any JavaScript errors
         window.addEventListener('error', function(event) {
             console.error('🔴 JavaScript Error:', event.message, 'at', event.filename, 'line', event.lineno);
         });
         
         var savedScrollPosition = 0;

         function showChart(chartType) {
             console.log('🎯 showChart() called with type:', chartType);
             console.log('Showing chart:', chartType);
             
             // Save current scroll position before hiding the grid
             savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
             console.log('Saved scroll position:', savedScrollPosition);
             
             // Show the Back to Dashboard button
             var backBtn = document.getElementById('back-to-dashboard-btn');
             if (backBtn) {
                 backBtn.style.display = 'flex';
             }
             
             // Hide the card grid (Row 2 and Row 3)
             var chartsGrid = document.querySelector('.charts-grid');
             if (chartsGrid) {
                 chartsGrid.classList.add('hidden');
             }
             
             // Hide the Divisional KPIs card container (Row 1) - it's the first direct child of .container
             var container = document.querySelector('.container');
             if (container) {
                 var firstChild = container.firstElementChild;
                 if (firstChild && firstChild.querySelector('.chart-card')) {
                     firstChild.classList.add('hidden');
                 }
                 
                 // Hide all other card containers (any div that contains .chart-card)
                 var allContainers = container.querySelectorAll('div');
                 allContainers.forEach(function(div) {
                     if (div.querySelector('.chart-card') && div !== container) {
                         div.classList.add('hidden');
                     }
                 });
             }
             
             // Hide all full-screen charts first
             var allFullScreenCharts = document.querySelectorAll('.full-screen-chart');
             allFullScreenCharts.forEach(function(chart) {
                 chart.classList.remove('active');
             });
             
             // Show the specific chart
             var targetChart = document.getElementById('full-screen-' + chartType);
             if (targetChart) {
                 targetChart.classList.add('active');
                 console.log('Chart displayed:', chartType);
                 
                 // Initialize the chart based on type with a small delay to ensure visibility
                 setTimeout(function() {
                     if (chartType === 'divisional-kpis') {
                         if (typeof renderDivisionalKPIs === 'function') {
                             renderDivisionalKPIs();
                         }
                     } else if (chartType === 'pl-financial') {
                         if (typeof renderPLFinancial === 'function') {
                             renderPLFinancial();
                         }
                     } else if (chartType === 'product-group') {
                         if (typeof renderProductGroup === 'function') {
                             renderProductGroup();
                         }
                     } else if (chartType === 'sales-rep') {
                         if (typeof renderSalesRep === 'function') {
                             renderSalesRep();
                         }
                     } else if (chartType === 'sales-customer') {
                         if (typeof renderSalesCustomer === 'function') {
                             renderSalesCustomer();
                         }
                     } else if (chartType === 'sales-country') {
                         if (typeof renderSalesCountry === 'function') {
                             renderSalesCountry();
                         }
                     } else if (chartType === 'sales-volume') {
                         if (typeof renderSalesVolume === 'function') {
                             renderSalesVolume();
                         }
                     } else if (chartType === 'margin-analysis') {
                         if (typeof renderMarginAnalysis === 'function') {
                             renderMarginAnalysis();
                         }
                     } else if (chartType === 'manufacturing-cost') {
                         if (typeof renderManufacturingCost === 'function') {
                             renderManufacturingCost();
                         }
                     } else if (chartType === 'below-gp-expenses') {
                         if (typeof renderBelowGPExpenses === 'function') {
                             renderBelowGPExpenses();
                         }
                     } else if (chartType === 'combined-trends') {
                         if (typeof renderCombinedTrends === 'function') {
                             renderCombinedTrends();
                         }
                     }
                 }, 100); // Small delay to ensure chart is visible
             } else {
                 console.error('Chart not found:', 'full-screen-' + chartType);
             }
         }

         function hideAllCharts() {
             console.log('Returning to card grid');
             
             // Hide the Back to Dashboard button
             var backBtn = document.getElementById('back-to-dashboard-btn');
             if (backBtn) {
                 backBtn.style.display = 'none';
             }
             
             // Remove any dynamically created back buttons
             var kpiBackBtn = document.getElementById('kpi-back-btn');
             if (kpiBackBtn) {
                 kpiBackBtn.remove();
             }
             
             // Hide all full-screen charts
             var allFullScreenCharts = document.querySelectorAll('.full-screen-chart');
             allFullScreenCharts.forEach(function(chart) {
                 chart.classList.remove('active');
             });
             
             // Show the card grid (Row 2 and Row 3)
             var chartsGrid = document.querySelector('.charts-grid');
             if (chartsGrid) {
                 chartsGrid.classList.remove('hidden');
             }
             
             // Show all card containers
             var container = document.querySelector('.container');
             if (container) {
                 // Show the Divisional KPIs card container (Row 1)
                 var firstChild = container.firstElementChild;
                 if (firstChild && firstChild.querySelector('.chart-card')) {
                     firstChild.classList.remove('hidden');
                 }
                 
                 // Show all other card containers
                 var allContainers = container.querySelectorAll('div');
                 allContainers.forEach(function(div) {
                     if (div.querySelector('.chart-card') && div !== container) {
                         div.classList.remove('hidden');
                     }
                 });
             }
             
             // Restore scroll position after a brief delay to ensure grid is visible
             setTimeout(function() {
                 window.scrollTo({
                     top: savedScrollPosition,
                     behavior: 'smooth'
                 });
                 console.log('Restored scroll position:', savedScrollPosition);
             }, 50);
         }

         // Expose global handlers IMMEDIATELY so inline onclick attributes can call them
         window.showChart = showChart;
         window.hideAllCharts = hideAllCharts;
         console.log('✅ Card click handlers initialized and exposed to window object');
         console.log('✅ Verifying: window.showChart =', typeof window.showChart);
         console.log('✅ Verifying: window.hideAllCharts =', typeof window.hideAllCharts);

         // Global variables - EXACT same as BarChart
         var periodLabels = ${JSON.stringify(periodLabels)};
         var seriesData = ${JSON.stringify(seriesData)};
         var salesVolumeData = ${JSON.stringify(salesVolumeData)};
         var percentVariance = ${JSON.stringify(percentVariance)};
         var barColors = ${JSON.stringify(barColors)};
         var basePeriodKey = '${basePeriodKey}';
        var visiblePeriods = ${JSON.stringify(visiblePeriods)};
        var chartData = ${JSON.stringify(chartData)};
        var capturedActualData = ${JSON.stringify(capturedActualData)};
        var kpiSummaryHTML = ${JSON.stringify(kpiSummaryHTML)};
        var plFinancialTableHTML = ${JSON.stringify(plFinancialTableHTML)};
        var productGroupTableHTML = ${JSON.stringify(productGroupTableHTML)};
        var salesCustomerTableHTML = ${JSON.stringify(salesCustomerTableHTML)};
        var salesRepTableHTML = ${JSON.stringify(salesRepTableHTML)};
        var salesCountryTableHTML = ${JSON.stringify(salesCountryTableHTML)};
        var salesVolumeHTML = ${JSON.stringify(salesVolumeHTML)};
        var marginAnalysisHTML = ${JSON.stringify(marginAnalysisHTML)};
        var manufacturingCostHTML = ${JSON.stringify(manufacturingCostHTML)};
        var belowGPExpensesHTML = ${JSON.stringify(belowGPExpensesHTML)};
        var combinedTrendsHTML = ${JSON.stringify(combinedTrendsHTML)};

        // Helper function to get division display name
        function getDivisionDisplayName() {
            const divisionNames = {
                'FP-Product Group': 'Flexible Packaging',
                'SB-Product Group': 'Shopping Bags',
                'TF-Product Group': 'Thermoforming Products',
                'HCM-Product Group': 'Harwal Container Manufacturing'
            };
            // Try to get from the page title or use a default
            const title = document.title || '';
            if (title.includes('Flexible Packaging')) return 'Flexible Packaging';
            if (title.includes('Shopping Bags')) return 'Shopping Bags';
            if (title.includes('Thermoforming')) return 'Thermoforming Products';
            if (title.includes('Harwal')) return 'Harwal Container Manufacturing';
            return 'Division';
        }
        var charts = {};

         // Helper functions
         function getUAEDirhamSymbolHTML() {
             return '<svg class="uae-dirham-symbol" viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style="display: inline-block; vertical-align: -0.1em; width: 1em; height: 1em; margin-right: 0.2em;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>';
         }
         // Convert UAE SVG to data URL for rich text image in ECharts labels
         function getUAESymbolImageDataURL(color) {
             color = color || '#222';
             var svg = getUAEDirhamSymbolHTML().replace('currentColor', color);
             return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
         }
         
         function createPeriodKey(period) {
             if (period.isCustomRange) {
                 return period.year + '-' + period.month + '-' + period.type;
             } else {
                 return period.year + '-' + (period.month || 'Year') + '-' + period.type;
             }
         }

         function sanitizeNumeric(value) {
             if (typeof value === 'number') return value;
             if (typeof value === 'string') {
                 return parseFloat(value.replace(/[, \u00EA]/g, '')) || 0;
             }
             return 0;
         }

   function resolveStackedBarColor(period, index, defaultColors, colorSchemes) {
       if (period && period.customColor) {
           var scheme = colorSchemes.find(function(s) { return s.name === period.customColor; });
           if (scheme && scheme.primary) {
               return scheme.primary;
           }
       }

       if (period) {
           if (period.month === 'Q1' || period.month === 'Q2' || period.month === 'Q3' || period.month === 'Q4') {
               return '#FF6B35';
           }
           if (period.month === 'January') {
               return '#FFD700';
           }
           if (period.month === 'Year') {
               return '#288cfa';
           }
           if (period.type === 'Budget') {
               return '#2E865F';
           }
       }

       if (defaultColors && defaultColors.length > 0) {
           return defaultColors[index % defaultColors.length];
       }

       return '#288cfa';
   }

    // Unified responsive breakpoint helper (desktop defaults preserve original layout)
    function getResponsiveFlags() {
        var width = typeof window !== 'undefined' ? window.innerWidth || document.documentElement.clientWidth || 0 : 0;
        var flags = {
            width: width,
            isSmallMobile: width > 0 && width <= 480,
            isMobile: width > 0 && width <= 768,
            isTablet: width > 768 && width <= 992,
            isDesktop: width === 0 ? true : width > 992
        };

        if (typeof window !== 'undefined' && !window.__responsiveBaselineLogged) {
            // Log once to confirm desktop layout remains the baseline expectation
            console.log('🧭 Responsive baseline check', {
                width: flags.width,
                desktopDefaultColumns: flags.isDesktop ? 5 : 'responsive',
                isDesktop: flags.isDesktop
            });
            window.__responsiveBaselineLogged = true;
        }

        return flags;
    }

        // Compute cell value function - EXACT same as original, but using ACTUAL captured data
        function computeCellValue(rowIndex, column) {
            // Create period key to match chartData structure using unified helper
            var periodKey = createPeriodKey(column);

            var periodData = chartData[periodKey];
            var actualData = capturedActualData[periodKey];
            if (!periodData || !actualData) return 0;
            
            // Return data based on row index - EXACT same figures as original charts
            switch(rowIndex) {
                case 3: return periodData.sales || 0;
                case 5: return periodData.materialCost || 0;
                case 7: return periodData.salesVolume || 0;
                case 8: return periodData.productionVolume || 0;
                // Manufacturing Cost - EXACT same figures as original charts
                case 9: return actualData.labour || 0; // Labour - actual figure from original chart
                case 10: return actualData.depreciation || 0; // Depreciation - actual figure from original chart
                case 12: return actualData.electricity || 0; // Electricity - actual figure from original chart
                case 13: return actualData.othersMfgOverheads || 0; // Others Mfg. Overheads - actual figure from original chart
                case 14: return actualData.totalDirectCost || 0; // Total Direct Cost - actual figure from original chart
                // Below GP Expenses - EXACT same figures as original charts
                case 31: return actualData.sellingExpenses || 0; // Selling expenses - actual figure from original chart
                case 32: return actualData.transportation || 0; // Transportation - actual figure from original chart
                case 40: return actualData.administration || 0; // Administration - actual figure from original chart
                case 42: return actualData.bankInterest || 0; // Bank interest - actual figure from original chart
                case 52: return actualData.totalBelowGPExpenses || 0; // Total Below GP Expenses - actual figure from original chart
                // Combined Trends - EXACT same figures as original charts
                case 54: return actualData.netProfit || 0; // Net Profit - actual figure from original chart
                case 56: return actualData.ebitda || 0; // EBITDA - actual figure from original chart
                default: return 0;
            }
        }

        // ⚠️ NON-DESTRUCTIVE CHART INITIALIZATION HELPER
        // Returns false if charts unavailable, preventing echarts.init() calls
        // Shows friendly fallback UI per chart instead of blank/error
        function initializeChartContainer(containerId, titleText) {
            var el = document.getElementById(containerId);
            if (!el) {
                console.warn('Chart container not found:', containerId);
                return false;
            }

            if (!window.echarts || window.__chartsUnavailable) {
                console.warn('ECharts unavailable for:', titleText);
                el.innerHTML =
                    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;padding:24px;background:#fff3cd;border:2px dashed #ffc107;border-radius:8px;">' +
                        '<div style="font-size:42px;margin-bottom:12px;">📊</div>' +
                        '<div style="font-size:16px;font-weight:700;color:#856404;margin-bottom:6px;">Chart Unavailable</div>' +
                        '<div style="font-size:13px;color:#555;text-align:center;">' + titleText + ' could not be rendered.<br/>Your KPI and tables are still included below.</div>' +
                    '</div>';
                return false;
            }

            return true;
        }

        function updateResponsiveStackedChartContainer(chartType) {
            if (chartType !== 'manufacturing-cost' && chartType !== 'below-gp-expenses') {
                return;
            }

            var chartDom = document.getElementById('full-' + chartType + '-chart');
            var chartWrapper = chartDom ? chartDom.closest('.modern-margin-gauge-panel') : null;
            var container = chartDom ? chartDom.parentElement : null;
            if (!chartDom) {
                return;
            }

            var width = window.innerWidth;
            var height = window.innerHeight;
            var isMobile = width <= 768;
            var isPortrait = height > width;
            var isTablet = width > 768 && width <= 1100;
            var isLandscape = width >= height;

            if (isMobile && isPortrait) {
                var periodsCount = Math.min(visiblePeriods.length, 5);
                var columnWidth = width <= 480 ? 160 : 180;
                var totalWidth = columnWidth * periodsCount + 40;

                if (chartWrapper) {
                    chartWrapper.style.display = 'block';
                    chartWrapper.style.overflowX = 'auto';
                    chartWrapper.style.overflowY = 'visible';
                    chartWrapper.style.webkitOverflowScrolling = 'touch';
                }
                if (container) {
                    container.style.display = 'inline-block';
                    container.style.verticalAlign = 'top';
                }

                chartDom.style.width = totalWidth + 'px';
                chartDom.style.minWidth = totalWidth + 'px';
                chartDom.style.height = '70vh';
                chartDom.style.minHeight = '';
                chartDom.style.display = 'block';
                chartDom.style.margin = '0';
                console.log('📱 ' + chartType + ': Set container width to', totalWidth + 'px for', periodsCount, 'periods');
            } else if (isTablet && isLandscape) {
                var ledgerCounts = {
                    'manufacturing-cost': 4,
                    'below-gp-expenses': 4
                };
                var ledgerCount = ledgerCounts[chartType] || 4;
                var baseRowHeight = chartType === 'manufacturing-cost' ? 130 : 120;
                var dynamicHeight = Math.max(ledgerCount * baseRowHeight, 540);
                var scrollWidth = Math.max(Math.round(width * 1.4), 1280);

                if (chartWrapper) {
                    chartWrapper.style.display = 'block';
                    chartWrapper.style.overflowX = 'auto';
                    chartWrapper.style.overflowY = 'visible';
                    chartWrapper.style.webkitOverflowScrolling = 'touch';
                }
                if (container) {
                    container.style.display = 'inline-block';
                    container.style.verticalAlign = 'top';
                }

                chartDom.style.width = scrollWidth + 'px';
                chartDom.style.minWidth = scrollWidth + 'px';
                chartDom.style.height = dynamicHeight + 'px';
                chartDom.style.minHeight = dynamicHeight + 'px';
                chartDom.style.display = 'block';
                chartDom.style.margin = '0';
                console.log('📱 ' + chartType + ': Tablet landscape scroll width', scrollWidth + 'px', 'height', dynamicHeight + 'px');
            } else {
                if (chartWrapper) {
                    chartWrapper.style.display = '';
                    chartWrapper.style.overflowX = '';
                    chartWrapper.style.overflowY = '';
                    chartWrapper.style.webkitOverflowScrolling = '';
                }
                if (container) {
                    container.style.display = '';
                    container.style.verticalAlign = '';
                }

                chartDom.style.width = '100%';
                chartDom.style.minWidth = '';
                chartDom.style.height = 'auto';
                chartDom.style.minHeight = '60vh';
                chartDom.style.display = '';
                chartDom.style.margin = '';
            }

            if (chartType === 'manufacturing-cost') {
                renderManufacturingCostTotals();
            } else if (chartType === 'below-gp-expenses') {
                renderBelowGPExpensesTotals();
            }
        }

        // NOTE: showChart and hideAllCharts functions are now defined at the top of this script
        // to ensure they're available immediately when the page loads

         // Initialize full-screen chart with EXACT same logic as original charts
         function initializeFullScreenChart(chartType) {
             var chartDom = document.getElementById('full-' + chartType + '-chart');
             if (!chartDom) {
                 console.log('Chart DOM not found for:', 'full-' + chartType + '-chart');
                 return;
             }

             // Guard: Check if ECharts is available before proceeding
             var chartTitles = {
                 'sales-volume': 'Sales & Volume Analysis',
                 'margin-analysis': 'Margin Analysis',
                 'manufacturing-cost': 'Manufacturing Cost',
                 'below-gp-expenses': 'Below GP Expenses',
                 'combined-trends': 'Cost & Profitability Trend'
             };

             // Special handling for margin-analysis - uses captured static overlay, no initialization needed
             if (chartType === 'margin-analysis') {
                 console.log('🎯 Margin Analysis uses captured overlay - skipping initialization');
                 return;
             }

             // CRITICAL FIX: Dispose existing chart instance before re-initializing
             // This ensures proper cleanup and prevents multiple instances fighting for the same DOM
             if (charts[chartType] && !charts[chartType].isDisposed()) {
                 console.log('🔄 Disposing existing ' + chartType + ' chart before re-initialization');
                 charts[chartType].dispose();
                 charts[chartType] = null;
             }

             if (chartType === 'manufacturing-cost') {
                 // Manufacturing Cost - chartDom should already be set to #full-manufacturing-cost-chart from line 5118
                 // Now we need to create the actual ECharts div inside it
                 if (chartDom && chartDom.id === 'full-manufacturing-cost-chart') {
                     // Clear it and create the ECharts div inside
                     chartDom.innerHTML = '';
                     var echartDiv = document.createElement('div');
                     echartDiv.id = 'manufacturing-cost-echart';
                     echartDiv.style.cssText = 'width: 100%; height: 600px;';
                     chartDom.appendChild(echartDiv);
                     
                     // IMPORTANT: Re-query the chart div after DOM modification - this is what ECharts will use
                     chartDom = document.getElementById('manufacturing-cost-echart');
                     console.log('Manufacturing Cost: Created echart div, ID:', chartDom ? chartDom.id : 'NOT FOUND');
                 } else {
                     // Fallback: try to find or create the structure
                     var mainContainer = document.getElementById('full-manufacturing-cost-chart');
                     if (mainContainer) {
                         mainContainer.innerHTML = '';
                         var echartDiv = document.createElement('div');
                         echartDiv.id = 'manufacturing-cost-echart';
                         echartDiv.style.cssText = 'width: 100%; height: 600px;';
                         mainContainer.appendChild(echartDiv);
                         chartDom = echartDiv;
                         console.log('Manufacturing Cost: Created echart div in fallback (main container found)');
                     } else {
                         // Last resort: create in any available container
                         var overlayContainer = document.querySelector('#full-screen-manufacturing-cost .manufacturing-cost-detail__chart-wrapper') ||
                                               document.querySelector('#full-screen-manufacturing-cost .modern-margin-gauge-panel') ||
                                               document.querySelector('#full-screen-manufacturing-cost .full-screen-content');
                         if (overlayContainer) {
                             var echartDiv = document.createElement('div');
                             echartDiv.id = 'manufacturing-cost-echart';
                             echartDiv.style.cssText = 'width: 100%; height: 600px;';
                             overlayContainer.appendChild(echartDiv);
                             chartDom = echartDiv;
                             console.log('Manufacturing Cost: Created echart div in last resort container');
                         }
                     }
                 }
                 if (!chartDom) {
                     console.error('Could not create manufacturing cost chart container');
                     return;
                 }
                 console.log('Manufacturing Cost: Final chartDom ID:', chartDom.id);
             } else if (chartType === 'below-gp-expenses') {
                 // Below GP Expenses uses captured overlay - find chart wrapper inside  
                 var bgOverlayContainer = document.querySelector('#full-screen-below-gp-expenses .below-gp-expenses-detail__chart-wrapper');
                 if (bgOverlayContainer) {
                     // Save the totals elements before modifying
                     var bgTotalsElements = [];
                     var bgTotalsContainers = bgOverlayContainer.querySelectorAll('.totals-scroll-container');
                     bgTotalsContainers.forEach(function(el) {
                         bgTotalsElements.push(el);
                     });
                     
                     // Clear and create chart container
                     bgOverlayContainer.innerHTML = '<div id="below-gp-expenses-echart" style="width: 100%; height: 483px;"></div>';
                     
                     // Re-append saved totals elements
                     bgTotalsElements.forEach(function(el) {
                         bgOverlayContainer.appendChild(el);
                     });
                     
                     // IMPORTANT: Re-query the chart div after DOM modification
                     chartDom = document.getElementById('below-gp-expenses-echart');
                 }
                 if (!chartDom) {
                     console.error('Could not create below GP expenses chart container');
                     return;
                 }
             }

             if (!initializeChartContainer('full-' + chartType + '-chart', chartTitles[chartType] || chartType)) {
                 console.error('ECharts not available for ' + chartType);
                 return; // ECharts unavailable
             }

             // Check if font is already loaded to avoid unnecessary delay
             var fontLoadDelay = 0;
             if (document.fonts && document.fonts.check('1em UAESymbol')) {
                 fontLoadDelay = 0; // Font already loaded, no delay needed
                 console.log('✅ UAESymbol font already loaded');
             } else {
                 fontLoadDelay = 500; // Reduced delay for font loading
                 console.log('⏳ Waiting for UAESymbol font...');
             }

             // Wait for UAESymbol font if needed before rendering chart
             setTimeout(function() {
                updateResponsiveStackedChartContainer(chartType);

                 var myChart = echarts.init(chartDom, null, { renderer: 'canvas' });

                 var option;

                switch(chartType) {
                    case 'sales-volume':
                        option = getSalesVolumeOption(); // EXACT same as BarChart
                        break;
                 case 'manufacturing-cost':
                     option = getManufacturingCostOption(); // EXACT same as ManufacturingCostChart
                     break;
                     case 'below-gp-expenses':
                         option = getBelowGPExpensesOption(); // EXACT same as BelowGPExpensesChart
                         break;
                     case 'combined-trends':
                         console.log('*** CASE COMBINED TRENDS REACHED ***');
                         // Wait for DOM and font to load like other charts
                         setTimeout(function() {
                             console.log('*** TIMEOUT: Initializing Combined Trends ***');
                         initializeCombinedTrends(); // EXACT same as ExpencesChart + Profitchart
                             console.log('*** TIMEOUT: After initializeCombinedTrends ***');
                         }, 1000); // Same delay as other charts
                         return;
                     default:
                         return;
                 }
                 
                 myChart.setOption(option);
                 charts[chartType] = myChart;

                 // Handle resize with responsive recalculation
                 var resizeTimeout;
                 window.addEventListener('resize', function() {
                     if (charts[chartType] && !charts[chartType].isDisposed()) {
                         // Debounce resize to avoid too many recalculations
                         clearTimeout(resizeTimeout);
                         resizeTimeout = setTimeout(function() {
                             // For sales-volume and manufacturing-cost, recalculate responsive options on resize
                             if (chartType === 'sales-volume') {
                                 var newOption = getSalesVolumeOption();
                                 charts[chartType].setOption(newOption, true); // true = not merge
                                 console.log('📱 Sales & Volume chart resized and reconfigured');
                             } else if (chartType === 'manufacturing-cost') {
                                var newManufacturingOption = getManufacturingCostOption();
                                charts[chartType].setOption(newManufacturingOption, true); // true = not merge
                                updateResponsiveStackedChartContainer(chartType);
                                 console.log('📱 Manufacturing Cost chart resized and reconfigured');
                            } else if (chartType === 'below-gp-expenses') {
                                var newBelowOption = getBelowGPExpensesOption();
                                charts[chartType].setOption(newBelowOption, true);
                                updateResponsiveStackedChartContainer(chartType);
                                console.log('📱 Below GP Expenses chart resized and reconfigured');
                             }
                             charts[chartType].resize();
                         }, 250);
                     }
                 });
             }, fontLoadDelay); // Dynamic delay based on font load status
         }

        // RESPONSIVE Sales & Volume chart options
        function getSalesVolumeOption() {
            // Detect screen size for responsive sizing
            var width = window.innerWidth;
            var isMobile = width <= 768;
            var isSmallMobile = width <= 480;
            var isTablet = width > 768 && width <= 992;

            // Calculate responsive font sizes - SMALLER on mobile for cleaner look
            var axisLabelSize = isSmallMobile ? 9 : isMobile ? 10 : isTablet ? 14 : 18;
            var barLabelSize = isSmallMobile ? 9 : isMobile ? 10 : isTablet ? 14 : 18; // REDUCED from 11 to 10
            var percentLabelSize = isSmallMobile ? 7 : isMobile ? 8 : isTablet ? 12 : 16; // REDUCED from 9 to 8

            // Calculate responsive grid spacing - MINIMAL left/right padding to align with table
            // Bottom space needs 110px+ to accommodate overlay rows (purple at 70px + green at 30px + spacing)
            var bottomSpace = isSmallMobile ? 120 : isMobile ? 110 : 110;
            var topSpace = isMobile ? 30 : 15; // More top space for labels
            var leftSpace = isMobile ? '2%' : '0%'; // REDUCED from 8% to 2% - align with table
            var rightSpace = isMobile ? '2%' : '0%'; // REDUCED from 8% to 2% - align with table

            console.log('📱 Sales & Volume Responsive:', {
                width: width,
                isMobile: isMobile,
                isSmallMobile: isSmallMobile,
                axisLabelSize: axisLabelSize,
                barLabelSize: barLabelSize
            });

            return {
                legend: {
                    show: false
                },
                 grid: {
                     left: leftSpace,
                     right: rightSpace,
                     bottom: bottomSpace,
                     top: topSpace,
                     containLabel: true
                 },
                xAxis: {
                    type: 'category',
                    data: periodLabels,
                    position: 'bottom',
                    axisLabel: {
                        rotate: isMobile ? 0 : 0, // Keep horizontal - compress text instead
                        fontWeight: 'bold',
                        fontSize: axisLabelSize,
                        color: '#000',
                        interval: 0, // Show all labels
                        formatter: function(value) {
                            const parts = value.split('-');
                            if (parts.length >= 3) {
                                const year = parts[0];
                                if (parts.length > 3) {
                                    const displayName = parts.slice(1, -1).join('-');
                                    const type = parts[parts.length - 1];
                                    // On mobile, show only year and type on ONE line
                                    if (isMobile) {
                                        return year + '\\n' + type;
                                    }
                                    return year + '\\n' + displayName + '\\n' + type;
                                } else {
                                    const month = parts[1];
                                    const type = parts[2];
                                    if (month === 'Year') {
                                        // Mobile: single line
                                        if (isMobile) {
                                            return year + ' ' + type;
                                        }
                                        return year + '\\n\\n' + type;
                                    } else {
                                        // Mobile: compact 2-line format
                                        if (isMobile) {
                                            return year + '\\n' + type;
                                        }
                                        return year + '\\n' + month + '\\n' + type;
                                    }
                                }
                            }
                            return value;
                        },
                        margin: isMobile ? 15 : 30
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#000',
                            width: 2
                        }
                    },
                    axisTick: {
                        alignWithLabel: true,
                        length: 4,
                        lineStyle: {
                            color: '#ccc'
                        }
                    }
                },
                yAxis: [{
                    type: 'value',
                    show: false,
                    scale: true,
                    max: function(value) {
                        // Give more room on mobile for labels above bars
                        return value.max * (isMobile ? 1.25 : 1.15);
                    }
                }],
                series: [{
                    name: '',
                    data: seriesData,
                    type: 'bar',
                    barMaxWidth: '80%',
                    barWidth: '80%',
                    barCategoryGap: '0%',
                    itemStyle: {
                        color: function(params) {
                            return barColors[params.dataIndex];
                        }
                    },
                     label: {
                         show: true,
                         position: 'top',
                         fontWeight: 'bold',
                         fontSize: barLabelSize, // Responsive font size
                         color: '#222',
                         distance: isMobile ? 3 : 5, // Less distance on mobile
                         rich: {
                             uae: {
                                 width: isMobile ? 12 : 16,
                                 height: isMobile ? 12 : 16,
                                 lineHeight: isMobile ? 14 : 18,
                                 padding: [-2, isMobile ? 2 : 4, 0, 0],
                                 align: 'center',
                                 verticalAlign: 'top',
                                 backgroundColor: {
                                     image: getUAESymbolImageDataURL('#222')
                                 }
                             },
                             num: {
                                 fontSize: barLabelSize,
                                 fontWeight: 'bold',
                                 color: '#222',
                                 verticalAlign: 'middle',
                                 lineHeight: barLabelSize
                             }
                         },
                         formatter: function(params) {
                             const value = params.value;
                             const text = value >= 1000000
                                 ? (value / 1000000).toFixed(1) + 'M'
                                 : value >= 1000
                                     ? (value / 1000).toFixed(1) + 'K'
                                     : String(value);
                             return '{uae|}{num|' + text + '}';
                         }
                     },
                    emphasis: {
                        focus: 'series'
                    },
                    z: 2
                }, {
                    name: 'Percent Difference',
                    type: 'custom',
                    renderItem: function(params, api) {
                        const idx = api.value(0);
                        const value = api.value(1);
                        const pct = percentVariance[idx];
                        if (pct === null || pct === undefined) return null;
                        let color = '#888';
                        if (pct > 0) color = '#2E865F';
                        else if (pct < 0) color = '#dc3545';
                        const x = api.coord([idx, value])[0];
                        const y = api.coord([idx, value])[1];
                        return {
                            type: 'text',
                            style: {
                                text: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%',
                                fill: color,
                                font: 'bold ' + percentLabelSize + 'px sans-serif', // Responsive font size
                                textAlign: 'center',
                                textVerticalAlign: 'bottom'
                            },
                            position: [x, y - (isMobile ? 35 : 36)] // More spacing on mobile to avoid overlap
                        };
                    },
                    data: periodLabels.map((_, idx) => [idx, seriesData[idx]]),
                    z: 3
                }],
                tooltip: {
                    show: false,
                    trigger: 'none'
                },
                animation: false
            };
        }

        // EXACT same SVG gauges as original ModernMarginGauge.js - NO ECHARTS
        function getMarginAnalysisOption() {
            // This function is not used for SVG gauges
            return null;
        }

        // EXACT TWIN of ModernMarginGauge.js - COMPLETE COPY (with responsive adjustments)
        function renderMarginAnalysisGauges() {
            console.log('🔧 renderMarginAnalysisGauges called');
            var chartContainer = document.getElementById('full-margin-analysis-chart');
            if (!chartContainer) {
                console.error('❌ Margin Analysis container not found!');
                return;
            }
            console.log('✅ Margin Analysis container found');

            // Responsive detection
            var width = window.innerWidth;
            var height = window.innerHeight;
            var isMobile = width <= 768;
            var isSmallMobile = width <= 480;
            var isTablet = width > 768 && width <= 992;
            var isLandscape = width > height;
            var isPortrait = height > width;

            console.log('📱 Margin Analysis responsive state:', {
                width: width,
                height: height,
                isMobile: isMobile,
                isLandscape: isLandscape,
                isPortrait: isPortrait
            });

            // PORTRAIT MODE: Stack vertically, one gauge after another with variance between
            // LANDSCAPE MODE: All gauges in one row OR zigzag layout
            var layoutMode = (isMobile && isPortrait) ? 'vertical-stack' : 'horizontal-row';

            var gaugeWidth = isSmallMobile ? '100%' : isMobile ? '90%' : isTablet ? '190px' : '220px';
            var gaugeHeight = isSmallMobile ? '140px' : isMobile ? '150px' : isTablet ? '175px' : '200px';
            var percentFontSize = isSmallMobile ? 14 : isMobile ? 16 : isTablet ? 18 : 20;
            var valueFontSize = isSmallMobile ? 20 : isMobile ? 24 : isTablet ? 26 : 28;
            var perKgFontSize = isSmallMobile ? 12 : isMobile ? 14 : isTablet ? 15 : 16;
            var titleFontSize = isSmallMobile ? 14 : isMobile ? 16 : isTablet ? 18 : 20;
            var varianceFontSize = isSmallMobile ? 12 : isMobile ? 14 : isTablet ? 16 : 18;
            var cardPadding = isSmallMobile ? '10px' : isMobile ? '12px' : '16px';
            var cardGap = '0px'; // No gap - variances go between
            var cardMinHeight = isSmallMobile ? '230px' : isMobile ? '250px' : isTablet ? '290px' : '330px';
            var percentOffset = isSmallMobile ? 36 : isMobile ? 38 : 45;

            // Layout mode variables
            var stackVertically = (layoutMode === 'vertical-stack');
            var varianceConnectorWidth = isSmallMobile ? '40px' : isMobile ? '50px' : isTablet ? '60px' : '70px';

            console.log('📐 Layout mode:', layoutMode, '| Stack vertically:', stackVertically);

            // EXACT same color schemes as ModernMarginGauge.js
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];

            // EXACT same data processing as ModernMarginGauge.js
            var gaugeData = visiblePeriods.map(function(period, index) {
                // Use unified period key generation
                var periodKey = createPeriodKey(period);

                var chartDataForPeriod = chartData[periodKey] || {};

                // Get raw data values
                var sales = chartDataForPeriod.sales || 0;
                var materialCost = chartDataForPeriod.materialCost || 0;
                var salesVolume = chartDataForPeriod.salesVolume || 0;

                // Calculate absolute margin (Sales - Material Cost)
                var absoluteMargin = sales - materialCost;

                // Calculate margin per kg
                var marginPerKg = salesVolume > 0 ? absoluteMargin / salesVolume : 0;

                // Calculate margin as percentage of sales for gauge needle
                var marginPercent = sales > 0 ? (absoluteMargin / sales) * 100 : 0;

                // Format absolute value for display (in millions)
                var absoluteValue = (absoluteMargin / 1000000).toFixed(1) + 'M';

                // Format per kg value for display (xx.xx format)
                var perKgValue = marginPerKg.toFixed(2);

                var color = resolveStackedBarColor(period, index, defaultColors, colorSchemes);

                return {
                    index: index,
                    value: Math.max(0, Math.min(100, marginPercent)), // Clamp between 0-100 for gauge
                    absoluteValue: absoluteValue,
                    perKgValue: perKgValue,
                    color: color || '#288cfa',
                    period: period,
                    sales: sales,
                    materialCost: materialCost,
                    salesVolume: salesVolume,
                    absRaw: absoluteMargin, // For variance calculations
                    marginPercent: marginPercent, // Store the margin % for relative variance calculation
                    title: period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type,
                    periodKey: periodKey
                };
            }).filter(function(item) {
                return item !== null && item !== undefined;
            });

            if (!gaugeData.length) {
                console.warn('⚠️ No margin analysis gauge data available. Rendering fallback message.');
                chartContainer.innerHTML =
                    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;padding:24px;background:#f8f9fa;border:2px dashed #cbd5f5;border-radius:8px;">' +
                        '<div style="font-size:42px;margin-bottom:12px;">ℹ️</div>' +
                        '<div style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:6px;">Margin analysis data unavailable</div>' +
                        '<div style="font-size:13px;color:#4b5563;text-align:center;max-width:360px;">Ensure the relevant periods are visible in the dashboard before exporting to HTML.</div>' +
                    '</div>';
                return;
            }

            // EXACT same variance calculation as ModernMarginGauge.js
            var variances = gaugeData.map(function(g, idx) {
                if (idx === 0) return null; // First period has no previous period to compare
                var prevGauge = gaugeData[idx - 1];
                if (!prevGauge || prevGauge.marginPercent === 0) return null;
                return ((g.marginPercent - prevGauge.marginPercent) / Math.abs(prevGauge.marginPercent)) * 100;
            });

            var buildGaugeCard = function(gauge) {
                var needleAngle = -120 + (gauge.value / 100) * 240;
                var progressOffset = 418 - (gauge.value / 100) * 418;
                var tipX = 100 + 70 * Math.sin((Math.PI / 180) * needleAngle);
                var tipY = 120 - 70 * Math.cos((Math.PI / 180) * needleAngle);
                var percentY = tipY - percentOffset;
                var uaSymbol = getUAEDirhamSymbolHTML();
                var titleFormatted = (function() {
                    var words = gauge.title.split(' ');
                    if (words.length > 1) {
                        return words.slice(0, -1).join(' ') + '<br />' + words[words.length - 1];
                    }
                    return gauge.title;
                })();

                return '' +
                    '<div class="modern-gauge-card" style="' +
                        'background:#fff;border-radius:12px;padding:' + cardPadding + ';box-shadow:0 6px 12px rgba(0,0,0,0.08);' +
                        'display:flex;flex-direction:column;align-items:center;justify-content:space-between;' +
                        'min-height:' + cardMinHeight + ';width:100%;max-width:' + (stackVertically ? '100%' : (isSmallMobile ? '240px' : isMobile ? '260px' : '300px')) + ';' +
                        'position:relative;overflow:hidden;' +
                    '">' +
                        '<div class="gauge-body">' +
                            '<div class="gauge-container" style="width:100%;display:flex;justify-content:center;">' +
                                '<svg viewBox="0 0 200 140" class="gauge-svg" style="width:' + gaugeWidth + ';height:' + gaugeHeight + ';max-width:100%;">' +
                                    '<path d="M20,120 A80,80 0 0,1 180,120" fill="none" stroke="#e5e7eb" stroke-width="18" stroke-linecap="round"></path>' +
                                    '<path d="M20,120 A80,80 0 0,1 180,120" fill="none" stroke="' + gauge.color + '" stroke-width="18" stroke-linecap="round" stroke-dasharray="418" stroke-dashoffset="' + progressOffset + '"></path>' +
                                    '<g transform="rotate(' + needleAngle + ' 100 120)">' +
                                        '<line x1="100" y1="120" x2="100" y2="50" stroke="#333" stroke-width="4" stroke-linecap="round"></line>' +
                                        '<circle cx="100" cy="120" r="8" fill="#fff" stroke="#333" stroke-width="4"></circle>' +
                                    '</g>' +
                                    '<text x="' + tipX + '" y="' + percentY + '" text-anchor="middle" font-size="' + percentFontSize + 'px" font-weight="bold" fill="' + gauge.color + '" style="user-select:none;">' +
                                        gauge.value.toFixed(2) + ' %/Sls' +
                                    '</text>' +
                                '</svg>' +
                            '</div>' +
                            '<div class="gauge-absolute" style="' +
                                'font-size:' + valueFontSize + 'px;font-weight:bold;color:' + gauge.color + ';' +
                                'margin:' + (isMobile ? '8px 0 4px 0' : '12px 0 6px 0') + ';text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;' +
                            '">' +
                                uaSymbol + ' ' + gauge.absoluteValue +
                            '</div>' +
                            '<div class="gauge-perkg" style="' +
                                'font-size:' + perKgFontSize + 'px;font-weight:600;color:' + gauge.color + ';' +
                                'margin-bottom:' + (isMobile ? '6px' : '8px') + ';white-space:nowrap;' +
                            '">' +
                                uaSymbol + ' ' + gauge.perKgValue + ' per kg' +
                            '</div>' +
                        '</div>' +
                        '<div class="gauge-title" style="' +
                            'background-color:' + gauge.color + ';color:' + (String(gauge.color).toLowerCase() === '#ffd700' ? '#333' : '#fff') + ';' +
                            'border-top:1px solid ' + gauge.color + ';font-size:' + titleFontSize + 'px;font-weight:bold;letter-spacing:0.5px;' +
                            'padding:' + (isMobile ? '10px 8px' : '12px 16px') + ';text-align:center;width:100%;box-sizing:border-box;line-height:1.25;' +
                        '">' +
                            '<span>' + titleFormatted + '</span>' +
                        '</div>' +
                    '</div>';
            };

            var gaugesHTML;

            if (stackVertically) {
                gaugesHTML = '<div class="modern-gauge-container" style="display:flex;flex-direction:column;gap:' + cardGap + ';padding:12px;width:100%;box-sizing:border-box;">';
                gaugeData.forEach(function(gauge, idx) {
                    gaugesHTML += buildGaugeCard(gauge);
                    if (idx < gaugeData.length - 1) {
                        var variance = variances[idx + 1];
                        var badgeColor = '#888';
                        var arrow = '–';
                        if (variance !== null && !isNaN(variance)) {
                            if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                            else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                        }
                        gaugesHTML += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin:' + (isSmallMobile ? '6px 0' : '10px 0') + ';font-weight:bold;font-size:' + (varianceFontSize + 2) + 'px;color:' + (variance === null || isNaN(variance) ? '#888' : badgeColor) + ';">' +
                            (variance === null || isNaN(variance)
                                ? '<span>0%</span>'
                                : '<span style="font-size:' + (varianceFontSize + 6) + 'px;line-height:1;">' + arrow + '</span><span>' + Math.abs(variance).toFixed(1) + '%</span>') +
                            '</div>';
                    }
                });
                gaugesHTML += '</div>';
            } else {
                gaugesHTML = '<div class="modern-gauge-container" style="display:flex;flex-direction:row;flex-wrap:' + (isTablet ? 'wrap' : 'nowrap') + ';justify-content:center;align-items:center;gap:' + cardGap + ';padding:16px;width:100%;box-sizing:border-box;">';
                gaugeData.forEach(function(gauge, idx) {
                    gaugesHTML += buildGaugeCard(gauge);
                    if (idx < gaugeData.length - 1) {
                        var variance = variances[idx + 1];
                        var badgeColor = '#888';
                        var arrow = '–';
                        if (variance !== null && !isNaN(variance)) {
                            if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                            else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                        }
                        gaugesHTML += '<div style="align-self:center;margin:0 2px;display:flex;flex-direction:column;align-items:center;min-width:' + varianceConnectorWidth + ';width:' + varianceConnectorWidth + ';height:48px;justify-content:center;">' +
                            (variance === null || isNaN(variance)
                                ? '<span style="color:#888;font-size:' + varianceFontSize + 'px;font-weight:bold;text-align:center;">0%</span>'
                                : '<span style="font-size:' + (varianceFontSize + 6) + 'px;font-weight:bold;color:' + badgeColor + ';line-height:1;">' + arrow + '</span>' +
                                  '<span style="font-size:' + (varianceFontSize + 4) + 'px;font-weight:bold;color:' + badgeColor + ';line-height:1.1;">' + Math.abs(variance).toFixed(1) + '</span>' +
                                  '<span style="font-size:' + varianceFontSize + 'px;font-weight:bold;color:' + badgeColor + ';line-height:1.1;">%</span>') +
                            '</div>';
                    }
                });
                gaugesHTML += '</div>';
            }

            chartContainer.innerHTML = gaugesHTML;

            // Handle resize and orientation change
            var resizeTimeout;
            window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    console.log('📱 Margin Analysis: Orientation/resize detected, re-rendering...');
                    renderMarginAnalysisGauges();
                }, 300);
            });
        }

         // Manufacturing Cost with responsive layout
         function getManufacturingCostOption() {
             console.log('🔧 getManufacturingCostOption called');
             console.log('📊 visiblePeriods:', visiblePeriods);
             console.log('📊 capturedActualData:', capturedActualData);

             // Responsive detection
             var width = window.innerWidth;
             var height = window.innerHeight;
             var isMobile = width <= 768;
             var isSmallMobile = width <= 480;
             var isTablet = width > 768 && width <= 992;
             var isLandscape = width > height;
             var isPortrait = height > width;

             // PORTRAIT: Vertical stacked columns with horizontal scroll
             // LANDSCAPE: Horizontal stacked bars (original layout)
             var useVerticalColumns = (isMobile && isPortrait);

             console.log('📱 Manufacturing Cost responsive state:', {
                 width: width,
                 height: height,
                 isMobile: isMobile,
                 isPortrait: isPortrait,
                 useVerticalColumns: useVerticalColumns
             });

             // EXACT same manufacturing ledgers as original
             var MANUFACTURING_LEDGERS = {
                 LABOUR: { label: 'Labour', rowIndex: 9 },
                 DEPRECIATION: { label: 'Depreciation', rowIndex: 10 },
                 ELECTRICITY: { label: 'Electricity', rowIndex: 12 },
                 OTHER_OVERHEADS: { label: 'Others Mfg. Overheads', rowIndex: 13 },
                 TOTAL_DIRECT_COST: { label: 'Total Actual Direct Cost', rowIndex: 14 }
             };
             
             // EXACT same color schemes as original
             var colorSchemes = [
                 { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                 { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                 { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                 { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                 { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
             ];
             var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
             
             // Get all ledger items except the total - EXACT same as original
             var ledgerItems = Object.values(MANUFACTURING_LEDGERS).filter(function(item) {
                 return item !== MANUFACTURING_LEDGERS.TOTAL_DIRECT_COST;
             });
             
             // Limit to 5 periods max - EXACT same as original
             var periodsToUse = visiblePeriods.slice(0, 5);
             
             // EXACT same data processing as original
             var ledgersData = {};
             var periodTotals = {};
             
             // Calculate all period names - EXACT same as original
             var allPeriodNames = periodsToUse.map(function(period) {
                 return period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
             });
             
             // Initialize data structure - EXACT same as original
             ledgerItems.forEach(function(ledger) {
                 ledgersData[ledger.label] = { label: ledger.label, values: {} };
                 allPeriodNames.forEach(function(periodName) {
                     ledgersData[ledger.label].values[periodName] = {
                         amount: 0,
                         percentOfSales: 0,
                         perKg: 0
                     };
                 });
             });
             
             // Initialize all period totals - EXACT same as original
             allPeriodNames.forEach(function(periodName) {
                 periodTotals[periodName] = {
                     amount: 0,
                     percentOfSales: 0,
                     perKg: 0
                 };
             });
             
             // Process each period - EXACT same logic as original
             periodsToUse.forEach(function(period, periodIndex) {
                 var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                 var periodTotal = 0;
                 
                 ledgerItems.forEach(function(ledger) {
                     // Get the base amount using computeCellValue
                     var amount = computeCellValue(ledger.rowIndex, period);
                     var salesValue = computeCellValue(3, period);
                     var salesVolumeValue = computeCellValue(7, period);
                     
                     // Calculate percent of sales - EXACT same as original
                     var percentOfSales = 0;
                     if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                         percentOfSales = (amount / salesValue) * 100;
                     }
                     
                     // Calculate per kg value - EXACT same as original
                     var perKgValue = 0;
                     if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                         perKgValue = amount / salesVolumeValue;
                     }
                     
                     var validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
                     var validPercentOfSales = typeof percentOfSales === 'number' && !isNaN(percentOfSales) ? percentOfSales : 0;
                     var validPerKg = typeof perKgValue === 'number' && !isNaN(perKgValue) ? perKgValue : 0;
                     
                     ledgersData[ledger.label].values[periodName] = {
                         amount: validAmount,
                         percentOfSales: validPercentOfSales,
                         perKg: validPerKg
                     };
                     
                     periodTotal += validAmount;
                 });
                 
                 periodTotals[periodName] = {
                     amount: periodTotal,
                     percentOfSales: 0,
                     perKg: 0
                 };
                 
                 // Get actual totals from dedicated row - EXACT same as original
                 var actualTotal = computeCellValue(MANUFACTURING_LEDGERS.TOTAL_DIRECT_COST.rowIndex, period);
                 var salesValue = computeCellValue(3, period);
                 var salesVolumeValue = computeCellValue(7, period);
                 
                 var totalPercentOfSales = 0;
                 if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                     totalPercentOfSales = (actualTotal / salesValue) * 100;
                 }
                 
                 var totalPerKgValue = 0;
                 if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                     totalPerKgValue = actualTotal / salesVolumeValue;
                 }
                 
                 if (typeof actualTotal === 'number' && !isNaN(actualTotal)) {
                     periodTotals[periodName].amount = actualTotal;
                 }
                 periodTotals[periodName].percentOfSales = totalPercentOfSales;
                 periodTotals[periodName].perKg = totalPerKgValue;
             });
             
             // Sort ledgers by average amount - EXACT same as original
             var ledgersList = Object.values(ledgersData);
             ledgersList.sort(function(a, b) {
                 var aAvg = Object.values(a.values).reduce(function(sum, val) { return sum + (val.amount || 0); }, 0) / Object.values(a.values).length;
                 var bAvg = Object.values(b.values).reduce(function(sum, val) { return sum + (val.amount || 0); }, 0) / Object.values(b.values).length;
                 return bAvg - aAvg;
             });
             
             var ledgerLabels = ledgersList.map(function(ledger) { return ledger.label; });
             var periodNames = allPeriodNames;
             
             // Prepare series for each period - EXACT same as original
             var series = periodsToUse.map(function(period, index) {
                 var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                 
                 // Get color based on period's customColor - EXACT same logic as original
                var color = resolveStackedBarColor(period, index, defaultColors, colorSchemes);
                 
                 // Determine if color is dark - EXACT same as original
                 var isColorDark = function(hexColor) {
                     var r = parseInt(hexColor.substring(1, 3), 16);
                     var g = parseInt(hexColor.substring(3, 5), 16);
                     var b = parseInt(hexColor.substring(5, 7), 16);
                     return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                 };
                 
                 var textColor = isColorDark(color) ? '#fff' : '#333';
                 
                 return {
                     name: periodName,
                     type: 'bar',
                     stack: 'total',
                     hoverLayerThreshold: Infinity,
                     label: {
                         show: true,
                         position: 'inside',
                         formatter: function(params) {
                             var data = ledgersList.find(function(l) { return l.label === params.name; })?.values[periodName];
                             if (!data) return '';

                             var millionsValue = (data.amount / 1000000).toFixed(2);
                             var percentValue = data.percentOfSales.toFixed(1);
                             var perKgValue = data.perKg.toFixed(1);

                             return '{uae|} ' + millionsValue + 'M\\n\\n' + percentValue + '%/Sls\\n\\n{uae|} ' + perKgValue + '/kg';
                         },
                         fontSize: 10,
                         fontWeight: 'bold',
                         color: textColor,
                         backgroundColor: 'transparent',
                         padding: [2, 4],
                         borderRadius: 0,
                         textBorderWidth: 0,
                         shadowBlur: 0,
                         lineHeight: 12,
                         align: 'center',
                         verticalAlign: 'middle',
                         rich: {
                             uae: {
                                 width: 10,
                                 height: 10,
                                 lineHeight: 12,
                                 padding: [-1, 2, 0, 0],
                                 align: 'center',
                                 verticalAlign: 'top',
                                 backgroundColor: {
                                     image: getUAESymbolImageDataURL(textColor)
                                 }
                             }
                         }
                     },
                     emphasis: {
                         focus: 'series',
                         blurScope: 'coordinateSystem',
                         label: {
                             fontSize: 11,
                             fontWeight: 'bold'
                         }
                     },
                     data: ledgerLabels.map(function(label) {
                         var ledger = ledgersList.find(function(l) { return l.label === label; });
                         return ledger?.values[periodName]?.amount || 0;
                     }),
                     itemStyle: {
                         color: color,
                         borderRadius: [0, 2, 2, 0]
                     },
                     barWidth: '80%',
                     barGap: '20%',
                     barCategoryGap: '30%'
                 };
             });
             
             // Build responsive chart configuration
             if (useVerticalColumns) {
                 // PORTRAIT MODE: Vertical stacked columns with horizontal scroll
                 // Transform: periods on X-axis (categories), ledgers stacked vertically per period

                // Responsive font sizes tuned for small portrait widths
                var baselineWidth = Math.min(Math.max(width, 320), 768);
                var portraitScale = baselineWidth / 430; // 430px ≈ iPhone 12/13 portrait width
                var labelFontSize = Math.max(10, Math.min(14, Math.round(12 * portraitScale)));
                var axisLabelSize = Math.max(10, Math.min(12, Math.round(11 * portraitScale)));
                var legendFontSize = Math.max(11, Math.min(13, Math.round(12 * portraitScale)));

                 // Calculate grid width for scrolling - WIDER columns for better readability
                 var columnWidth = isSmallMobile ? 160 : 180;
                 var totalGridWidth = columnWidth * periodsToUse.length;

                 // Create series data for vertical stacking
                 // Each ledger becomes a series, data array has values for each period
                 var verticalSeries = ledgerLabels.map(function(ledgerLabel, ledgerIdx) {
                     // Get ledger data
                     var ledgerData = ledgersList.find(function(l) { return l.label === ledgerLabel; });

                     // Map each period to get this ledger's value
                     var dataValues = periodsToUse.map(function(period, periodIdx) {
                         var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                         return ledgerData?.values[periodName]?.amount || 0;
                     });

                     // Get color for the ledger based on first period (for consistency)
                     var period = periodsToUse[0];
                     var color = resolveStackedBarColor(period, 0, defaultColors, colorSchemes);

                     // Use different colors for each ledger for clarity
                     var ledgerColors = ['#8B4513', '#FF8C00', '#FFD700', '#4682B4']; // Brown, Orange, Gold, Steel Blue
                     var ledgerColor = ledgerColors[ledgerIdx % ledgerColors.length];

                     var isColorDark = function(hexColor) {
                         var r = parseInt(hexColor.substring(1, 3), 16);
                         var g = parseInt(hexColor.substring(3, 5), 16);
                         var b = parseInt(hexColor.substring(5, 7), 16);
                         return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                     };

                     var textColor = isColorDark(ledgerColor) ? '#fff' : '#333';

                     return {
                         name: ledgerLabel,
                         type: 'bar',
                         stack: 'total',
                         data: dataValues,
                         label: {
                             show: true,
                             position: 'inside',
                             formatter: function(params) {
                                 var periodIdx = params.dataIndex;
                                 var period = periodsToUse[periodIdx];
                                 var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                                 var data = ledgerData?.values[periodName];
                                 if (!data) return '';

                                 // SIMPLIFIED: Show only percentage for readability
                                 var percentValue = data.percentOfSales.toFixed(1);

                                 // Only show if segment is large enough (> 3% to avoid clutter)
                                 if (data.percentOfSales < 3) return '';

                                 return percentValue + '%/Sls';
                             },
                             fontSize: labelFontSize,
                             fontWeight: 'bold',
                             color: textColor,
                             lineHeight: labelFontSize + 2
                         },
                         itemStyle: {
                             color: ledgerColor,
                             borderRadius: [2, 2, 0, 0]
                         },
                         barWidth: '85%', // Wider bars for better readability
                         barMinHeight: 30 // Minimum height for each segment
                     };
                 });

                 return {
                     animation: true,
                     animationDuration: 1000,
                     animationEasing: 'cubicOut',
                     animationDelay: function (idx) {
                         return idx * 50;
                     },
                     tooltip: {
                         trigger: 'item',
                         show: true,
                         backgroundColor: 'rgba(255, 255, 255, 0.95)',
                         borderColor: '#ddd',
                         borderWidth: 1,
                         textStyle: {
                             color: '#333',
                             fontSize: 12
                         },
                         formatter: function(params) {
                             var periodName = params.name;
                             var ledgerLabel = params.seriesName;
                             var ledger = ledgersList.find(function(l) { return l.label === ledgerLabel; });
                             var data = ledger?.values[periodName];
                             if (!data) return '';
                             return '<strong>' + ledgerLabel + '</strong><br/>' +
                                    periodName + '<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + (data.amount / 1000000).toFixed(2) + 'M<br/>' +
                                    data.percentOfSales.toFixed(1) + '% of Sales<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + data.perKg.toFixed(1) + ' per kg';
                         }
                     },
                     animation: true,
                     animationDuration: 1000,
                     animationEasing: 'cubicOut',
                     animationDelay: function (idx) {
                         return idx * 50;
                     },
                     tooltip: {
                         trigger: 'item',
                         show: true,
                         backgroundColor: 'rgba(255, 255, 255, 0.95)',
                         borderColor: '#ddd',
                         borderWidth: 1,
                         textStyle: {
                             color: '#333',
                             fontSize: 12
                         },
                         formatter: function(params) {
                             var periodName = params.name;
                             var ledgerLabel = params.seriesName;
                             var ledger = ledgersList.find(function(l) { return l.label === ledgerLabel; });
                             var data = ledger?.values[periodName];
                             if (!data) return '';
                             return '<strong>' + ledgerLabel + '</strong><br/>' +
                                    periodName + '<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + (data.amount / 1000000).toFixed(2) + 'M<br/>' +
                                    data.percentOfSales.toFixed(1) + '% of Sales<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + data.perKg.toFixed(1) + ' per kg';
                         }
                     },
                     legend: {
                         data: ledgerLabels,
                         type: 'plain',
                         top: 5,
                         left: 'center',
                         orient: 'horizontal',
                         icon: 'roundRect',
                         itemWidth: 12,
                         itemHeight: 8,
                         itemGap: 8,
                         textStyle: {
                             fontSize: legendFontSize,
                             fontWeight: 'bold',
                             color: '#666'
                         },
                         width: '95%', // Use most of screen width
                         padding: [5, 10]
                     },
                     grid: {
                         left: 10,
                         right: 10,
                         bottom: 100,
                         top: 70, // More space for multi-row legend
                         containLabel: true
                     },
                     xAxis: {
                         type: 'category',
                         data: periodNames,
                         axisLabel: {
                             fontWeight: 'bold',
                             fontSize: axisLabelSize,
                             color: '#444',
                             rotate: 0, // NO rotation
                             interval: 0,
                             lineHeight: 14,
                             formatter: function(value) {
                                 // Split into 3 lines: Year / Period / Type
                                 var parts = value.split(' ');
                                 if (parts.length >= 3) {
                                     // e.g., "2025 HY1 Actual" → "2025\\nHY1\\nActual"
                                     return parts[0] + '\\n' + parts[1] + '\\n' + parts.slice(2).join(' ');
                                 } else if (parts.length === 2) {
                                     return parts[0] + '\\n' + parts[1];
                                 }
                                 return value;
                             }
                         },
                         axisLine: {
                             lineStyle: {
                                 color: '#ddd'
                             }
                         },
                         axisTick: {
                             show: false
                         }
                     },
                     yAxis: {
                         type: 'value',
                         show: true,
                         axisLine: {
                             show: false
                         },
                         axisTick: {
                             show: false
                         },
                         axisLabel: {
                             show: false
                         },
                         splitLine: {
                             show: true,
                             lineStyle: {
                                 color: '#eee',
                                 type: 'dashed'
                             }
                         }
                     },
                     series: verticalSeries
                 };
             } else {
                 // LANDSCAPE MODE: Horizontal stacked bars (original layout)
                var legendFontSize = isMobile ? 13 : isTablet ? 14 : 16;
                var axisLabelSize = isMobile ? 12 : isTablet ? 13 : 14;
                var labelFontSize = isMobile ? 14 : isTablet ? 13 : 11;
                var labelLineHeight = isTablet ? Math.max(labelFontSize + 4, 18) : Math.max(labelFontSize + 2, 14);
                var insideLabelPadding = isTablet ? [4, 8] : [2, 4];

                 return {
                     animation: true,
                     animationDuration: 1000,
                     animationEasing: 'cubicOut',
                     animationDelay: function (idx) {
                         return idx * 50;
                     },
                     tooltip: {
                         trigger: 'item',
                         show: true,
                         backgroundColor: 'rgba(255, 255, 255, 0.95)',
                         borderColor: '#ddd',
                         borderWidth: 1,
                         textStyle: {
                             color: '#333',
                             fontSize: 12
                         },
                         formatter: function(params) {
                             var ledgerLabel = params.name;
                             var periodName = params.seriesName;
                             var ledger = ledgersList.find(function(l) { return l.label === ledgerLabel; });
                             var data = ledger?.values[periodName];
                             if (!data) return '';
                             return '<strong>' + ledgerLabel + '</strong><br/>' +
                                    periodName + '<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + (data.amount / 1000000).toFixed(2) + 'M<br/>' +
                                    data.percentOfSales.toFixed(1) + '% of Sales<br/>' +
                                    getUAEDirhamSymbolHTML() + ' ' + data.perKg.toFixed(1) + ' per kg';
                         }
                     },
                     legend: {
                         data: periodNames,
                         type: 'scroll',
                         top: 0,
                         left: 'center',
                         icon: 'roundRect',
                         itemWidth: 14,
                         itemHeight: 8,
                         textStyle: {
                             fontSize: legendFontSize,
                             fontWeight: 'bold',
                             color: '#666'
                         },
                         pageIconColor: '#888',
                         pageTextStyle: {
                             color: '#888'
                         }
                     },
                     grid: {
                         left: isMobile ? '10%' : '5%',
                         right: isMobile ? '3%' : '5%',
                         bottom: '3%',
                         top: '40px',
                         containLabel: true
                     },
                     xAxis: {
                         show: true,
                         type: 'value',
                         axisLine: {
                             show: false
                         },
                         axisTick: {
                             show: false
                         },
                         axisLabel: {
                             show: false
                         },
                         splitLine: {
                             show: true,
                             lineStyle: {
                                 color: '#eee',
                                 type: 'dashed'
                             }
                         },
                         axisPointer: {
                             show: false
                         }
                     },
                     yAxis: {
                         type: 'category',
                         data: ledgerLabels,
                         axisLabel: {
                             fontWeight: 'bold',
                             fontSize: axisLabelSize,
                             color: '#444',
                             padding: [0, 20, 0, 0],
                             formatter: function(value) {
                                 if (isMobile && value.length > 18) {
                                     return value.substring(0, 15) + '...';
                                 }
                                 if (value.length > 25) {
                                     return value.substring(0, 22) + '...';
                                 }
                                 return value;
                             }
                         },
                         axisLine: {
                             lineStyle: {
                                 color: '#ddd'
                             }
                         },
                         axisTick: {
                             show: false
                         },
                         splitLine: {
                             show: false
                         }
                     },
                     series: series.map(function(s) {
                         // Update label font size for landscape mobile
                         s.label.fontSize = labelFontSize;
                        s.label.lineHeight = labelLineHeight;
                        s.label.padding = insideLabelPadding;
                        if (s.label.rich && s.label.rich.uae) {
                            s.label.rich.uae.lineHeight = labelLineHeight;
                            s.label.rich.uae.padding = [-1, 2, 0, 0];
                        }
                        if (isTablet) {
                            s.barWidth = '92%';
                            s.barGap = '16%';
                            s.barCategoryGap = '36%';
                            s.labelLayout = { hideOverlap: false, moveOverlap: 'shiftY' };
                        } else {
                            s.barWidth = s.barWidth || '80%';
                            s.barGap = '20%';
                            s.barCategoryGap = '30%';
                            s.labelLayout = { hideOverlap: true };
                        }
                         return s;
                     })
                 };
             }
         }

         // EXACT same totals rendering as original ManufacturingCostChart.tsx
         function renderManufacturingCostTotals() {
            var totalsContainer = document.getElementById('manufacturing-cost-totals');
            if (!totalsContainer) {
                console.warn('⚠️ Manufacturing cost totals container not found');
                return;
            }
             
             // EXACT same manufacturing ledgers as original
             var MANUFACTURING_LEDGERS = {
                 LABOUR: { label: 'Labour', rowIndex: 9 },
                 DEPRECIATION: { label: 'Depreciation', rowIndex: 10 },
                 ELECTRICITY: { label: 'Electricity', rowIndex: 12 },
                 OTHER_OVERHEADS: { label: 'Others Mfg. Overheads', rowIndex: 13 },
                 TOTAL_DIRECT_COST: { label: 'Total Actual Direct Cost', rowIndex: 14 }
             };
             
             var colorSchemes = [
                 { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                 { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                 { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                 { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                 { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
             ];
             var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
             
             // Limit to 5 periods max - EXACT same as original
             var periodsToUse = visiblePeriods.slice(0, 5);
             var periodTotals = {};
             
             // Calculate all period names - EXACT same as original
             var allPeriodNames = periodsToUse.map(function(period) {
                 return period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
             });
             
             // Initialize all period totals - EXACT same as original
             allPeriodNames.forEach(function(periodName) {
                 periodTotals[periodName] = {
                     amount: 0,
                     percentOfSales: 0,
                     perKg: 0
                 };
             });
             
             // Process each period - EXACT same logic as original
             periodsToUse.forEach(function(period, periodIndex) {
                 var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                 
                 // Get actual totals from dedicated row - EXACT same as original
                 var actualTotal = computeCellValue(MANUFACTURING_LEDGERS.TOTAL_DIRECT_COST.rowIndex, period);
                 var salesValue = computeCellValue(3, period);
                 var salesVolumeValue = computeCellValue(7, period);
                 
                 var totalPercentOfSales = 0;
                 if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                     totalPercentOfSales = (actualTotal / salesValue) * 100;
                 }
                 
                 var totalPerKgValue = 0;
                 if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                     totalPerKgValue = actualTotal / salesVolumeValue;
                 }
                 
                 periodTotals[periodName] = {
                     amount: typeof actualTotal === 'number' && !isNaN(actualTotal) ? actualTotal : 0,
                     percentOfSales: totalPercentOfSales,
                     perKg: totalPerKgValue
                 };
             });

            var totalsHTML = '<div class="totals-scroll-container manufacturing-totals-scroll">';
             
             periodsToUse.forEach(function(period, index) {
                 var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                 var totals = periodTotals[periodName] || { amount: 0, percentOfSales: 0, perKg: 0 };
                 
                 // Format values with proper decimal places - EXACT same as original
                 var formattedMillions = (totals.amount / 1000000).toFixed(2);
                 var formattedPercent = totals.percentOfSales.toFixed(1);
                 var formattedPerKg = totals.perKg.toFixed(1);
                 
                 // Get color for period - EXACT same logic as original
                var color = resolveStackedBarColor(period, index, defaultColors, colorSchemes);
                 
                 var isColorDark = function(hexColor) {
                     var r = parseInt(hexColor.substring(1, 3), 16);
                     var g = parseInt(hexColor.substring(3, 5), 16);
                     var b = parseInt(hexColor.substring(5, 7), 16);
                     return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                 };
                 var textColor = isColorDark(color) ? '#fff' : '#333';

                var cardHTML = '';
                cardHTML += '<div class="manufacturing-totals-card" style="background-color: ' + color + '; border-color: ' + color + ';">';
                cardHTML += '<div class="totals-card-title" style="color: ' + textColor + ';">' + periodName + '</div>';
                cardHTML += '<div class="totals-card-value" style="color: ' + textColor + ';">';
                cardHTML += getUAEDirhamSymbolHTML() + ' ' + formattedMillions + 'M';
                cardHTML += '</div>';
                cardHTML += '<div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 0 8px; margin-top: 8px;">';
                cardHTML += '<div class="totals-card-subtitle" style="color: ' + textColor + ';">' + formattedPercent + '%/Sls</div>';
                cardHTML += '<div class="totals-card-subtitle" style="color: ' + textColor + ';">' + getUAEDirhamSymbolHTML() + ' ' + formattedPerKg + '/kg</div>';
                cardHTML += '</div>';
                cardHTML += '</div>';

                var connectorHTML = '';
                 if (index < periodsToUse.length - 1) {
                     var nextPeriod = periodsToUse[index + 1];
                     var nextPeriodName = nextPeriod.year + ' ' + (nextPeriod.isCustomRange ? formatCustomRangeDisplay(nextPeriod.displayName) : (nextPeriod.month || '')) + ' ' + nextPeriod.type;
                     var nextTotals = periodTotals[nextPeriodName] || { amount: 0 };
                     
                     var variance = null;
                     if (totals.amount !== 0) {
                         variance = ((nextTotals.amount - totals.amount) / Math.abs(totals.amount)) * 100;
                     }
                     
                    var badgeColor = '#888';
                    var arrow = '–';
                     if (variance !== null && !isNaN(variance)) {
                         if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                         else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                     }

                    connectorHTML += '<div class="totals-connector">';
                    if (variance === null || isNaN(variance)) {
                       connectorHTML += '<span class="variance-text" style="color: #888;">0%</span>';
                     } else {
                       connectorHTML += '<span class="variance-arrow" style="color: ' + badgeColor + ';">' + arrow + '</span>';
                       connectorHTML += '<span class="variance-text" style="color: ' + badgeColor + ';">' + Math.abs(variance).toFixed(1) + '</span>';
                       connectorHTML += '<span class="variance-percent" style="color: ' + badgeColor + ';">%</span>';
                    }
                    connectorHTML += '</div>';
                }

                totalsHTML += cardHTML + connectorHTML;
             });
             
            totalsHTML += '</div>';
            totalsContainer.innerHTML = totalsHTML;

            return {
                totalsHTML: totalsHTML,
                periodTotals: periodTotals,
                periodNames: allPeriodNames
            };
        }

        // Render Below GP Expenses totals - EXACT same as original BelowGPExpensesChart.tsx
        function renderBelowGPExpensesTotals() {
            var totalsContainer = document.getElementById('below-gp-expenses-totals');
            if (!totalsContainer) {
                console.warn('⚠️ Below GP totals container not found');
                return;
            }
            
            // EXACT same below GP ledgers as original
            var BELOW_GP_LEDGERS = {
                SELLING_EXPENSES: { label: 'Selling expenses', rowIndex: 31 },
                TRANSPORTATION: { label: 'Transportation', rowIndex: 32 },
                ADMINISTRATION: { label: 'Administration', rowIndex: 40 },
                BANK_INTEREST: { label: 'Bank interest', rowIndex: 42 },
                TOTAL_BELOW_GP_EXPENSES: { label: 'Total Below GP Expenses', rowIndex: 52 }
            };
            
            // EXACT same color schemes as original
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
            
            // Get period data
            var periodsToUse = visiblePeriods.slice(0, 5);
            
            // Calculate totals for each period - EXACT same logic as original
            var periodTotals = {};
            periodsToUse.forEach(function(period) {
                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                
                // Get actual totals from dedicated row - EXACT same as original
                var actualTotal = computeCellValue(BELOW_GP_LEDGERS.TOTAL_BELOW_GP_EXPENSES.rowIndex, period);
                var salesValue = computeCellValue(3, period);
                var salesVolumeValue = computeCellValue(7, period);
                
                var totalPercentOfSales = 0;
                if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                    totalPercentOfSales = (actualTotal / salesValue) * 100;
                }
                
                var totalPerKgValue = 0;
                if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                    totalPerKgValue = actualTotal / salesVolumeValue;
                }
                
                periodTotals[periodName] = {
                    amount: actualTotal || 0,
                    percentOfSales: totalPercentOfSales,
                    perKg: totalPerKgValue
                };
            });

            var totalsHTML = '<div class="below-gp-totals-container" style="display: flex; flex-wrap: wrap; justify-content: space-around; align-items: flex-end; gap: 5px; margin-top: 20px; margin-bottom: 0; width: 100%;">';
            
            periodsToUse.forEach(function(period, idx) {
                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                var totals = periodTotals[periodName] || { amount: 0, percentOfSales: 0, perKg: 0 };
                var formattedMillions = (totals.amount / 1000000).toFixed(2);
                var formattedPercent = totals.percentOfSales.toFixed(1);
                var formattedPerKg = totals.perKg.toFixed(1);
                
                // Get color - EXACT same logic as original
                var color = resolveStackedBarColor(period, idx, defaultColors, colorSchemes);
                
                var isColorDark = function(hexColor) {
                    var r = parseInt(hexColor.substring(1, 3), 16);
                    var g = parseInt(hexColor.substring(3, 5), 16);
                    var b = parseInt(hexColor.substring(5, 7), 16);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                };
                
                var textColor = isColorDark(color) ? '#fff' : '#333';

                var cardHTML = '';
                cardHTML += '<div class="below-gp-expenses-totals-card" style="background-color: ' + color + '; padding: 12px 10px; border-radius: 6px; border: 1px solid ' + color + '; box-shadow: 0 2px 6px rgba(0,0,0,0.07); min-width: 150px; max-width: 180px; flex: 1; text-align: center; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center;">';
                cardHTML += '<div class="totals-card-title" style="color: ' + textColor + '; font-size: 14px; font-weight: 500; margin-top: 8px;">' + periodName + '</div>';
                cardHTML += '<div class="totals-card-value" style="color: ' + textColor + '; font-weight: bold; font-size: 22px; margin-top: 8px;">';
                cardHTML += getUAEDirhamSymbolHTML() + ' ' + formattedMillions + 'M';
                cardHTML += '</div>';
                cardHTML += '<div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 0 8px; font-size: 12px; font-weight: bold; color: ' + textColor + '; margin-top: 8px;">';
                cardHTML += '<div>' + formattedPercent + '%/Sls</div>';
                cardHTML += '<div>' + getUAEDirhamSymbolHTML() + ' ' + formattedPerKg + '/kg</div>';
                cardHTML += '</div>';
                cardHTML += '</div>';
                
                // Add variance badge between cards - EXACT same as original
                var connectorHTML = '';
                if (idx < periodsToUse.length - 1) {
                    var nextPeriod = periodsToUse[idx + 1];
                    var nextPeriodName = nextPeriod.year + ' ' + (nextPeriod.isCustomRange ? formatCustomRangeDisplay(nextPeriod.displayName) : (nextPeriod.month || '')) + ' ' + nextPeriod.type;
                    var nextTotals = periodTotals[nextPeriodName] || { amount: 0 };
                    var variance = null;
                    if (totals.amount !== 0) {
                        variance = ((nextTotals.amount - totals.amount) / Math.abs(totals.amount)) * 100;
                    }
                    var badgeColor = '#888', arrow = '–';
                    if (variance !== null && !isNaN(variance)) {
                        if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                        else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                    }

                    connectorHTML += '<div class="totals-connector" style="align-self: center; margin: 0 2px; display: flex; flex-direction: column; align-items: center; min-width: 40px; width: 40px; height: 60px; justify-content: center;">';
                    if (variance === null || isNaN(variance)) {
                       connectorHTML += '<span style="color: #888; font-size: 16px; font-weight: bold; text-align: center;">0%</span>';
                    } else {
                       connectorHTML += '<span style="font-size: 22px; font-weight: bold; color: ' + badgeColor + '; line-height: 1;">' + arrow + '</span>';
                       connectorHTML += '<span style="font-size: 18px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">' + Math.abs(variance).toFixed(1) + '</span>';
                       connectorHTML += '<span style="font-size: 16px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">%</span>';
                    }
                    connectorHTML += '</div>';
                }

                // NO wrapper - render card + connector as direct children (same as live React.Fragment)
                totalsHTML += cardHTML + connectorHTML;
            });
            
            totalsHTML += '</div>';
            totalsContainer.innerHTML = totalsHTML;

            return {
                totalsHTML: totalsHTML,
                periodTotals: periodTotals,
                periodNames: periodsToUse.map(function(period) {
                    return period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                })
            };
        }

        function createTotalsFallbackSummary(title, totalsResult) {
            if (!totalsResult || !totalsResult.periodNames || totalsResult.periodNames.length === 0) {
                return '<div style="padding:24px;text-align:center;font-size:14px;color:#6b7280;">No summary data available.</div>';
            }

            var html = '<div style="padding:20px;background:#f8fafc;border:1px solid #dbeafe;border-radius:8px;">';
            html += '<h3 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#1f2937;text-align:center;">' + title + '</h3>';
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">';

            totalsResult.periodNames.forEach(function(name) {
                var totals = totalsResult.periodTotals[name] || { amount: 0, percentOfSales: 0, perKg: 0 };
                html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">';
                html += '<div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:6px;">' + name + '</div>';
                html += '<div style="font-size:13px;color:#374151;margin-bottom:4px;">' + getUAEDirhamSymbolHTML() + ' ' + (totals.amount / 1000000).toFixed(2) + 'M</div>';
                html += '<div style="font-size:12px;color:#4b5563;margin-bottom:2px;">' + totals.percentOfSales.toFixed(1) + '% of sales</div>';
                html += '<div style="font-size:12px;color:#4b5563;">' + getUAEDirhamSymbolHTML() + ' ' + totals.perKg.toFixed(1) + ' per kg</div>';
                html += '</div>';
            });

            html += '</div></div>';
            return html;
        }

        // EXACT same chart options as original BelowGPExpensesChart.tsx
        function getBelowGPExpensesOption() {
            // EXACT same below GP ledgers as original
            var BELOW_GP_LEDGERS = {
                SELLING_EXPENSES: { label: 'Selling expenses', rowIndex: 31 },
                TRANSPORTATION: { label: 'Transportation', rowIndex: 32 },
                ADMINISTRATION: { label: 'Administration', rowIndex: 40 },
                BANK_INTEREST: { label: 'Bank interest', rowIndex: 42 },
                TOTAL_BELOW_GP_EXPENSES: { label: 'Total Below GP Expenses', rowIndex: 52 }
            };
            
            // EXACT same color schemes as original
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
            
            // Get all ledger items except the total - EXACT same as original
            var ledgerItems = Object.values(BELOW_GP_LEDGERS).filter(function(item) {
                return item !== BELOW_GP_LEDGERS.TOTAL_BELOW_GP_EXPENSES;
            });
            
            // Limit to 5 periods max - EXACT same as original
            var periodsToUse = visiblePeriods.slice(0, 5);
            
            // EXACT same data processing as original
            var ledgersData = {};
            var periodTotals = {};
            
            // Calculate all period names - EXACT same as original
            var allPeriodNames = periodsToUse.map(function(period) {
                return period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
            });
            
            // Initialize data structure - EXACT same as original
            ledgerItems.forEach(function(ledger) {
                ledgersData[ledger.label] = { label: ledger.label, values: {} };
                allPeriodNames.forEach(function(periodName) {
                    ledgersData[ledger.label].values[periodName] = {
                        amount: 0,
                        percentOfSales: 0,
                        perKg: 0
                    };
                });
            });
            
            // Initialize all period totals - EXACT same as original
            allPeriodNames.forEach(function(periodName) {
                periodTotals[periodName] = {
                    amount: 0,
                    percentOfSales: 0,
                    perKg: 0
                };
            });
            
            // Process each period - EXACT same logic as original
            periodsToUse.forEach(function(period, periodIndex) {
                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                var periodTotal = 0;
                
                ledgerItems.forEach(function(ledger) {
                    // Get the base amount using computeCellValue
                    var amount = computeCellValue(ledger.rowIndex, period);
                    var salesValue = computeCellValue(3, period);
                    var salesVolumeValue = computeCellValue(7, period);
                    
                    // Calculate percent of sales - EXACT same as original
                    var percentOfSales = 0;
                    if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                        percentOfSales = (amount / salesValue) * 100;
                    }
                    
                    // Calculate per kg value - EXACT same as original
                    var perKgValue = 0;
                    if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                        perKgValue = amount / salesVolumeValue;
                    }
                    
                    var validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
                    var validPercentOfSales = typeof percentOfSales === 'number' && !isNaN(percentOfSales) ? percentOfSales : 0;
                    var validPerKg = typeof perKgValue === 'number' && !isNaN(perKgValue) ? perKgValue : 0;
                    
                    ledgersData[ledger.label].values[periodName] = {
                        amount: validAmount,
                        percentOfSales: validPercentOfSales,
                        perKg: validPerKg
                    };
                    
                    periodTotal += validAmount;
                });
                
                periodTotals[periodName] = {
                    amount: periodTotal,
                    percentOfSales: 0,
                    perKg: 0
                };
                
                // Get actual totals from dedicated row - EXACT same as original
                var actualTotal = computeCellValue(BELOW_GP_LEDGERS.TOTAL_BELOW_GP_EXPENSES.rowIndex, period);
                var salesValue = computeCellValue(3, period);
                var salesVolumeValue = computeCellValue(7, period);
                
                var totalPercentOfSales = 0;
                if (typeof salesValue === 'number' && !isNaN(salesValue) && salesValue !== 0) {
                    totalPercentOfSales = (actualTotal / salesValue) * 100;
                }
                
                var totalPerKgValue = 0;
                if (typeof salesVolumeValue === 'number' && !isNaN(salesVolumeValue) && salesVolumeValue !== 0) {
                    totalPerKgValue = actualTotal / salesVolumeValue;
                }
                
                if (typeof actualTotal === 'number' && !isNaN(actualTotal)) {
                    periodTotals[periodName].amount = actualTotal;
                }
                periodTotals[periodName].percentOfSales = totalPercentOfSales;
                periodTotals[periodName].perKg = totalPerKgValue;
            });
            
            // Sort ledgers by average amount - EXACT same as original
            var ledgersList = Object.values(ledgersData);
            ledgersList.sort(function(a, b) {
                var aAvg = Object.values(a.values).reduce(function(sum, val) { return sum + (val.amount || 0); }, 0) / Object.values(a.values).length;
                var bAvg = Object.values(b.values).reduce(function(sum, val) { return sum + (val.amount || 0); }, 0) / Object.values(b.values).length;
                return bAvg - aAvg;
            });
            
            var ledgerLabels = ledgersList.map(function(ledger) { return ledger.label; });
            var periodNames = allPeriodNames;
            
            // Prepare series for each period - EXACT same as original
            var series = periodsToUse.map(function(period, index) {
                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                
                // Get color based on period's customColor - EXACT same logic as original
                var color = resolveStackedBarColor(period, index, defaultColors, colorSchemes);
                
                // Determine if color is dark - EXACT same as original
                    var isColorDark = function(hexColor) {
                    var r = parseInt(hexColor.substring(1, 3), 16);
                    var g = parseInt(hexColor.substring(3, 5), 16);
                    var b = parseInt(hexColor.substring(5, 7), 16);
                    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                };
                
                var textColor = isColorDark(color) ? '#fff' : '#333';
                var useCompactTabletLabels = isTablet && !useVerticalColumns;
                var tabletLineSeparator = useCompactTabletLabels ? '\\n' : '\\n\\n';
                var tabletLabelPadding = useCompactTabletLabels ? [3, 6] : [2, 4];
                var tabletLineHeightValue = useCompactTabletLabels ? 16 : 12;

                return {
                    name: periodName,
                    type: 'bar',
                    stack: 'total',
                    hoverLayerThreshold: Infinity,
                    label: {
                        show: true,
                        position: 'inside',
                        formatter: function(params) {
                            var data = ledgersList.find(function(l) { return l.label === params.name; })?.values[periodName];
                            if (!data) return '';

                            var millionsValue = (data.amount / 1000000).toFixed(2);
                            var percentValue = data.percentOfSales.toFixed(1);
                            var perKgValue = data.perKg.toFixed(1);

                            return '{uae|} ' + millionsValue + 'M' + tabletLineSeparator + percentValue + '%/Sls' + tabletLineSeparator + '{uae|} ' + perKgValue + '/kg';
                        },
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: textColor,
                        backgroundColor: 'transparent',
                        padding: tabletLabelPadding,
                        borderRadius: 0,
                        textBorderWidth: 0,
                        shadowBlur: 0,
                        lineHeight: tabletLineHeightValue,
                        align: 'center',
                        verticalAlign: 'middle',
                        rich: {
                            uae: {
                                width: 10,
                                height: 10,
                                lineHeight: tabletLineHeightValue,
                                padding: useCompactTabletLabels ? [-2, 2, 0, 0] : [-1, 2, 0, 0],
                                align: 'center',
                                verticalAlign: 'top',
                                backgroundColor: {
                                    image: getUAESymbolImageDataURL(textColor)
                                }
                            }
                        }
                    },
                    emphasis: {
                        focus: 'series',
                        blurScope: 'coordinateSystem',
                        label: {
                            fontSize: 11,
                            fontWeight: 'bold'
                        }
                    },
                    data: ledgerLabels.map(function(label) {
                        var ledger = ledgersList.find(function(l) { return l.label === label; });
                        return ledger?.values[periodName]?.amount || 0;
                    }),
                    itemStyle: {
                        color: color,
                        borderRadius: [0, 2, 2, 0]
                    },
                    barWidth: '80%',
                    barGap: '20%',
                    barCategoryGap: '30%'
                };
            });
            
            // Responsive detection aligned with Manufacturing chart
            var width = window.innerWidth;
            var height = window.innerHeight;
            var isMobile = width <= 768;
            var isSmallMobile = width <= 480;
            var isTablet = width > 768 && width <= 992;
            var isPortrait = height > width;
            var useVerticalColumns = isMobile && isPortrait;

            if (useVerticalColumns) {
                var baselineWidth = Math.min(Math.max(width, 320), 768);
                var portraitScale = baselineWidth / 430;
                var labelFontSize = Math.max(10, Math.min(14, Math.round(12 * portraitScale)));
                var axisLabelSize = Math.max(10, Math.min(12, Math.round(11 * portraitScale)));
                var legendFontSize = Math.max(11, Math.min(13, Math.round(12 * portraitScale)));
                var columnWidth = isSmallMobile ? 160 : 180;
                var totalGridWidth = columnWidth * periodsToUse.length;

                var ledgerColors = ['#8B4513', '#FF8C00', '#FFD700', '#4682B4', '#6C5B7B'];

                var verticalSeries = ledgerLabels.map(function(ledgerLabel, ledgerIdx) {
                    var ledgerData = ledgersList.find(function(l) { return l.label === ledgerLabel; });

                    var dataValues = periodsToUse.map(function(period) {
                        var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                        return ledgerData?.values[periodName]?.amount || 0;
                    });

                    var ledgerColor = ledgerColors[ledgerIdx % ledgerColors.length];

                    var isColorDark = function(hexColor) {
                        var r = parseInt(hexColor.substring(1, 3), 16);
                        var g = parseInt(hexColor.substring(3, 5), 16);
                        var b = parseInt(hexColor.substring(5, 7), 16);
                        return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
                    };

                    var textColor = isColorDark(ledgerColor) ? '#fff' : '#333';

                    return {
                        name: ledgerLabel,
                        type: 'bar',
                        stack: 'total',
                        data: dataValues,
                        label: {
                            show: true,
                            position: 'inside',
                            formatter: function(params) {
                                var periodIdx = params.dataIndex;
                                var period = periodsToUse[periodIdx];
                                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                                var data = ledgerData?.values[periodName];
                                if (!data) return '';

                                var percentValue = data.percentOfSales.toFixed(1);
                                if (data.percentOfSales < 3) return '';

                                return percentValue + '%/Sls';
                            },
                            fontSize: labelFontSize,
                            fontWeight: 'bold',
                            color: textColor,
                            lineHeight: labelFontSize + 2
                        },
                        itemStyle: {
                            color: ledgerColor,
                            borderRadius: [2, 2, 0, 0]
                        },
                        barWidth: '85%',
                        barMinHeight: 30
                    };
                });

                return {
                    tooltip: { trigger: 'none', show: false },
                    legend: {
                        data: ledgerLabels,
                        type: 'plain',
                        top: 5,
                        left: 'center',
                        orient: 'horizontal',
                        icon: 'roundRect',
                        itemWidth: 12,
                        itemHeight: 8,
                        itemGap: 8,
                        textStyle: {
                            fontSize: legendFontSize,
                            fontWeight: 'bold',
                            color: '#666'
                        },
                        width: '95%',
                        padding: [5, 10]
                    },
                    grid: {
                        left: 10,
                        right: 10,
                        bottom: 100,
                        top: 70,
                        containLabel: true,
                        width: totalGridWidth
                    },
                    xAxis: {
                        type: 'category',
                        data: periodNames,
                        axisLabel: {
                            fontWeight: 'bold',
                            fontSize: axisLabelSize,
                            color: '#444',
                            rotate: 0,
                            interval: 0,
                            lineHeight: 14,
                            formatter: function(value) {
                                var parts = value.split(' ');
                                if (parts.length >= 3) {
                                    return parts[0] + '\\n' + parts[1] + '\\n' + parts.slice(2).join(' ');
                                } else if (parts.length === 2) {
                                    return parts[0] + '\\n' + parts[1];
                                }
                                return value;
                            }
                        },
                        axisLine: {
                            lineStyle: {
                                color: '#ddd'
                            }
                        },
                        axisTick: { show: false }
                    },
                    yAxis: {
                        type: 'value',
                        show: true,
                        axisLine: { show: false },
                        axisTick: { show: false },
                        axisLabel: { show: false },
                        splitLine: {
                            show: true,
                            lineStyle: {
                                color: '#eee',
                                type: 'dashed'
                            }
                        }
                    },
                    series: verticalSeries
                };
            }

            var legendFontSize = isMobile ? 13 : isTablet ? 14 : 16;
            var axisLabelSize = isMobile ? 12 : isTablet ? 13 : 14;
            var labelFontSize = isMobile ? 14 : isTablet ? 12 : 11;

            return {
                tooltip: { trigger: 'none', show: false },
                legend: {
                    data: periodNames,
                    type: 'scroll',
                    top: 0,
                    left: 'center',
                    icon: 'roundRect',
                    itemWidth: 14,
                    itemHeight: 8,
                    textStyle: {
                        fontSize: legendFontSize,
                        fontWeight: 'bold',
                        color: '#666'
                    },
                    pageIconColor: '#888',
                    pageTextStyle: {
                        color: '#888'
                    }
                },
                grid: {
                    left: isMobile ? '10%' : '5%',
                    right: isMobile ? '3%' : '5%',
                    bottom: '3%',
                    top: '40px',
                    containLabel: true
                },
                xAxis: {
                    show: true,
                    type: 'value',
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    axisLabel: {
                        show: false
                    },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: '#eee',
                            type: 'dashed'
                        }
                    },
                    axisPointer: {
                        show: false
                    }
                },
                yAxis: {
                    type: 'category',
                    data: ledgerLabels,
                    axisLabel: {
                        fontWeight: 'bold',
                        fontSize: axisLabelSize,
                        color: '#444',
                        padding: [0, 20, 0, 0],
                        formatter: function(value) {
                            if (isMobile && value.length > 18) {
                                return value.substring(0, 15) + '...';
                            }
                            if (value.length > 25) {
                                return value.substring(0, 22) + '...';
                            }
                            return value;
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#ddd'
                        }
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: false
                    }
                },
                series: series.map(function(s) {
                    s.label.fontSize = labelFontSize;
                    return s;
                })
            };
        }

        // Divisional KPIs rendering function - uses captured KPI data
        function renderDivisionalKPIs() {
            console.log('renderDivisionalKPIs called - using captured KPI data');
            var contentContainer = document.getElementById('full-divisional-kpis-chart');
            if (!contentContainer) {
                console.error('full-divisional-kpis-chart container not found!');
                return;
            }
            
            var capturedKpiHTML = kpiSummaryHTML;
            contentContainer.innerHTML = capturedKpiHTML;
            
            // Find and move the back button to document.body so it's properly fixed
            var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                console.log('✅ Found back button in captured HTML');
                // Clone the button and append to body for proper fixed positioning
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { 
                    e.preventDefault();
                    hideAllCharts(); 
                };
                // Force visibility with inline styles
                clonedBtn.style.cssText = 'position: fixed !important; top: 16px; right: 16px; display: flex !important; flex-direction: column !important; align-items: center; justify-content: center; gap: 2px; margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.98); color: #1e293b; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); transition: all 0.2s ease; z-index: 9999 !important; line-height: 1.3; text-align: center;';
                clonedBtn.id = 'kpi-back-btn'; // Give it unique ID
                // Remove old button from container
                closeBtn.remove();
                // Add to body
                document.body.appendChild(clonedBtn);
                console.log('✅ Back button moved to document.body and visible');
            } else {
                console.warn('⚠️ Back button not found in captured KPI HTML');
            }
            console.log('Divisional KPIs rendered successfully using captured overlay data with banner');
        }

        // P&L Financial rendering function - uses captured P&L table data
        function renderPLFinancial() {
            console.log('renderPLFinancial called - using captured P&L data');
            var contentContainer = document.getElementById('full-pl-financial-chart');
            if (!contentContainer) {
                console.error('full-pl-financial-chart container not found!');
                return;
            }

            var capturedPLHTML = plFinancialTableHTML;
            contentContainer.innerHTML = capturedPLHTML;
            
            // Find and move back button to document.body
            var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                clonedBtn.style.cssText = 'position: fixed !important; top: 16px; right: 16px; display: flex !important; flex-direction: column !important; align-items: center; justify-content: center; gap: 2px; margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.98); color: #1e293b; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); transition: all 0.2s ease; z-index: 9999 !important; line-height: 1.3; text-align: center;';
                clonedBtn.id = 'kpi-back-btn';
                closeBtn.remove();
                document.body.appendChild(clonedBtn);
            }
            console.log('P&L Financial rendered successfully using captured overlay data with banner');
        }

        // Product Group rendering function - uses captured Product Group table data
        function renderProductGroup() {
            console.log('renderProductGroup called - using captured Product Group data');
            var contentContainer = document.getElementById('full-product-group-chart');
            if (!contentContainer) {
                console.error('full-product-group-chart container not found!');
                return;
            }
            
            var capturedProductGroupHTML = productGroupTableHTML;
            contentContainer.innerHTML = capturedProductGroupHTML;
            
            // Find and move back button to document.body
            var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                clonedBtn.style.cssText = 'position: fixed !important; top: 16px; right: 16px; display: flex !important; flex-direction: column !important; align-items: center; justify-content: center; gap: 2px; margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.98); color: #1e293b; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); transition: all 0.2s ease; z-index: 9999 !important; line-height: 1.3; text-align: center;';
                clonedBtn.id = 'kpi-back-btn';
                closeBtn.remove();
                document.body.appendChild(clonedBtn);
            }
            console.log('Product Group rendered successfully using captured overlay data with banner');
        }

        // Sales by Customer rendering function - uses captured Sales by Customer table data
        function renderSalesCustomer() {
            console.log('renderSalesCustomer called - using captured Sales by Customer data');
            var salesCustomerContainer = document.getElementById('full-sales-customer-chart');
            if (!salesCustomerContainer) {
                console.error('full-sales-customer-chart container not found!');
                return;
            }
            console.log('full-sales-customer-chart container found');

            // Get division name for the title
            var divisionName = getDivisionDisplayName();

            // Use the EXACT same structure as Sales by Country and Sales by Sales Rep
            var capturedSalesCustomerHTML = salesCustomerTableHTML;

            // Determine title based on the Hide Sales Rep setting captured during export
            var titleText = 'Sales by Customer';

            // Check if Sales Rep column is in the captured HTML
            var hasSalesRepColumn = capturedSalesCustomerHTML.includes('Sales Rep') ||
                                   capturedSalesCustomerHTML.includes('sales-rep-header');

            console.log('🔍 DEBUG RENDER: hasSalesRepColumn =', hasSalesRepColumn);

            // Adjust title based on Sales Rep column visibility
            if (hasSalesRepColumn) {
                titleText = 'Sales by Customer & Sales Rep';
            } else {
                titleText = 'Sales by Customer';
            }

            console.log('Title will be:', titleText);

            // Update the blue ribbon header title dynamically
            var headerTitleElement = document.getElementById('sales-customer-header-title');
            if (headerTitleElement) {
                headerTitleElement.textContent = titleText;
                console.log('Updated blue ribbon header title to:', titleText);
            }

            // Replace content with captured overlay
            var contentContainer = document.getElementById('full-sales-customer-chart');
            if (!contentContainer) {
                console.error('full-sales-customer-chart container not found!');
                return;
            }
            
            contentContainer.innerHTML = capturedSalesCustomerHTML;
            
            // Find and move back button to document.body
            var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                clonedBtn.style.cssText = 'position: fixed !important; top: 16px; right: 16px; display: flex !important; flex-direction: column !important; align-items: center; justify-content: center; gap: 2px; margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.98); color: #1e293b; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); transition: all 0.2s ease; z-index: 9999 !important; line-height: 1.3; text-align: center;';
                clonedBtn.id = 'kpi-back-btn';
                closeBtn.remove();
                document.body.appendChild(clonedBtn);
            }
            console.log('✅ Sales by Customer rendered successfully using captured overlay data with banner');
        }

        // Sales by Sales Rep rendering function - uses captured Sales Rep table data
        function renderSalesRep() {
            console.log('renderSalesRep called - using captured Sales Rep data');
            var salesRepContainer = document.getElementById('full-sales-rep-chart');
            if (!salesRepContainer) {
                console.error('full-sales-rep-chart container not found!');
                return;
            }
            console.log('full-sales-rep-chart container found');

            // Get division name for the title
            var divisionName = getDivisionDisplayName();

            // Use the EXACT same structure as Sales by Country
            var capturedSalesRepHTML = salesRepTableHTML;

            // Determine title based on the Hide Budget & Forecast setting captured during export
            var titleText = 'Sales by Sales Reps';

            // Update the blue ribbon header title dynamically
            var headerTitleElement = document.getElementById('sales-rep-header-title');
            if (headerTitleElement) {
                headerTitleElement.textContent = titleText;
                console.log('Updated blue ribbon header title to:', titleText);
            }

            // Replace content with captured overlay
            var contentContainer = document.getElementById('full-sales-rep-chart');
            if (!contentContainer) {
                console.error('full-sales-rep-chart container not found!');
                return;
            }
            
            contentContainer.innerHTML = capturedSalesRepHTML;
            
            // Find and move back button to document.body
            var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                clonedBtn.style.cssText = 'position: fixed !important; top: 16px; right: 16px; display: flex !important; flex-direction: column !important; align-items: center; justify-content: center; gap: 2px; margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.98); color: #1e293b; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); transition: all 0.2s ease; z-index: 9999 !important; line-height: 1.3; text-align: center;';
                clonedBtn.id = 'kpi-back-btn';
                closeBtn.remove();
                document.body.appendChild(clonedBtn);
            }
            console.log('Sales by Sales Rep rendered successfully using captured overlay data with banner');
        }

        // Sales by Countries rendering function - uses captured table data directly
        function renderSalesCountry() {
            console.log('renderSalesCountry called - using captured Sales by Countries table data');
            var salesCountryContainer = document.getElementById('full-sales-country-chart');
            if (!salesCountryContainer) {
                console.error('full-sales-country-chart container not found!');
                return;
            }
            console.log('full-sales-country-chart container found');
            
            // Insert the captured table HTML directly
            salesCountryContainer.innerHTML = salesCountryTableHTML;
            
            // Hide the "Hide Budget & Forecast" checkbox (the label contains the checkbox)
            var hideBudgetLabels = salesCountryContainer.querySelectorAll('label.option-checkbox');
            hideBudgetLabels.forEach(function(label) {
                if (label.textContent && label.textContent.includes('Hide Budget')) {
                    label.style.display = 'none';
                    console.log('Hidden "Hide Budget & Forecast" checkbox');
                }
            });
            
            // Hide the "Back to Main View" button (sub-page navigation, not needed in export)
            var backToMainBtns = salesCountryContainer.querySelectorAll('button');
            backToMainBtns.forEach(function(btn) {
                if (btn.textContent && btn.textContent.includes('Back to Main View')) {
                    btn.style.display = 'none';
                    console.log('Hidden "Back to Main View" button');
                }
            });
            
            // Find the back button in the captured content and make it functional
            var closeBtn = salesCountryContainer.querySelector('.divisional-dashboard__overlay-close');
            if (closeBtn) {
                // Clone the button to remove any old event listeners
                var clonedBtn = closeBtn.cloneNode(true);
                clonedBtn.onclick = function(e) { 
                    e.preventDefault(); 
                    console.log('Back button clicked from Sales by Countries');
                    hideAllCharts(); 
                };
                closeBtn.parentNode.replaceChild(clonedBtn, closeBtn);
                console.log('Back button made functional');
            } else {
                console.warn('No back button found in captured content');
            }
            
            console.log('Sales by Countries rendered successfully with table view');
        }

        // Sales & Volume Analysis rendering function - uses captured overlay + re-initialized EChart
        function renderSalesVolume() {
            console.log('renderSalesVolume called - using captured overlay with re-initialized chart');
            var fullScreenContainer = document.getElementById('full-screen-sales-volume');
            if (!fullScreenContainer) {
                console.error('full-screen-sales-volume container not found!');
                return;
            }
            
            var contentContainer = fullScreenContainer.querySelector('.full-screen-content');
            if (contentContainer) {
                contentContainer.innerHTML = salesVolumeHTML;
                
                // Add functional back button to overlay
                var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
                if (closeBtn) {
                    closeBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                    closeBtn.style.display = 'flex'; // Let CSS handle responsive styling
                }
                
                // Re-initialize the chart as interactive ECharts for hover effects
                setTimeout(function() {
                    var chartContainer = contentContainer.querySelector('.sales-volume-detail__chart-wrapper');
                    if (chartContainer && typeof echarts !== 'undefined') {
                        // Find just the chart canvas/div element, not the entire wrapper
                        var chartArea = chartContainer.querySelector('.sales-volume-chart-area');
                        var existingChart = chartArea ? chartArea.querySelector('.bar-chart, canvas, img') : null;
                        
                        if (existingChart) {
                            // Replace only the chart canvas, preserving overlay values
                            var newChartDiv = document.createElement('div');
                            newChartDiv.id = 'sales-volume-echart';
                            newChartDiv.className = 'bar-chart sales-volume-chart';
                            // Use CSS height (100%) instead of fixed 400px to maintain proper proportions
                            newChartDiv.style.cssText = 'width: 100%; height: 100%;';
                            
                            // Replace the canvas/img with new div
                            existingChart.parentNode.replaceChild(newChartDiv, existingChart);
                            
                            var chartDom = document.getElementById('sales-volume-echart');
                            if (chartDom) {
                                var myChart = echarts.init(chartDom, null, { renderer: 'canvas' });
                                var option = getSalesVolumeOption();
                                myChart.setOption(option);
                                charts['sales-volume'] = myChart;
                                
                                // Handle resize
                                var resizeTimeout;
                                window.addEventListener('resize', function() {
                                    if (charts['sales-volume'] && !charts['sales-volume'].isDisposed()) {
                                        clearTimeout(resizeTimeout);
                                        resizeTimeout = setTimeout(function() {
                                            var newOption = getSalesVolumeOption();
                                            charts['sales-volume'].setOption(newOption, true);
                                            charts['sales-volume'].resize();
                                            console.log('📱 Sales & Volume chart resized');
                                        }, 250);
                                    }
                                });
                                
                                console.log('✅ Sales & Volume chart re-initialized as interactive ECharts');
                            }
                        }
                    }
                }, 500);
                
                console.log('Sales & Volume rendered successfully using captured overlay with banner');
            }
        }

        // Margin Analysis rendering function - uses captured chart overlay
        function renderMarginAnalysis() {
            console.log('renderMarginAnalysis called - using captured chart overlay');
            var fullScreenContainer = document.getElementById('full-screen-margin-analysis');
            if (!fullScreenContainer) {
                console.error('full-screen-margin-analysis container not found!');
                return;
            }
            
            var contentContainer = fullScreenContainer.querySelector('.full-screen-content');
            if (contentContainer) {
                contentContainer.innerHTML = marginAnalysisHTML;
                
                // Add functional back button to overlay
                var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
                if (closeBtn) {
                    closeBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                    closeBtn.style.display = 'flex'; // Let CSS handle responsive styling
                }
                console.log('Margin Analysis rendered successfully using captured overlay with banner');
            }
        }

        // Manufacturing Cost rendering function - builds proper DOM structure with overlay, then initializes interactive ECharts chart
        function renderManufacturingCost() {
            console.log('renderManufacturingCost called - building interactive structure');
            var fullScreenContainer = document.getElementById('full-screen-manufacturing-cost');
            if (!fullScreenContainer) {
                console.error('full-screen-manufacturing-cost container not found!');
                return;
            }
            
            var contentContainer = fullScreenContainer.querySelector('.full-screen-content');
            if (contentContainer) {
                // Extract overlay wrapper from captured HTML if available, otherwise build fresh
                var overlayDiv = null;
                if (manufacturingCostHTML && manufacturingCostHTML.includes('divisional-dashboard__overlay')) {
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = manufacturingCostHTML;
                    overlayDiv = tempDiv.querySelector('.divisional-dashboard__overlay');
                }
                
                // Build the structure - preserve overlay wrapper for banner
                if (overlayDiv) {
                    // Use the overlay wrapper but replace inner content
                    contentContainer.innerHTML = '';
                    var clonedOverlay = overlayDiv.cloneNode(false); // Clone without children
                    
                    // Copy banner if present
                    var banner = overlayDiv.querySelector('.divisional-dashboard__overlay-banner');
                    if (banner) {
                        clonedOverlay.appendChild(banner.cloneNode(true));
                    }
                    
                    // Create fresh gauge panel for interactive chart
                    var gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    clonedOverlay.appendChild(gaugePanel);
                    
                    // Add back button
                    var closeBtn = overlayDiv.querySelector('.divisional-dashboard__overlay-close');
                    if (closeBtn) {
                        var clonedBtn = closeBtn.cloneNode(true);
                        clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                        clonedBtn.style.display = 'flex';
                        clonedOverlay.appendChild(clonedBtn);
                    }
                    
                    contentContainer.appendChild(clonedOverlay);
                } else {
                    // Build fresh structure if no captured overlay
                    contentContainer.innerHTML = '';
                    var gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    contentContainer.appendChild(gaugePanel);
                }
                
                // Get or create gauge panel reference
                var gaugePanel = contentContainer.querySelector('.modern-margin-gauge-panel');
                if (!gaugePanel) {
                    gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    contentContainer.appendChild(gaugePanel);
                }
                
                // Create the chart container - use 600px height to match initializeFullScreenChart
                var chartContainer = document.createElement('div');
                chartContainer.className = 'full-screen-chart-container';
                chartContainer.id = 'full-manufacturing-cost-chart';
                chartContainer.style.cssText = 'width: 100%; height: 600px;';
                gaugePanel.appendChild(chartContainer);
                
                // Create totals container
                var totalsContainer = document.createElement('div');
                totalsContainer.id = 'manufacturing-cost-totals';
                gaugePanel.appendChild(totalsContainer);
                
                console.log('Manufacturing Cost: Chart container ready, ID:', chartContainer.id);
                
                // Render totals first
                renderManufacturingCostTotals();
                
                // Initialize the interactive ECharts chart with hover effects and animation
                setTimeout(function() {
                    var checkContainer = document.getElementById('full-manufacturing-cost-chart');
                    if (!checkContainer) {
                        console.error('Manufacturing Cost: Container #full-manufacturing-cost-chart not found!');
                        return;
                    }
                    
                    if (typeof echarts !== 'undefined') {
                        console.log('Initializing Manufacturing Cost interactive chart...');
                        var myChart = echarts.init(checkContainer, null, { renderer: 'canvas' });
                        var option = getManufacturingCostOption();
                        myChart.setOption(option);
                        charts['manufacturing-cost'] = myChart;
                        
                        // Handle resize
                        var resizeTimeout;
                        window.addEventListener('resize', function() {
                            if (charts['manufacturing-cost'] && !charts['manufacturing-cost'].isDisposed()) {
                                clearTimeout(resizeTimeout);
                                resizeTimeout = setTimeout(function() {
                                    var newOption = getManufacturingCostOption();
                                    charts['manufacturing-cost'].setOption(newOption, true);
                                    charts['manufacturing-cost'].resize();
                                    console.log('📱 Manufacturing Cost chart resized');
                                }, 250);
                            }
                        });
                        
                        console.log('✅ Manufacturing Cost chart initialized with interactive ECharts');
                    } else {
                        console.error('ECharts library not available');
                    }
                }, 100);
                
                console.log('Manufacturing Cost rendered successfully with overlay banner');
            }
        }

        // Below GP Expenses rendering function - builds proper DOM structure with overlay, then initializes interactive ECharts chart
        function renderBelowGPExpenses() {
            console.log('renderBelowGPExpenses called - building interactive structure');
            var fullScreenContainer = document.getElementById('full-screen-below-gp-expenses');
            if (!fullScreenContainer) {
                console.error('full-screen-below-gp-expenses container not found!');
                return;
            }
            
            var contentContainer = fullScreenContainer.querySelector('.full-screen-content');
            if (contentContainer) {
                // Extract overlay wrapper from captured HTML if available, otherwise build fresh
                var overlayDiv = null;
                if (belowGPExpensesHTML && belowGPExpensesHTML.includes('divisional-dashboard__overlay')) {
                    var tempDiv = document.createElement('div');
                    tempDiv.innerHTML = belowGPExpensesHTML;
                    overlayDiv = tempDiv.querySelector('.divisional-dashboard__overlay');
                }
                
                // Build the structure - preserve overlay wrapper for banner
                if (overlayDiv) {
                    // Use the overlay wrapper but replace inner content
                    contentContainer.innerHTML = '';
                    var clonedOverlay = overlayDiv.cloneNode(false); // Clone without children
                    
                    // Copy banner if present
                    var banner = overlayDiv.querySelector('.divisional-dashboard__overlay-banner');
                    if (banner) {
                        clonedOverlay.appendChild(banner.cloneNode(true));
                    }
                    
                    // Create fresh gauge panel for interactive chart
                    var gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    clonedOverlay.appendChild(gaugePanel);
                    
                    // Add back button
                    var closeBtn = overlayDiv.querySelector('.divisional-dashboard__overlay-close');
                    if (closeBtn) {
                        var clonedBtn = closeBtn.cloneNode(true);
                        clonedBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                        clonedBtn.style.display = 'flex';
                        clonedOverlay.appendChild(clonedBtn);
                    }
                    
                    contentContainer.appendChild(clonedOverlay);
                } else {
                    // Build fresh structure if no captured overlay
                    contentContainer.innerHTML = '';
                    var gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    contentContainer.appendChild(gaugePanel);
                }
                
                // Get or create gauge panel reference
                var gaugePanel = contentContainer.querySelector('.modern-margin-gauge-panel');
                if (!gaugePanel) {
                    gaugePanel = document.createElement('div');
                    gaugePanel.className = 'modern-margin-gauge-panel';
                    contentContainer.appendChild(gaugePanel);
                }
                
                // Create the chart container
                var chartContainer = document.createElement('div');
                chartContainer.className = 'full-screen-chart-container';
                chartContainer.id = 'full-below-gp-expenses-chart';
                chartContainer.style.cssText = 'width: 100%; height: 483px;';
                gaugePanel.appendChild(chartContainer);
                
                // Create totals container
                var totalsContainer = document.createElement('div');
                totalsContainer.id = 'below-gp-expenses-totals';
                totalsContainer.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: space-around; align-items: flex-end; gap: 5px; margin-top: 20px; margin-bottom: 0; width: 100%;';
                gaugePanel.appendChild(totalsContainer);
                
                console.log('Below GP Expenses: Chart container ready, ID:', chartContainer.id);
                
                // Render totals first
                renderBelowGPExpensesTotals();
                
                // Initialize the interactive ECharts chart with hover effects and animation
                setTimeout(function() {
                    var checkContainer = document.getElementById('full-below-gp-expenses-chart');
                    if (!checkContainer) {
                        console.error('Below GP Expenses: Container #full-below-gp-expenses-chart not found!');
                        return;
                    }
                    
                    if (typeof echarts !== 'undefined') {
                        console.log('Initializing Below GP Expenses interactive chart...');
                        var myChart = echarts.init(checkContainer, null, { renderer: 'canvas' });
                        var option = getBelowGPExpensesOption();
                        myChart.setOption(option);
                        charts['below-gp-expenses'] = myChart;
                        
                        // Handle resize
                        var resizeTimeout;
                        window.addEventListener('resize', function() {
                            if (charts['below-gp-expenses'] && !charts['below-gp-expenses'].isDisposed()) {
                                clearTimeout(resizeTimeout);
                                resizeTimeout = setTimeout(function() {
                                    var newOption = getBelowGPExpensesOption();
                                    charts['below-gp-expenses'].setOption(newOption, true);
                                    charts['below-gp-expenses'].resize();
                                    console.log('📱 Below GP Expenses chart resized');
                                }, 250);
                            }
                        });
                        
                        console.log('✅ Below GP Expenses chart initialized with interactive ECharts');
                    } else {
                        console.error('ECharts library not available');
                    }
                }, 100);
                
                console.log('Below GP Expenses rendered successfully with overlay banner');
            }
        }

        // Combined Trends rendering function - uses captured chart overlay
        function renderCombinedTrends() {
            console.log('renderCombinedTrends called - using captured chart overlay');
            var fullScreenContainer = document.getElementById('full-screen-combined-trends');
            if (!fullScreenContainer) {
                console.error('full-screen-combined-trends container not found!');
                return;
            }
            
            var contentContainer = fullScreenContainer.querySelector('.full-screen-content');
            if (contentContainer) {
                contentContainer.innerHTML = combinedTrendsHTML;
                
                // Add functional back button to overlay
                var closeBtn = contentContainer.querySelector('.divisional-dashboard__overlay-close');
                if (closeBtn) {
                    closeBtn.onclick = function(e) { e.preventDefault(); hideAllCharts(); };
                    closeBtn.style.display = 'flex'; // Let CSS handle responsive styling
                }
                console.log('Combined Trends rendered successfully using captured overlay with banner');
            }
        }

        // EXACT same as ExpencesChart + Profitchart - Card-based HTML rendering
        function initializeCombinedTrends() {
            console.log('initializeCombinedTrends called');
            
            // Get periods to use
            var periodsToUse = visiblePeriods.slice(0, 5);
            console.log('Periods to use:', periodsToUse.length);
            
            // Color schemes - EXACT same as original
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
            
            var width = window.innerWidth;
            var height = window.innerHeight;
            var isMobile = width <= 768;
            var isPortrait = height > width;
            var useHorizontalScroll = isMobile && isPortrait;
            var cardBaseWidth = 220;
            var connectorBaseWidth = 56;
            var scrollGap = useHorizontalScroll ? 12 : 5;

            function buildRowContainerStart(desktopStyle, mobileAlign, mobileMinWidth, cssClass) {
                var className = cssClass ? ' class="' + cssClass + '"' : '';
                if (useHorizontalScroll) {
                    var align = mobileAlign || 'stretch';
                    var minWidthStyle = mobileMinWidth && mobileMinWidth > 0
                        ? 'width:' + mobileMinWidth + 'px;min-width:' + mobileMinWidth + 'px;'
                        : '';
                    return '<div class="combined-trend-scroll" style="width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:20px 0 0 0;padding:0 16px 16px 16px;box-sizing:border-box;touch-action:pan-y pan-x;">' +
                        '<div' + className + ' style="display:flex;flex-wrap:nowrap;align-items:' + align + ';gap:' + scrollGap + 'px;' + minWidthStyle + '">';
                }
                if (cssClass && !desktopStyle) {
                    return '<div class="' + cssClass + '">';
                }
                return '<div' + className + ' style=' + JSON.stringify(desktopStyle) + '>';
            }

            function buildRowContainerEnd() {
                return useHorizontalScroll ? '</div></div>' : '</div>';
            }

            var cardFlexStyle = useHorizontalScroll
                ? 'flex:0 0 ' + cardBaseWidth + 'px;min-width:' + cardBaseWidth + 'px;max-width:' + cardBaseWidth + 'px;'
                : 'flex:1 1 0;min-width:0;';
            var connectorFlexStyle = useHorizontalScroll
                ? 'flex:0 0 ' + connectorBaseWidth + 'px;min-width:' + connectorBaseWidth + 'px;max-width:' + connectorBaseWidth + 'px;'
                : 'flex:0 0 40px;';

            // Helper function to get period color - EXACT same as original
            function getPeriodColor(period, idx) {
                if (period.customColor) {
                    var scheme = colorSchemes.find(function(s) { return s.name === period.customColor; });
                    if (scheme) {
                        return scheme.primary;
                    }
                }
                
                if (period.month === 'Q1' || period.month === 'Q2' || period.month === 'Q3' || period.month === 'Q4') {
                    return '#FF6B35';
                } else if (period.month === 'January') {
                    return '#FFD700';
                } else if (period.month === 'Year') {
                    return '#288cfa';
                } else if (period.type === 'Budget') {
                    return '#2E865F';
                } else {
                    return defaultColors[idx % defaultColors.length];
                }
            }
            
            // Helper function to calculate variance - EXACT same as original
            function calcVariance(current, prev) {
                if (prev === 0) return null;
                return ((current - prev) / Math.abs(prev)) * 100;
            }
            
            // Render Combined Trends using CSS classes - SINGLE SOURCE OF TRUTH
            var combinedHTML = '<div class="combined-trends-container">';

            // Add Period Legend at the top using inline styles to guarantee horizontal layout
            combinedHTML += '<div class="trend-legend" style="display:flex;flex-direction:row;justify-content:center;align-items:center;gap:20px;margin-bottom:30px;flex-wrap:wrap;">';
            periodsToUse.forEach(function(period, idx) {
                var periodName = period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type;
                var color = getPeriodColor(period, idx);
                combinedHTML += '<div class="trend-legend-item" style="display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;">';
                combinedHTML += '<div class="trend-legend-color" style="width:20px;height:20px;min-width:20px;max-width:20px;background-color:' + color + ';border-radius:4px;flex-shrink:0;"></div>';
                combinedHTML += '<span class="trend-legend-text" style="font-size:14px;font-weight:500;color:#333;white-space:nowrap;">' + periodName + '</span>';
                combinedHTML += '</div>';
            });
            combinedHTML += '</div>';

            // Expenses Trend Section
            combinedHTML += '<h2 class="trend-heading">Expenses Trend</h2>';
            var connectorsCount = Math.max(periodsToUse.length - 1, 0);
            var totalItems = periodsToUse.length + connectorsCount;
            var gapsCount = Math.max(totalItems - 1, 0);
            var mobileRowWidth = (periodsToUse.length * cardBaseWidth) + (connectorsCount * connectorBaseWidth) + (gapsCount * scrollGap);
            combinedHTML += buildRowContainerStart('', 'center', mobileRowWidth, 'trend-cards-row');
            
            // Build expenses cards - EXACT same as ExpencesChart
            var expensesCards = periodsToUse.map(function(period, idx) {
                var value = computeCellValue(52, period); // Total Below GP Expenses
                var sales = computeCellValue(3, period);
                var salesVolume = computeCellValue(7, period);
                var percentOfSales = (typeof sales === 'number' && sales !== 0) ? (value / sales) * 100 : 0;
                var perKg = (typeof salesVolume === 'number' && salesVolume !== 0) ? value / salesVolume : 0;
                
                return {
                    periodName: period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type,
                    value: typeof value === 'number' && !isNaN(value) ? value : 0,
                    percentOfSales: percentOfSales,
                    perKg: perKg,
                    color: getPeriodColor(period, idx),
                    textColor: getPeriodColor(period, idx) === '#FFD700' ? '#333' : '#fff'
                };
            });
            
            // Calculate variances for expenses
            var expensesVariances = expensesCards.map(function(card, idx) {
                if (idx === 0) return null;
                return calcVariance(card.value, expensesCards[idx - 1].value);
            });
            
            // Render expenses cards with variances using CSS classes
            expensesCards.forEach(function(card, idx) {
                // Card with hover effects - using CSS class for layout, inline for dynamic colors
                combinedHTML += '<div class="trend-card hover-card" style="background-color: ' + card.color + '; border-color: ' + card.color + '; color: ' + card.textColor + '; ' + cardFlexStyle + '">';
                combinedHTML += '<div class="trend-card-title" style="color: ' + card.textColor + ';">' + card.periodName + '</div>';
                combinedHTML += '<div class="trend-card-value" style="color: ' + card.textColor + ';">' + getUAEDirhamSymbolHTML() + ' ' + (card.value ? (card.value / 1000000).toFixed(2) + 'M' : '0.00M') + '</div>';
                combinedHTML += '<div class="trend-card-metrics" style="color: ' + card.textColor + ';">';
                combinedHTML += '<div>' + card.percentOfSales.toFixed(1) + '%/Sls</div>';
                combinedHTML += '<div>' + getUAEDirhamSymbolHTML() + ' ' + card.perKg.toFixed(1) + '/kg</div>';
                combinedHTML += '</div></div>';

                // Variance badge between cards OR invisible spacer after last card
                if (idx < expensesCards.length - 1) {
                    var variance = expensesVariances[idx + 1];
                    var varianceClass = variance > 0 ? 'trend-variance-positive' : variance < 0 ? 'trend-variance-negative' : 'trend-variance-neutral';
                    var arrow = variance > 0 ? '▲' : variance < 0 ? '▼' : '–';

                    combinedHTML += '<div class="trend-connector">';
                    if (variance === null || isNaN(variance)) {
                        combinedHTML += '<span class="trend-variance-na">N/A</span>';
                    } else {
                        combinedHTML += '<span class="trend-variance-arrow ' + varianceClass + '">' + arrow + '</span>';
                        combinedHTML += '<span class="trend-variance-value ' + varianceClass + '">' + Math.abs(variance).toFixed(1) + '</span>';
                        combinedHTML += '<span class="trend-variance-percent ' + varianceClass + '">%</span>';
                    }
                    combinedHTML += '</div>';
                } else if (!useHorizontalScroll) {
                    // Add invisible spacer after last card to balance layout
                    combinedHTML += '<div class="trend-spacer"></div>';
                }
            });
            
            combinedHTML += buildRowContainerEnd();
            
            // PROFIT KPIS - EXACT same as Profitchart
            var PROFIT_KPIS = [
                { label: 'Net Profit', rowIndex: 54 },
                { label: 'EBIT', rowIndex: 'calculated', isEBIT: true },
                { label: 'EBITDA', rowIndex: 56 }
            ];
            
            PROFIT_KPIS.forEach(function(kpi, rowIdx) {
                // Build cards for this KPI
                var profitCards = periodsToUse.map(function(period, idx) {
                    var value;
                    if (kpi.isEBIT) {
                        // Calculate EBIT as Net Profit + Bank Interest (Row 54 + Row 42)
                        var netProfit = computeCellValue(54, period);
                        var bankInterest = computeCellValue(42, period);
                        value = (typeof netProfit === 'number' ? netProfit : 0) + (typeof bankInterest === 'number' ? bankInterest : 0);
                    } else {
                        value = computeCellValue(kpi.rowIndex, period);
                    }
                    
                    var sales = computeCellValue(3, period);
                    var salesVolume = computeCellValue(7, period);
                    var percentOfSales = (typeof sales === 'number' && sales !== 0) ? (value / sales) * 100 : 0;
                    var perKg = (typeof salesVolume === 'number' && salesVolume !== 0) ? value / salesVolume : 0;
                    
                    return {
                        periodName: period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type,
                        value: typeof value === 'number' && !isNaN(value) ? value : 0,
                        percentOfSales: percentOfSales,
                        perKg: perKg,
                        color: getPeriodColor(period, idx),
                        textColor: getPeriodColor(period, idx) === '#FFD700' ? '#333' : '#fff'
                    };
                });
                
                // Calculate variances for this KPI
                var profitVariances = profitCards.map(function(card, idx) {
                    if (idx === 0) return null;
                    return calcVariance(card.value, profitCards[idx - 1].value);
                });
                
                // Render HTML for this KPI in same container using CSS classes
                combinedHTML += '<div class="trend-kpi-section" style="margin-bottom: ' + (rowIdx < PROFIT_KPIS.length - 1 ? '30px' : '0') + ';">';
                combinedHTML += '<h2 class="trend-heading">' + kpi.label + ' Trend</h2>';
                combinedHTML += buildRowContainerStart('', 'center', mobileRowWidth, 'trend-cards-row profit-row');
                
                profitCards.forEach(function(card, idx) {
                    // Card with hover effects - using CSS class for layout, inline for dynamic colors
                    combinedHTML += '<div class="trend-card hover-card" style="background-color: ' + card.color + '; border-color: ' + card.color + '; color: ' + card.textColor + '; ' + cardFlexStyle + '">';
                    combinedHTML += '<div class="trend-card-title" style="color: ' + card.textColor + ';">' + card.periodName + '</div>';
                    combinedHTML += '<div class="trend-card-value" style="color: ' + card.textColor + ';">' + getUAEDirhamSymbolHTML() + ' ' + (card.value ? (card.value / 1000000).toFixed(2) + 'M' : '0.00M') + '</div>';
                    combinedHTML += '<div class="trend-card-metrics" style="color: ' + card.textColor + ';">';
                    combinedHTML += '<div>' + card.percentOfSales.toFixed(1) + '%/Sls</div>';
                    combinedHTML += '<div>' + getUAEDirhamSymbolHTML() + ' ' + card.perKg.toFixed(1) + '/kg</div>';
                    combinedHTML += '</div></div>';

                    // Variance badge between cards OR invisible spacer after last card
                    if (idx < profitCards.length - 1) {
                        var variance = profitVariances[idx + 1];
                        var varianceClass = variance > 0 ? 'trend-variance-positive' : variance < 0 ? 'trend-variance-negative' : 'trend-variance-neutral';
                        var arrow = variance > 0 ? '▲' : variance < 0 ? '▼' : '–';

                        combinedHTML += '<div class="trend-connector">';
                        if (variance === null || isNaN(variance)) {
                            combinedHTML += '<span class="trend-variance-na"></span>';
                        } else {
                            combinedHTML += '<span class="trend-variance-arrow ' + varianceClass + '">' + arrow + '</span>';
                            combinedHTML += '<span class="trend-variance-value ' + varianceClass + '">' + Math.abs(variance).toFixed(1) + '</span>';
                            combinedHTML += '<span class="trend-variance-percent ' + varianceClass + '">%</span>';
                        }
                        combinedHTML += '</div>';
                    } else if (!useHorizontalScroll) {
                        // Add invisible spacer after last card to balance layout
                        combinedHTML += '<div class="trend-spacer"></div>';
                    }
                });
                
                combinedHTML += buildRowContainerEnd() + '</div>';
            });
            
            combinedHTML += '</div>';
            
            // Update single container - NO nested containers!
            var expensesContainer = document.getElementById('full-expenses-chart');
            
            if (expensesContainer) {
                expensesContainer.innerHTML = combinedHTML;
                console.log('Combined cards rendered in single container - no nested containers');
            } else {
                console.error('Expenses container not found');
            }
            
            charts['combined-trends'] = true;
            console.log('Combined Trends cards rendering complete');
            
            // Add hover effects after rendering
            setTimeout(function() {
                var hoverCards = document.querySelectorAll('.hover-card');
                hoverCards.forEach(function(card) {
                    card.addEventListener('mouseenter', function() {
                        this.style.transform = 'translateY(-5px) scale(1.05)';
                        this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                    });
                    card.addEventListener('mouseleave', function() {
                        this.style.transform = 'translateY(0px) scale(1)';
                        this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.07)';
                    });
                });
                console.log('Hover effects added to', hoverCards.length, 'cards');
            }, 100);
        }

        function getExpensesOption() {
            var periodsToUse = visiblePeriods.slice(0, 5);
            var expensesData = periodsToUse.map(function(period) {
                return computeCellValue(52, period); // Total Below GP Expenses
            });
            var periodNames = periodsToUse.map(function(period) {
                return period.year + ' ' + (period.month || period.type) + ' ' + period.type;
            });
            
            return {
                title: {
                    text: 'Expenses Trend',
                    left: 'center',
                    textStyle: { fontSize: 16 }
                },
                grid: {
                    left: '8%',
                    right: '8%',
                    bottom: 80,
                    top: 60,
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: periodNames,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 12
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        formatter: function(value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                },
                series: [{
                    data: expensesData,
                    type: 'bar',
                    itemStyle: { color: '#288cfa' }
                }]
            };
        }

        function getProfitOption() {
            var periodsToUse = visiblePeriods.slice(0, 5);
            var profitData = periodsToUse.map(function(period) {
                return computeCellValue(54, period); // Net Profit
            });
            var periodNames = periodsToUse.map(function(period) {
                return period.year + ' ' + (period.month || period.type) + ' ' + period.type;
            });
            
            return {
                title: {
                    text: 'Net Profit Trend',
                    left: 'center',
                    textStyle: { fontSize: 16 }
                },
                grid: {
                    left: '8%',
                    right: '8%',
                    bottom: 80,
                    top: 60,
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: periodNames,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 12
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        formatter: function(value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                },
                series: [{
                    data: profitData,
                    type: 'bar',
                    itemStyle: { color: '#2E865F' }
                }]
            };
        }

        // EXACT same as ExpencesChart - Card-based HTML with growth percentages
        function renderExpensesTrend() {
            console.log('renderExpensesTrend called');
            var expensesTrendContainer = document.getElementById('expenses-trend-section');
            if (!expensesTrendContainer) {
                console.error('expenses-trend-section container not found!');
                return;
            }
            console.log('expenses-trend-section container found');
            
            // EXACT same as ExpencesChart - Row 52 (Total Below GP Expenses)
            var KPI_ROW = 52;
            
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
            
            var periodsToUse = visiblePeriods.slice(0, 5);
            
            // Extract data for each period - EXACT same as ExpencesChart
            var cards = periodsToUse.map(function(period, idx) {
                var value = computeCellValue(KPI_ROW, period);
                var sales = computeCellValue(3, period);
                var salesVolume = computeCellValue(7, period);
                var percentOfSales = (typeof sales === 'number' && sales !== 0) ? (value / sales) * 100 : 0;
                var perKg = (typeof salesVolume === 'number' && salesVolume !== 0) ? value / salesVolume : 0;
                
                // Use period-based colors - EXACT same logic as ExpencesChart
                var color;
                if (period.customColor) {
                    var scheme = colorSchemes.find(function(s) { return s.name === period.customColor; });
                    if (scheme) {
                        color = scheme.primary;
                    }
                } else {
                    if (period.month === 'Q1' || period.month === 'Q2' || period.month === 'Q3' || period.month === 'Q4') {
                        color = '#FF6B35';
                    } else if (period.month === 'January') {
                        color = '#FFD700';
                    } else if (period.month === 'Year') {
                        color = '#288cfa';
                    } else if (period.type === 'Budget') {
                        color = '#2E865F';
                    } else {
                        color = defaultColors[idx % defaultColors.length];
                    }
                }
                
                return {
                    periodName: period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type,
                    value: typeof value === 'number' && !isNaN(value) ? value : 0,
                    percentOfSales: percentOfSales,
                    perKg: perKg,
                    color: color,
                    textColor: color === '#FFD700' ? '#333' : '#fff'
                };
            });
            
            // Calculate variances between cards - EXACT same as ExpencesChart
            var variances = cards.map(function(card, idx) {
                if (idx === 0) return null;
                var prev = cards[idx - 1].value;
                if (prev === 0) return null;
                return ((card.value - prev) / Math.abs(prev)) * 100;
            });
            
            // Render HTML - EXACT same structure as ExpencesChart
            var html = '<div style="margin-top: 60px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); padding: 20px; width: 95%; margin-left: auto; margin-right: auto; box-sizing: border-box;">';
            html += '<h2 style="text-align: center; font-size: 18px; margin-bottom: 20px; color: #333; font-weight: 600;">Expenses Trend</h2>';
            html += '<div style="display: flex; flex-wrap: nowrap; justify-content: space-around; align-items: flex-end; gap: 5px; margin-top: 20px; margin-bottom: 0; width: 100%; padding: 0 24px;">';
            
            cards.forEach(function(card, idx) {
                // Card
                html += '<div style="padding: 12px 15px; border-radius: 6px; background-color: ' + card.color + '; border: 1px solid ' + card.color + '; box-shadow: 0 2px 6px rgba(0,0,0,0.07); min-width: 150px; max-width: 180px; flex: 1; text-align: center; position: relative; overflow: hidden; color: ' + card.textColor + '; display: flex; flex-direction: column; align-items: center;">';
                html += '<div style="font-size: 14px; color: ' + card.textColor + '; font-weight: 500; margin-top: 4px;">' + card.periodName + '</div>';
                html += '<div style="font-weight: bold; font-size: 22px; color: ' + card.textColor + '; margin-top: 8px;">' + getUAEDirhamSymbolHTML() + ' ' + (card.value ? (card.value / 1000000).toFixed(2) + 'M' : '0.00M') + '</div>';
                html += '<div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; color: ' + card.textColor + '; margin-top: 8px; width: 100%;">';
                html += '<div>' + card.percentOfSales.toFixed(1) + '%/Sls</div>';
                html += '<div>' + card.perKg.toFixed(1) + ' per kg</div>';
                html += '</div></div>';
                
                // Variance badge between cards
                if (idx < cards.length - 1) {
                    var variance = variances[idx + 1];
                    var badgeColor = '#888', arrow = '–';
                    if (variance !== null && !isNaN(variance)) {
                        if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                        else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                    }
                    
                    html += '<div style="align-self: center; margin: 0 2px; display: flex; flex-direction: column; align-items: center; min-width: 40px; width: 40px; height: 60px; justify-content: center;">';
                    if (variance === null || isNaN(variance)) {
                        html += '<span style="color: #888; font-size: 16px; font-weight: bold; text-align: center;">N/A</span>';
                    } else {
                        html += '<span style="font-size: 22px; font-weight: bold; color: ' + badgeColor + '; line-height: 1;">' + arrow + '</span>';
                        html += '<span style="font-size: 18px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">' + Math.abs(variance).toFixed(1) + '</span>';
                        html += '<span style="font-size: 16px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">%</span>';
                    }
                    html += '</div>';
                }
            });
            
            html += '</div></div>';
            expensesTrendContainer.innerHTML = html;
            console.log('Expenses Trend HTML rendered, cards count:', cards.length);
        }

        // EXACT same as Profitchart - Card-based HTML with growth percentages
        function renderProfitTrends() {
            console.log('renderProfitTrends called');
            var profitTrendsContainer = document.getElementById('profit-trends-section');
            if (!profitTrendsContainer) {
                console.error('profit-trends-section container not found!');
                return;
            }
            console.log('profit-trends-section container found');
            
            // EXACT same as Profitchart - 3 KPIs
            var PROFIT_KPIS = [
                { label: 'Net Profit', rowIndex: 54 },
                { label: 'EBIT', rowIndex: 'calculated', isEBIT: true },
                { label: 'EBITDA', rowIndex: 56 }
            ];
            
            var colorSchemes = [
                { name: 'blue', label: 'Blue', primary: '#288cfa', secondary: '#103766', isDark: true },
                { name: 'green', label: 'Green', primary: '#2E865F', secondary: '#C6F4D6', isDark: true },
                { name: 'yellow', label: 'Yellow', primary: '#FFD700', secondary: '#FFFDE7', isDark: false },
                { name: 'orange', label: 'Orange', primary: '#FF6B35', secondary: '#FFE0B2', isDark: false },
                { name: 'boldContrast', label: 'Bold Contrast', primary: '#003366', secondary: '#FF0000', isDark: true }
            ];
            var defaultColors = ['#FFD700', '#288cfa', '#003366', '#91cc75', '#5470c6'];
            
            var periodsToUse = visiblePeriods.slice(0, 5);
            
            var html = '<div style="margin-top: 30px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); padding: 20px; width: 95%; margin-left: auto; margin-right: auto; box-sizing: border-box;">';
            
            // Render each KPI - EXACT same as Profitchart
            PROFIT_KPIS.forEach(function(kpi, rowIdx) {
                // Build cards for this KPI
                var cards = periodsToUse.map(function(period, idx) {
                    var value;
                    if (kpi.isEBIT) {
                        // Calculate EBIT as Net Profit + Bank Interest (Row 54 + Row 42)
                        var netProfit = computeCellValue(54, period);
                        var bankInterest = computeCellValue(42, period);
                        value = (typeof netProfit === 'number' ? netProfit : 0) + (typeof bankInterest === 'number' ? bankInterest : 0);
                    } else {
                        value = computeCellValue(kpi.rowIndex, period);
                    }
                    
                    var sales = computeCellValue(3, period);
                    var salesVolume = computeCellValue(7, period);
                    var percentOfSales = (typeof sales === 'number' && sales !== 0) ? (value / sales) * 100 : 0;
                    var perKg = (typeof salesVolume === 'number' && salesVolume !== 0) ? value / salesVolume : 0;
                    
                    // Use period-based colors - EXACT same logic as Profitchart
                    var color;
                    if (period.customColor) {
                        var scheme = colorSchemes.find(function(s) { return s.name === period.customColor; });
                        if (scheme) {
                            color = scheme.primary;
                        }
                    } else {
                        if (period.month === 'Q1' || period.month === 'Q2' || period.month === 'Q3' || period.month === 'Q4') {
                            color = '#FF6B35';
                        } else if (period.month === 'January') {
                            color = '#FFD700';
                        } else if (period.month === 'Year') {
                            color = '#288cfa';
                        } else if (period.type === 'Budget') {
                            color = '#2E865F';
                        } else {
                            color = defaultColors[idx % defaultColors.length];
                        }
                    }
                    
                    return {
                        periodName: period.year + ' ' + (period.isCustomRange ? formatCustomRangeDisplay(period.displayName) : (period.month || '')) + ' ' + period.type,
                        value: typeof value === 'number' && !isNaN(value) ? value : 0,
                        percentOfSales: percentOfSales,
                        perKg: perKg,
                        color: color,
                        textColor: color === '#FFD700' ? '#333' : '#fff'
                    };
                });
                
                // Calculate variances between cards - EXACT same as Profitchart
                var variances = cards.map(function(card, idx) {
                    if (idx === 0) return null;
                    var prev = cards[idx - 1].value;
                    if (prev === 0) return null;
                    return ((card.value - prev) / Math.abs(prev)) * 100;
                });
                
                // Render HTML for this KPI - EXACT same structure as Profitchart
                html += '<div style="margin-bottom: ' + (rowIdx < PROFIT_KPIS.length - 1 ? '30px' : '0') + ';">';
                html += '<h2 style="text-align: center; font-size: 18px; margin-bottom: 20px; color: #333; font-weight: 600;">' + kpi.label + ' Trend</h2>';
                html += '<div style="display: flex; flex-wrap: nowrap; justify-content: space-around; align-items: flex-end; gap: 5px; margin-top: 10px; margin-bottom: 0; width: 100%; padding: 0 24px;">';
                
                cards.forEach(function(card, idx) {
                    // Card
                    html += '<div style="padding: 12px 15px; border-radius: 6px; background-color: ' + card.color + '; border: 1px solid ' + card.color + '; box-shadow: 0 2px 6px rgba(0,0,0,0.07); min-width: 150px; max-width: 180px; flex: 1; text-align: center; position: relative; overflow: hidden; color: ' + card.textColor + '; display: flex; flex-direction: column; align-items: center;">';
                    html += '<div style="font-size: 14px; color: ' + card.textColor + '; font-weight: 500; margin-top: 4px;">' + card.periodName + '</div>';
                    html += '<div style="font-weight: bold; font-size: 22px; color: ' + card.textColor + '; margin-top: 8px;">' + getUAEDirhamSymbolHTML() + ' ' + (card.value ? (card.value / 1000000).toFixed(2) + 'M' : '0.00M') + '</div>';
                    html += '<div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; color: ' + card.textColor + '; margin-top: 8px; width: 100%;">';
                    html += '<div>' + card.percentOfSales.toFixed(1) + '%/Sls</div>';
                    html += '<div>' + card.perKg.toFixed(1) + ' per kg</div>';
                    html += '</div></div>';
                    
                    // Variance badge between cards
                    if (idx < cards.length - 1) {
                        var variance = variances[idx + 1];
                        var badgeColor = '#888', arrow = '–';
                        if (variance !== null && !isNaN(variance)) {
                            if (variance > 0) { badgeColor = '#2E865F'; arrow = '▲'; }
                            else if (variance < 0) { badgeColor = '#cf1322'; arrow = '▼'; }
                        }
                        
                        html += '<div style="align-self: center; margin: 0 2px; display: flex; flex-direction: column; align-items: center; min-width: 40px; width: 40px; height: 60px; justify-content: center;">';
                        if (variance === null || isNaN(variance)) {
                            html += '<span style="color: #888; font-size: 16px; font-weight: bold; text-align: center;"></span>';
                        } else {
                            html += '<span style="font-size: 22px; font-weight: bold; color: ' + badgeColor + '; line-height: 1;">' + arrow + '</span>';
                            html += '<span style="font-size: 18px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">' + Math.abs(variance).toFixed(1) + '</span>';
                            html += '<span style="font-size: 16px; font-weight: bold; color: ' + badgeColor + '; line-height: 1.1;">%</span>';
                        }
                        html += '</div>';
                    }
                });
                
                html += '</div></div>';
            });
            
            html += '</div>';
            profitTrendsContainer.innerHTML = html;
            console.log('Profit Trends HTML rendered, KPIs count:', PROFIT_KPIS.length, 'periods count:', periodsToUse.length);
        }

        // ⚠️ WAIT FOR ECHARTS TO LOAD BEFORE INITIALIZING DATA
        // Retry mechanism to handle slow CDN loading
        // ALWAYS calls callback eventually, even if ECharts fails (tables don't need it)
        function waitForECharts(callback, maxAttempts) {
            maxAttempts = maxAttempts || 50;
            var attempts = 0;

            console.log('⏳ Waiting for ECharts runtime to become available...');

            var checkECharts = setInterval(function() {
                attempts++;

                if (window.echarts) {
                    clearInterval(checkECharts);
                    console.log('✅ ECharts runtime detected after ' + attempts + ' attempt(s)');
                    callback();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkECharts);
                    console.error('❌ ECharts was not detected after ' + maxAttempts + ' attempts');
                    console.warn('⚠️ Charts will not render, but KPI and tables remain available');
                    window.__chartsUnavailable = true;

                    // Show non-destructive banner if not already shown
                    if (!document.querySelector('[data-echarts-error-banner]')) {
                        var banner = document.createElement('div');
                        banner.setAttribute('role', 'alert');
                        banner.setAttribute('data-echarts-error-banner', 'true');
                        banner.style.cssText = 'background:#fff3cd;border:2px solid #ffc107;padding:12px 16px;margin:12px;border-radius:8px;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto;';
                        banner.innerHTML = '⚠️ Note: Interactive charts could not be loaded (CDN timeout). Tables and KPI data below are still available. ' +
                            '<button onclick="location.reload()" style="margin-left:12px;padding:6px 12px;font-size:13px;background:#288cfa;color:white;border:none;border-radius:4px;cursor:pointer;">Retry (Refresh)</button>';
                        document.body.prepend(banner);
                    }

                    // Still call callback to render tables/KPIs (they don't need ECharts)
                    console.log('📊 Proceeding with table/KPI rendering (no ECharts needed)');
                    callback();
                }
            }, 100); // Check every 100ms
        }

        // ⚠️ AUTO-INITIALIZE ALL DATA ON PAGE LOAD
        window.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Page loaded - Waiting for ECharts and initializing data');

            // Wait for ECharts to be available, then initialize all data
            waitForECharts(function() {
                console.log('🎯 Starting data initialization...');

                // Render KPI data immediately on the landing page
                try {
                    renderDivisionalKPIs();
                    console.log('✅ Divisional KPIs rendered');
                } catch (error) {
                    console.error('❌ Error rendering Divisional KPIs:', error);
                }

                // Pre-render all other data so it's ready when user clicks
                try {
                    renderPLFinancial();
                    console.log('✅ P&L Financial rendered');
                } catch (error) {
                    console.error('❌ Error rendering P&L Financial:', error);
                }

                try {
                    renderProductGroup();
                    console.log('✅ Product Group rendered');
                } catch (error) {
                    console.error('❌ Error rendering Product Group:', error);
                }

                try {
                    renderSalesCustomer();
                    console.log('✅ Sales by Customer rendered');
                } catch (error) {
                    console.error('❌ Error rendering Sales by Customer:', error);
                }

                try {
                    renderSalesRep();
                    console.log('✅ Sales by Sales Rep rendered');
                } catch (error) {
                    console.error('❌ Error rendering Sales Rep:', error);
                }

                try {
                    renderSalesCountry();
                    console.log('✅ Sales by Country rendered');
                } catch (error) {
                    console.error('❌ Error rendering Sales by Country:', error);
                }

                try {
                    renderMarginAnalysis();
                    console.log('✅ Margin Analysis rendered with captured overlay');
                } catch (error) {
                    console.error('❌ Error rendering Margin Analysis:', error);
                }

                try {
                    // FIXED: Use renderManufacturingCost() to properly set up interactive chart
                    // Don't insert captured HTML - let the render function handle structure + initialization
                    renderManufacturingCost();
                    console.log('✅ Manufacturing Cost rendered with interactive chart');
                } catch (error) {
                    console.error('❌ Error rendering Manufacturing Cost:', error);
                }

                try {
                    // FIXED: Use renderBelowGPExpenses() to properly set up interactive chart
                    // Don't insert captured HTML - let the render function handle structure + initialization
                    renderBelowGPExpenses();
                    console.log('✅ Below GP Expenses rendered with interactive chart');
                } catch (error) {
                    console.error('❌ Error rendering Below GP Expenses:', error);
                }

                try {
                    // FIXED: Use renderCombinedTrends() to properly use captured overlay HTML with banner
                    // The captured combinedTrendsHTML includes the proper overlay wrapper
                    renderCombinedTrends();
                    console.log('✅ Combined Trends rendered with overlay banner');
                } catch (error) {
                    console.error('❌ Error rendering Combined Trends:', error);
                }

                // Pre-initialize interactive ECharts (Manufacturing Cost, Sales & Volume)
                // Margin Analysis uses captured static overlay - no re-initialization needed
                console.log('📊 Pre-initializing interactive charts...');

                try {
                    var salesVolumeChartInit = initializeFullScreenChart('sales-volume');
                    if (salesVolumeChartInit) {
                        console.log('✅ Sales & Volume chart initialized');
                    }
                } catch (error) {
                    console.error('❌ Error initializing Sales & Volume:', error);
                }

                console.log('🎉 All data initialized and ready!');
            });
        });
    </script>
</body>
</html>`;

      // Create blob and download
      console.log('📄 HTML content length:', html.length);
      
      const blob = new Blob([html], { type: 'text/html' });
      console.log('📦 Blob created:', { size: blob.size, type: blob.type });
      
      const url = URL.createObjectURL(blob);
      console.log('🔗 Object URL created:', url.substring(0, 50) + '...');
      
      const link = document.createElement('a');
      link.href = url;
      
      const fileNameDivision = (selectedDivision || 'Division').replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, ' ').trim();
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `${fileNameDivision} - Comprehensive Report - ${timestamp}.html`;
      
      console.log('📁 Download details:', {
        fileName: link.download,
        blobSize: blob.size,
        url: url.substring(0, 50) + '...'
      });
      
      // Add some attributes to ensure download works
      link.style.display = 'none';
      link.setAttribute('download', link.download);
      
      document.body.appendChild(link);
      console.log('🔽 Triggering download...');
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('✅ Download triggered (no localStorage cleanup needed - using scoped exportState)');
      
      console.log('[SUCCESS] Comprehensive Charts HTML export completed successfully');
      
    } catch (err) {
      console.error('[ERROR] Comprehensive Charts export failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      // Restore original tab before finishing
      await restoreOriginalTab(exportState.originalTabEl, exportState.originalTabName);
      setIsExporting(false);
    }
  };

  return (
    <button
      id="multichart-export-btn"
      onClick={() => {
        console.log('🔥 Export All Charts button clicked');
        handleExport();
      }}
      disabled={isExporting || !dataGenerated}
      className="export-btn html-export"
      style={{ marginLeft: '10px' }}
    >
      {isExporting ? 'Exporting...' : 'Export HTML'}
    </button>
  );
};

export default MultiChartHTMLExport;