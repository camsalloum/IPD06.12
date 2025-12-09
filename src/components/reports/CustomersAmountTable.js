import React, { useState, useEffect, useMemo } from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { formatCustomRangeDisplay } from '../../utils/periodHelpers';
import CurrencySymbol from '../dashboard/CurrencySymbol';

const CustomersAmountTable = ({ rep }) => {
  const { columnOrder, basePeriodIndex } = useFilter();
  const { selectedDivision } = useExcelData();
  const [customerData, setCustomerData] = useState({});
  const [loading, setLoading] = useState(false);
  const [transformedData, setTransformedData] = useState([]);
  const [isTransforming, setIsTransforming] = useState(false);

  // Helper function to convert text to proper case
  const toProperCase = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to calculate delta display
  const calculateDeltaDisplay = (newerValue, olderValue) => {
    if (typeof newerValue !== 'number' || typeof olderValue !== 'number') {
      return '-';
    }
    
    if (olderValue === 0) {
      return newerValue > 0 ? { arrow: '🆕', value: 'NEW', color: '#059669' } : '-';
    }
    
    const delta = ((newerValue - olderValue) / olderValue) * 100;
    const absDelta = Math.abs(delta);
    
    let arrow, color;
    if (delta > 0) {
      arrow = '▲';
      color = '#059669';
    } else if (delta < 0) {
      arrow = '▼';
      color = '#dc2626';
    } else {
      arrow = '➖';
      color = '#6b7280';
    }
    
    let formattedValue;
    if (absDelta >= 999.9) {
      formattedValue = '999+%';
    } else if (absDelta >= 99.99) {
      formattedValue = Math.round(absDelta) + '%';
    } else if (absDelta >= 10) {
      formattedValue = absDelta.toFixed(1) + '%';
    } else {
      formattedValue = absDelta.toFixed(2) + '%';
    }
    
    return { arrow, value: formattedValue, color };
  };

  // Helper function to build extended columns with delta columns
  const buildExtendedColumns = (columnOrder) => {
    if (!columnOrder || columnOrder.length === 0) return [];
    const extendedColumns = [];
    for (let i = 0; i < columnOrder.length; i++) {
      extendedColumns.push({ ...columnOrder[i], columnType: 'data', dataIndex: i });
      if (i < columnOrder.length - 1) {
        extendedColumns.push({
          columnType: 'delta',
          fromDataIndex: i,
          toDataIndex: i + 1,
          year: columnOrder[i].year,
          month: columnOrder[i].month,
          type: 'Δ'
        });
      }
    }
    return extendedColumns;
  };

  const extendedColumns = buildExtendedColumns(columnOrder);

  // Helper function to format AED amount
  const formatAED = (value) => {
    if (typeof value !== 'number') return '-';
    if (value === 0) return '0';
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (absValue >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
  };

  // Helper function to format value for total row
  const formatValueForTotal = (value) => {
    if (typeof value !== 'number') return value || '-';
    if (value === 0) return '0';
    return formatAED(value);
  };

  // Load and apply saved merge rules from database (division-wide)
  const applySavedMergeRules = async (salesRep, division, customers, extendedColumns) => {
    const norm = (s) => (s || '').toString().trim().toLowerCase();
    
    try {
      const response = await fetch(`http://localhost:3001/api/division-merge-rules/rules?division=${encodeURIComponent(division)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`✅ Found ${result.data.length} division-wide merge rules for ${division}`);
        
        const processedCustomers = [];
        const mergedGroups = [];
        const processed = new Set();
        
        result.data.forEach((rule) => {
          const originalCustomers = rule.original_customers || [];
          const mergedName = rule.merged_customer_name;
          
          const uniqueOriginalCustomers = [...new Set(originalCustomers.map(c => norm(c)))];
          
          const existingCustomers = [];
          const existingCustomerObjects = [];
          const processedInRule = new Set();
          
          uniqueOriginalCustomers.forEach(normalizedCustomerName => {
            const matchingCustomer = customers.find(c => {
              const normalized = norm(c.name);
              return normalized === normalizedCustomerName && !processedInRule.has(normalized);
            });
            if (matchingCustomer) {
              existingCustomers.push(matchingCustomer.name);
              existingCustomerObjects.push(matchingCustomer);
              processedInRule.add(norm(matchingCustomer.name));
            }
          });
          
          if (existingCustomers.length > 1) {
            existingCustomers.forEach(customerName => {
              processed.add(customerName);
            });
            
            mergedGroups.push(existingCustomers);
            const mergedCustomer = processMergedCustomerGroup(existingCustomers, extendedColumns, customers, mergedName);
            processedCustomers.push(mergedCustomer);
          } else if (existingCustomers.length === 1) {
            const customerName = existingCustomers[0];
            processed.add(customerName);
            
            const singleCustomer = existingCustomerObjects[0];
            if (singleCustomer) {
              const processedSingleCustomer = { ...singleCustomer };
              if (mergedName) {
                processedSingleCustomer.name = toProperCase(mergedName) + '*';
                processedSingleCustomer.originalName = mergedName;
              }
              processedCustomers.push(processedSingleCustomer);
            }
          }
        });
        
        const processedNormalized = new Set();
        processed.forEach(name => {
          processedNormalized.add(norm(name));
        });
        
        const allOriginalCustomersNormalized = new Set();
        result.data.forEach((rule) => {
          const originalCustomers = rule.original_customers || [];
          originalCustomers.forEach(orig => {
            allOriginalCustomersNormalized.add(norm(orig));
          });
        });
        
        const mergedCustomerNamesNormalized = new Set();
        processedCustomers.forEach(customer => {
          if (customer.name && customer.name.endsWith('*')) {
            const withoutAsterisk = customer.name.slice(0, -1).trim();
            mergedCustomerNamesNormalized.add(norm(withoutAsterisk));
          }
        });
        
        customers.forEach(customer => {
          const customerNormalized = norm(customer.name);
          
          if (processedNormalized.has(customerNormalized)) {
            return;
          }
          
          if (mergedCustomerNamesNormalized.has(customerNormalized)) {
            return;
          }
          
          if (allOriginalCustomersNormalized.has(customerNormalized)) {
            return;
          }
          
          processedCustomers.push({ ...customer });
        });
        
        return {
          customers: processedCustomers,
          mergedGroups: mergedGroups
        };
      }
      
      return {
        customers: customers,
        mergedGroups: []
      };
      
    } catch (error) {
      console.error('Error loading saved merge rules:', error);
      return {
        customers: customers,
        mergedGroups: []
      };
    }
  };

  // Process a group of merged customers
  const processMergedCustomerGroup = (customerGroup, extendedColumns, allCustomers, customMergedName = null) => {
    const displayName = customMergedName || customerGroup.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    );
    
    const values = [];
    const dataValues = [];
    
    for (let idx = 0; idx < extendedColumns.length; idx++) {
      const col = extendedColumns[idx];
      
      if (col.columnType === 'data') {
        let aggregatedValue = 0;
        
        customerGroup.forEach(customerName => {
          const customer = allCustomers.find(c => c.name === customerName);
          if (customer && customer.rawValues && customer.rawValues[col.dataIndex] !== undefined) {
            const value = customer.rawValues[col.dataIndex];
            if (typeof value === 'number') {
              aggregatedValue += value;
            }
          }
        });
        
        dataValues.push(aggregatedValue);
        values.push(aggregatedValue);
      }
    }
    
    const finalValues = [];
    let dataIndex = 0;
    
    for (let idx = 0; idx < extendedColumns.length; idx++) {
      const col = extendedColumns[idx];
      
      if (col.columnType === 'data') {
        finalValues.push(values[dataIndex]);
        dataIndex++;
      } else if (col.columnType === 'delta') {
        const newerDataIndex = dataIndex;
        const olderDataIndex = dataIndex - 1;
        
        if (olderDataIndex >= 0 && newerDataIndex < dataValues.length) {
          const newerValue = dataValues[newerDataIndex];
          const olderValue = dataValues[olderDataIndex];
          
          const deltaResult = calculateDeltaDisplay(newerValue, olderValue);
          finalValues.push(deltaResult);
        } else {
          finalValues.push('-');
        }
      }
    }

    return {
      name: toProperCase(displayName) + '*',
      originalName: displayName,
      values: finalValues,
      rawValues: dataValues,
      mergedCustomers: customerGroup,
      isMerged: true
    };
  };

  // Fetch customer sales data from database API (AMOUNT)
  const fetchCustomerSalesData = async (column) => {
    if (!rep || !column) return;
    
    try {
      let months = [];
      if (column.months && Array.isArray(column.months)) {
        const monthMap = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };
        months = column.months.map(m => typeof m === 'string' ? (monthMap[m] || parseInt(m, 10)) : m);
      } else if (column.month === 'Q1') {
        months = [1, 2, 3];
      } else if (column.month === 'Q2') {
        months = [4, 5, 6];
      } else if (column.month === 'Q3') {
        months = [7, 8, 9];
      } else if (column.month === 'Q4') {
        months = [10, 11, 12];
      } else if (column.month === 'Year') {
        months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      } else if (column.month === 'HY1') {
        months = [1, 2, 3, 4, 5, 6];
      } else if (column.month === 'HY2') {
        months = [7, 8, 9, 10, 11, 12];
      } else {
        const monthMap = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };
        months = [monthMap[column.month] || 1];
      }

      const response = await fetch('http://localhost:3001/api/sales-by-customer-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          division: selectedDivision || 'FP',
          salesRep: rep,
          year: column.year,
          months: months,
          dataType: column.type || 'Actual',
          valueType: 'AMOUNT' // Request AMOUNT data for amount table
        })
      });

      const result = await response.json();

      if (result.success) {
        const columnKey = column.id || `${column.year}-${column.month}-${column.type}`;
        setCustomerData(prev => ({
          ...prev,
          [columnKey]: result.data
        }));
      }
    } catch (err) {
      console.error('Failed to load customer amount sales data:', err);
    }
  };

  // Load customer sales data when columns change
  useEffect(() => {
    if (rep && columnOrder.length > 0) {
      setLoading(true);
      columnOrder.forEach(column => {
        fetchCustomerSalesData(column);
      });
      setLoading(false);
    }
  }, [rep, columnOrder, selectedDivision]);

  // Transform data when customer data changes
  useEffect(() => {
    const transformData = async () => {
      if (!customerData || Object.keys(customerData).length === 0 || !columnOrder || columnOrder.length === 0) {
        setTransformedData([]);
        return;
      }
      
      setIsTransforming(true);
      try {
        const result = await transformToCustomerData();
        setTransformedData(result);
        
        // Dispatch event to notify CustomerKeyFacts that amount data is ready
        window.dispatchEvent(new CustomEvent('customersAmountTable:dataReady', {
          detail: {
            rows: result,
            columnOrder: columnOrder
          }
        }));
      } catch (error) {
        console.error('Error transforming customer amount data:', error);
        setTransformedData([]);
      } finally {
        setIsTransforming(false);
      }
    };

    transformData();
  }, [customerData, rep, columnOrder, selectedDivision]);

  // Transform real customer data to display format with customer merging
  const transformToCustomerData = async () => {
    if (!columnOrder || columnOrder.length === 0) return [];
    
    console.log('🔄 transformToCustomerData (AMOUNT) called with:');
    console.log('- columnOrder:', columnOrder);
    console.log('- customerData keys:', Object.keys(customerData || {}));
    
    const customerMap = new Map();
    
    columnOrder.forEach((column, columnIndex) => {
      const columnKey = column.id || `${column.year}-${column.month}-${column.type}`;
      const columnData = customerData[columnKey] || [];
      
      columnData.forEach(customerRecord => {
        const customerName = customerRecord.customer;
        const value = parseFloat(customerRecord.value) || 0;
        
        if (!customerMap.has(customerName)) {
          customerMap.set(customerName, {
            name: customerName,
            rawValues: new Array(columnOrder.length).fill(0),
            values: new Array(extendedColumns.length).fill(0)
          });
        }
        
        const customer = customerMap.get(customerName);
        customer.rawValues[columnIndex] = value;
      });
    });
    
    Array.from(customerMap.values()).forEach(customer => {
      extendedColumns.forEach((col, colIndex) => {
        if (col.columnType === 'data') {
          const rawIndex = col.dataIndex;
          if (rawIndex < customer.rawValues.length) {
            customer.values[colIndex] = customer.rawValues[rawIndex];
          }
        } else if (col.columnType === 'delta') {
          const fromDataIndex = col.fromDataIndex;
          const toDataIndex = col.toDataIndex;
          
          if (fromDataIndex < customer.rawValues.length && toDataIndex < customer.rawValues.length) {
            const fromValue = customer.rawValues[fromDataIndex] || 0;
            const toValue = customer.rawValues[toDataIndex] || 0;
            
            const deltaResult = calculateDeltaDisplay(toValue, fromValue);
            customer.values[colIndex] = deltaResult;
          }
        }
      });
    });
    
    const allCustomers = Array.from(customerMap.values());
    
    console.log('👥 All customers before merging (AMOUNT):', allCustomers.length);
    
    if (rep) {
      try {
        const { customers: mergedCustomers } = await applySavedMergeRules(rep, selectedDivision || 'FP', allCustomers, extendedColumns);
        console.log('🔀 After merge rules applied (AMOUNT):', mergedCustomers.length);
        return mergedCustomers;
      } catch (error) {
        console.error('Error applying merge rules:', error);
        return allCustomers;
      }
    }
    
    return allCustomers;
  };

  // Filter out rows with all zero values
  const filterZeroRows = (data) => {
    return data.filter(row => {
      return extendedColumns.some((col, colIndex) => {
        if (col.columnType === 'data') {
          const val = row.values[colIndex];
          if (typeof val === 'number') {
            return !isNaN(val) && val > 0;
          }
        }
        return false;
      });
    });
  };

  // Sort customers by base period values (highest to lowest)
  const sortedData = useMemo(() => {
    if (!transformedData || transformedData.length === 0) return [];
    
    const filteredData = filterZeroRows(transformedData);
    if (!filteredData || filteredData.length === 0) return [];
    
    if (basePeriodIndex === null || basePeriodIndex < 0 || basePeriodIndex >= columnOrder.length) {
      return filteredData;
    }
    
    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a.rawValues[basePeriodIndex] || 0;
      const bValue = b.rawValues[basePeriodIndex] || 0;
      return bValue - aValue;
    });
    
    return sorted;
  }, [transformedData, extendedColumns, basePeriodIndex, columnOrder]);

  if (loading || isTransforming) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
        <div>Loading customer amount data...</div>
      </div>
    );
  }

  if (!sortedData || sortedData.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
        <div>No customer amount data available</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '40px' }}>
      <h3 style={{ 
        color: '#333', 
        fontSize: '22px', 
        fontWeight: '600', 
        marginBottom: '20px',
        textAlign: 'center',
        padding: '20px',
        background: 'white'
      }}>
        Customer Sales - <CurrencySymbol /> Sales Comparison
      </h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          background: 'white',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          fontSize: '16px',
          border: '1px solid #ddd'
        }}>
          <thead>
            <tr style={{ 
              background: 'linear-gradient(135deg, #059669, #047857)', 
              color: 'white' 
            }}>
              <th rowSpan="3" style={{ 
                padding: '12px', 
                textAlign: 'left', 
                border: '1px solid #ddd', 
                fontWeight: 'bold',
                fontSize: '16px',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: 'white',
                width: '10%',
                minWidth: '80px'
              }}>
                Customer Names
              </th>
              {extendedColumns.map((col, index) => {
                if (col.columnType === 'delta') {
                  return (
                    <th key={index} rowSpan="3" style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      border: '1px solid #ddd', 
                      fontWeight: '700',
                      background: 'white',
                      color: '#856404',
                      fontSize: '15px',
                      width: '4%',
                      minWidth: '35px'
                    }}>
                      Δ<br/>%
                    </th>
                  );
                }
                return (
                  <th key={index} style={{ 
                    padding: '12px 8px', 
                    textAlign: 'center', 
                    border: '1px solid #ddd', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: 'white',
                    verticalAlign: 'middle'
                  }}>
                    {col.year}
                  </th>
                );
              })}
            </tr>
            <tr style={{ 
              background: 'linear-gradient(135deg, #059669, #047857)', 
              color: 'white' 
            }}>
              {extendedColumns.map((col, index) => {
                if (col.columnType === 'delta') return null;
                return (
                  <th key={index} style={{ 
                    padding: '12px 4px', 
                    textAlign: 'center', 
                    border: '1px solid #ddd', 
                    fontWeight: '600',
                    fontSize: '15px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: 'white',
                    verticalAlign: 'middle',
                    width: '6%',
                    minWidth: '50px',
                    lineHeight: '1.3'
                  }}>
                    {col.isCustomRange ? formatCustomRangeDisplay(col.displayName) : col.month}
                  </th>
                );
              })}
            </tr>
            <tr style={{ 
              background: 'linear-gradient(135deg, #059669, #047857)', 
              color: 'white' 
            }}>
              {extendedColumns.map((col, index) => {
                if (col.columnType === 'delta') return null;
                return (
                  <th key={index} style={{ 
                    padding: '12px 4px', 
                    textAlign: 'center', 
                    border: '1px solid #ddd', 
                    fontWeight: '600',
                    fontSize: '15px',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: 'white',
                    verticalAlign: 'middle',
                    width: '6%',
                    minWidth: '50px',
                    lineHeight: '1.3'
                  }}>
                    {col.type}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((customer, idx) => (
              <tr key={idx} style={{ 
                background: 'white' 
              }}>
                <td style={{ 
                  padding: '12px 8px 12px 8px', 
                  border: '1px solid #ddd', 
                  fontWeight: '600',
                  fontSize: '14px',
                  textAlign: 'left',
                  color: '#333',
                  background: 'white',
                  width: '10%',
                  minWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px'
                }} title={toProperCase(String(customer.name || ''))}>
                  {toProperCase(String(customer.name || ''))}
                </td>
                {extendedColumns.map((col, colIdx) => {
                  if (col.columnType === 'delta') {
                    const deltaValue = customer.values[colIdx];
                    if (typeof deltaValue === 'object' && deltaValue !== null) {
                      return (
                      <td key={colIdx} style={{ 
                        padding: '12px 2px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        color: deltaValue.color || '#6b7280',
                        background: 'white',
                        fontWeight: '600',
                        fontSize: '14px',
                        width: '4%',
                        minWidth: '35px'
                      }}>
                        <span style={{ marginRight: '3px', fontSize: '14px', fontWeight: 'bold' }}>{deltaValue.arrow}</span>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>{deltaValue.value}</span>
                      </td>
                      );
                    }
                    return (
                      <td key={colIdx} style={{ 
                        padding: '12px 2px', 
                        border: '1px solid #ddd', 
                        textAlign: 'center',
                        background: 'white',
                        fontWeight: '600',
                        fontSize: '14px',
                        width: '4%',
                        minWidth: '35px'
                      }}>
                        {deltaValue || '-'}
                      </td>
                    );
                  }
                  
                  const value = customer.values[colIdx] || customer.rawValues[col.dataIndex] || 0;
                  return (
                    <td key={colIdx} style={{ 
                      padding: '12px 4px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      fontWeight: '500',
                      fontSize: '14px',
                      color: '#333',
                      background: 'white',
                      width: '6%',
                      minWidth: '50px',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {formatAED(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Total Row */}
            <tr style={{ 
              background: 'linear-gradient(135deg, #059669, #047857)',
              fontWeight: '700' 
            }}>
              <td style={{ 
                padding: '14px 8px 14px 8px', 
                border: '1px solid #ddd', 
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: 'white',
                width: '10%',
                minWidth: '80px'
              }}>
                Total
              </td>
              {extendedColumns.map((col, colIdx) => {
                if (col.columnType === 'delta') {
                  const totalNewer = sortedData.reduce((sum, customer) => 
                    sum + (customer.rawValues[col.toDataIndex] || 0), 0);
                  const totalOlder = sortedData.reduce((sum, customer) => 
                    sum + (customer.rawValues[col.fromDataIndex] || 0), 0);
                  const deltaResult = calculateDeltaDisplay(totalNewer, totalOlder);
                  
                  return (
                    <td key={colIdx} style={{ 
                      padding: '14px 8px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      color: 'white',
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      <span style={{ marginRight: '3px', fontSize: '14px', fontWeight: 'bold' }}>{deltaResult.arrow}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{deltaResult.value}</span>
                    </td>
                  );
                }
                
                const total = sortedData.reduce((sum, customer) => 
                  sum + (customer.rawValues[col.dataIndex] || 0), 0);
                return (
                  <td key={colIdx} style={{ 
                    padding: '14px 8px', 
                    border: '1px solid #ddd', 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {formatValueForTotal(total)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomersAmountTable;
