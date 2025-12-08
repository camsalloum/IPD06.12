import React, { createContext, useState, useContext, useEffect, useMemo, useRef } from 'react';
import { useExcelData } from './ExcelDataContext';
import { useAuth } from './AuthContext';

const FilterContext = createContext();

export const useFilter = () => useContext(FilterContext);

export const FilterProvider = ({ children }) => {
  const { excelData, selectedDivision } = useExcelData();
  const { user, updatePreferences } = useAuth();
  
  // Track if initial config has been loaded to prevent reloading on navigation
  const configLoadedRef = useRef(false);
  const currentUserIdRef = useRef(null);
  
  // Filter states
  const [availableFilters, setAvailableFilters] = useState({
    years: [],
    months: [],
    types: []
  });
  
  // Column order state - explicitly added by user
  const [columnOrder, setColumnOrder] = useState([]);
  
  // Chart visible columns - track which columns are visible in charts
  const [chartVisibleColumns, setChartVisibleColumns] = useState([]);
  
  // Base period index state
  const [basePeriodIndex, setBasePeriodIndex] = useState(null);
  
  // State to track if data has been generated
  const [dataGenerated, setDataGenerated] = useState(false);
  
  // Column selection state for styling/highlighting
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(null);
  
  // Full year and quarters mapping for aggregation
  const fullYear = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const quarters = {
    'Q1': ['January', 'February', 'March'],
    'Q2': ['April', 'May', 'June'],
    'Q3': ['July', 'August', 'September'],
    'Q4': ['October', 'November', 'December']
  };
  const halfYears = {
    'HY1': ['January', 'February', 'March', 'April', 'May', 'June'],
    'HY2': ['July', 'August', 'September', 'October', 'November', 'December']
  };
  
  // Helper function to check if months are sequential
  const areMonthsSequential = (months) => {
    if (months.length <= 1) return true;
    
    const monthIndices = months.map(month => fullYear.indexOf(month)).sort((a, b) => a - b);
    
    for (let i = 1; i < monthIndices.length; i++) {
      if (monthIndices[i] !== monthIndices[i - 1] + 1) {
        return false;
      }
    }
    return true;
  };

  // Helper function to format month range display
  const formatMonthRange = (months) => {
    if (months.length === 1) {
      return months[0];
    } else if (months.length > 1) {
      const firstMonth = months[0].substring(0, 3); // Jan, Feb, etc.
      const lastMonth = months[months.length - 1].substring(0, 3);
      return `${firstMonth}-${lastMonth}`;
    }
    return '';
  };

  // Function to create custom month range
  const createCustomRange = (year, selectedMonths, type) => {
    // Sort months by their order in the year
    const sortedMonths = selectedMonths.sort((a, b) => 
      fullYear.indexOf(a) - fullYear.indexOf(b)
    );

    // Validate sequential requirement
    if (!areMonthsSequential(sortedMonths)) {
      return { success: false, error: 'Selected months must be sequential (consecutive).' };
    }

    // Create display name and ID
    const displayName = formatMonthRange(sortedMonths);
    const rangeId = `CUSTOM_${sortedMonths.join('_')}`;
    
    const newColumn = {
      year: Number(year),
      month: rangeId, // Use unique ID for custom ranges
      type,
      months: sortedMonths,
      displayName, // Add display name for UI
      isCustomRange: true,
      id: `${year}-${rangeId}-${type}`
    };

    return { success: true, column: newColumn };
  };
  
  // Extract filter options from the Excel data
  useEffect(() => {
    // Hardcoded configuration as per requirements
    const years = Array.from({ length: 11 }, (_, i) => 2020 + i); // 2020 to 2030
    
    const standardPeriods = ["FY", "HY1", "HY2", "Q1", "Q2", "Q3", "Q4"];
    const months = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    const extendedMonths = [...standardPeriods, ...months];
    
    const types = ['Actual', 'Estimate', 'Budget', 'Forecast'];
    
    setAvailableFilters({ years, months: extendedMonths, types });
  }, []); // Run once on mount, no dependencies needed as values are hardcoded
  
  // Function to add a new year dynamically
  const addYear = (newYear) => {
    const yearNum = Number(newYear);
    if (!isNaN(yearNum) && !availableFilters.years.includes(yearNum)) {
      setAvailableFilters(prev => ({
        ...prev,
        years: [...prev.years, yearNum].sort((a, b) => a - b) // Keep sorted ascending for consistency, though UI sorts descending
      }));
      return true;
    }
    return false;
  };

  // Maximum number of columns allowed
  const MAX_COLUMNS = 5;
  
  // Helper function to find available color
  const findAvailableColor = (existingColumns) => {
    const colorSchemes = [
      'blue', 'green', 'yellow', 'orange', 'boldContrast'
    ];
    
    // Get colors already in use
    const usedColors = existingColumns
      .map(col => col.customColor)
      .filter(Boolean);
    
    // Find first color that's not used
    const availableColor = colorSchemes.find(color => !usedColors.includes(color));
    return availableColor || 'blue'; // Default to blue if all colors are used
  };

  // Function to add a column
  const addColumn = (year, month, type, customMonths = null) => {
    // Check if we've already reached the maximum number of columns
    if (columnOrder.length >= MAX_COLUMNS) {
      console.warn(`Maximum number of columns (${MAX_COLUMNS}) reached`);
      return { success: false, error: `Maximum limit of ${MAX_COLUMNS} columns reached.` };
    }

    let newColumn;

    // Handle custom month ranges
    if (customMonths && Array.isArray(customMonths) && customMonths.length > 0) {
      const customResult = createCustomRange(year, customMonths, type);
      if (!customResult.success) {
        return customResult; // Return error from createCustomRange
      }
      newColumn = customResult.column;
    } else {
      // Handle regular periods (existing logic)
      let actualMonths = [];
      if (month === 'FY') actualMonths = fullYear;
      else if (quarters[month]) actualMonths = quarters[month];
      else if (halfYears[month]) actualMonths = halfYears[month];
      else actualMonths = [month];
      
      newColumn = { 
        year: Number(year), 
        month, 
        type, 
        months: actualMonths,
        id: `${year}-${month}-${type}`
      };
    }

    // Check if this column already exists to avoid duplicates
    const exists = columnOrder.some(col => col.id === newColumn.id);
    
    if (!exists) {
      // Find an available color that's not used by other columns
      const availableColor = findAvailableColor(columnOrder);
      newColumn.customColor = availableColor;
      
      setColumnOrder(prev => [...prev, newColumn]);
      return { success: true };
    }
    
    return { success: false, error: 'This column combination already exists.' };
  };
  
  // Function to update column order
  const updateColumnOrder = (newOrder) => {
    setColumnOrder(newOrder);
  };
  
  // Function to remove a column
  const removeColumn = (columnId) => {
    // First find the index of the column to be removed
    const indexToRemove = columnOrder.findIndex(col => col.id === columnId);
    
    // If the column exists and is being removed
    if (indexToRemove !== -1) {
      // Check if the removed column is the base period or affects the base period index
      if (basePeriodIndex !== null) {
        // If we're removing the base period column
        if (indexToRemove === basePeriodIndex) {
          // Clear the base period
          clearBasePeriod();
        } 
        // If we're removing a column before the base period, adjust the index
        else if (indexToRemove < basePeriodIndex) {
          // Decrement the base period
          setBasePeriod(basePeriodIndex - 1);
        }
      }
    }
    
    // Remove the column from the order
    setColumnOrder(prev => prev.filter(col => col.id !== columnId));
  };
  
  // Function to clear all columns
  const clearAllColumns = () => {
    setColumnOrder([]);
    setDataGenerated(false);
  };
  
  // Function to generate data based on selected columns
  const generateData = () => {
    if (columnOrder.length > 0) {
      setDataGenerated(true);
      return true;
    }
    return false;
  };

  // Function to save current selection as standard
  const saveAsStandardSelection = async () => {
    if (columnOrder.length > 0) {
      try {
        // Save both column selection and base period index
        const [columnResponse, basePeriodResponse] = await Promise.all([
          fetch('http://localhost:3001/api/standard-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'standardColumnSelection',
              value: columnOrder
            })
          }),
          // Only save base period if it's set
          basePeriodIndex !== null ? fetch('http://localhost:3001/api/standard-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'basePeriodIndex',
              value: basePeriodIndex
            })
          }) : Promise.resolve({ ok: true })
        ]);
        
        if (columnResponse.ok && basePeriodResponse.ok) {
          console.log('✅ Standard configuration saved to backend (columns + base period)');
          return true;
        } else {
          console.error('Failed to save standard configuration to backend');
          return false;
        }
      } catch (error) {
        console.error('Error saving standard configuration:', error);
        return false;
      }
    }
    return false;
  };

  // Function to save current selection as user preferences
  const saveUserPreferences = async () => {
    if (columnOrder.length > 0) {
      try {
        const result = await updatePreferences({
          period_selection: columnOrder,
          base_period_index: basePeriodIndex,
          chart_visible_columns: chartVisibleColumns
        });
        
        if (result.success) {
          console.log('✅ User preferences saved (columns + base period)');
          return true;
        } else {
          console.error('Failed to save user preferences');
          return false;
        }
      } catch (error) {
        console.error('Error saving user preferences:', error);
        return false;
      }
    }
    return false;
  };

  // Function to clear standard selection
  const clearStandardSelection = async () => {
    try {
      // Clear both column selection and base period index
      const [columnResponse, basePeriodResponse] = await Promise.all([
        fetch('http://localhost:3001/api/standard-config/standardColumnSelection', {
          method: 'DELETE'
        }),
        fetch('http://localhost:3001/api/standard-config/basePeriodIndex', {
          method: 'DELETE'
        })
      ]);
      
      if (columnResponse.ok && basePeriodResponse.ok) {
        console.log('✅ Standard configuration cleared from backend (columns + base period)');
        return true;
      } else {
        console.error('Failed to clear standard configuration from backend');
        return false;
      }
    } catch (error) {
      console.error('Error clearing standard configuration:', error);
      return false;
    }
  };

  // Function to set base period
  const setBasePeriod = async (index) => {
    setBasePeriodIndex(index);
    try {
      await fetch('http://localhost:3001/api/standard-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'basePeriodIndex',
          value: index
        })
      });
      // console.log('Base period saved to backend');
    } catch (error) {
      console.error('Failed to save base period to backend:', error);
    }
  };

  // Function to clear base period
  const clearBasePeriod = async () => {
    setBasePeriodIndex(null);
    try {
      await fetch('http://localhost:3001/api/standard-config/basePeriodIndex', {
        method: 'DELETE'
      });
      // console.log('Base period cleared from backend');
    } catch (error) {
      console.error('Failed to clear base period from backend:', error);
    }
  };

  // Toggle visibility of a column in charts
  const toggleChartColumnVisibility = (columnId) => {
    console.log('🔄 toggleChartColumnVisibility called with:', columnId);
    setChartVisibleColumns(prev => {
      console.log('🔄 Previous visibility:', prev);
      const newVisibility = prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)  // Remove if present (hide)
        : [...prev, columnId];                // Add if not present (show)
      
      console.log('🔄 New visibility:', newVisibility);
      // Save to backend immediately
      saveChartVisibilityToBackend(newVisibility);
      return newVisibility;
    });
  };
  
  // Check if a column is visible in charts - use useCallback to ensure it always has fresh state
  const isColumnVisibleInChart = React.useCallback((columnId) => {
    return chartVisibleColumns.includes(columnId);
  }, [chartVisibleColumns]);

  // Alias for backward compatibility
  const setSelectedColumn = setSelectedColumnIndex;

  // Load configuration from backend on component mount or when user changes
  useEffect(() => {
    // Only load config if:
    // 1. Config hasn't been loaded yet, OR
    // 2. The user has changed (different user ID)
    const userId = user?.id || user?.username || null;
    
    if (configLoadedRef.current && currentUserIdRef.current === userId) {
      // Config already loaded for this user, don't reload
      console.log('⏩ Skipping config reload - already loaded for this session');
      return;
    }
    
    const loadConfig = async () => {
      try {
        // 1. Fetch Global Config
        let globalConfig = {};
        try {
          const response = await fetch('http://localhost:3001/api/standard-config');
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              globalConfig = result.data;
              console.log('🔍 Loaded global config:', globalConfig);
            }
          }
        } catch (err) {
          console.warn('Failed to load global config:', err);
        }

        // 2. Get User Preferences
        let userPrefs = user?.preferences || {};
        
        // 3. Determine effective config (User > Global > Default)
        const periodSelection = userPrefs.period_selection || globalConfig.standardColumnSelection || [];
        const basePeriod = userPrefs.base_period_index !== undefined ? userPrefs.base_period_index : globalConfig.basePeriodIndex;
        const chartVisibility = userPrefs.chart_visible_columns || globalConfig.chartVisibleColumns || [];

        console.log('⚙️ Effective Config:', { periodSelection, basePeriod, chartVisibility });

        // 4. Process Period Selection (Enrich with months)
        if (Array.isArray(periodSelection)) {
          const enrichedColumns = periodSelection.map(col => {
            const normalized = { ...col, year: Number(col.year) };
            if (normalized.months) return normalized;
            
            if (normalized.month === 'HY1') return { ...normalized, months: halfYears['HY1'] };
            if (normalized.month === 'HY2') return { ...normalized, months: halfYears['HY2'] };
            if (normalized.month === 'Q1') return { ...normalized, months: quarters['Q1'] };
            if (normalized.month === 'Q2') return { ...normalized, months: quarters['Q2'] };
            if (normalized.month === 'Q3') return { ...normalized, months: quarters['Q3'] };
            if (normalized.month === 'Q4') return { ...normalized, months: quarters['Q4'] };
            if (normalized.month === 'Year') return { ...normalized, months: fullYear };
            if (fullYear.includes(normalized.month)) return { ...normalized, months: [normalized.month] };
            
            return normalized;
          });
          setColumnOrder(enrichedColumns);
        } else {
          setColumnOrder([]);
        }

        // 5. Set Chart Visibility
        setChartVisibleColumns(chartVisibility);

        // 6. Set Base Period Index
        setBasePeriodIndex(basePeriod !== undefined && basePeriod !== null ? basePeriod : null);

        // Mark config as loaded for this user
        configLoadedRef.current = true;
        currentUserIdRef.current = userId;
        console.log('✅ Config loaded and cached for session');

      } catch (error) {
        console.error('Error loading configuration:', error);
      }
    };

    loadConfig();
  }, [user]); // Re-run when user changes

  
  // Track previous columnOrder IDs to detect actual new columns (not just re-renders)
  const prevColumnOrderIds = React.useRef([]);
  
  // Update chart visibility when columnOrder changes - ONLY for genuinely new columns
  useEffect(() => {
    const currentIds = columnOrder.map(col => col.id);
    const prevIds = prevColumnOrderIds.current;
    
    // Find columns that are truly new (not present in previous render)
    const trulyNewColumns = currentIds.filter(id => !prevIds.includes(id));
    
    // Update the ref for next comparison
    prevColumnOrderIds.current = currentIds;
    
    setChartVisibleColumns(prev => {
      let updated = [...prev];
      let changed = false;
      
      // Only add TRULY new columns (ones that weren't in the previous columnOrder)
      // This prevents re-adding columns that were manually hidden
      if (trulyNewColumns.length > 0) {
        trulyNewColumns.forEach(id => {
          if (!updated.includes(id)) {
            updated.push(id);
            changed = true;
          }
        });
      }
      
      // Remove columns that no longer exist in columnOrder
      const filtered = updated.filter(id => currentIds.includes(id));
      if (filtered.length !== updated.length) {
        updated = filtered;
        changed = true;
      }
      
      // Only save if something actually changed
      if (changed) {
        saveChartVisibilityToBackend(updated);
      }
      
      return updated;
    });
  }, [columnOrder]);

  // Helper function to save chart visibility to backend
  const saveChartVisibilityToBackend = async (visibility) => {
    try {
      await fetch('http://localhost:3001/api/standard-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'chartVisibleColumns',
          value: visibility
        })
      });
    } catch (error) {
      console.error('Failed to save chart visibility to backend:', error);
    }
  };

  // Values to expose in the context - MEMOIZED to prevent infinite re-renders
  const value = useMemo(() => ({
    availableFilters,
    columnOrder,
    updateColumnOrder,
    addColumn,
    removeColumn,
    clearAllColumns,
    generateData,
    dataGenerated,
    fullYear,
    quarters,
    saveAsStandardSelection,
    clearStandardSelection,
    basePeriodIndex,
    setBasePeriod,
    clearBasePeriod,
    chartVisibleColumns,
    toggleChartColumnVisibility,
    isColumnVisibleInChart,
    // New multi-month range functions
    areMonthsSequential,
    formatMonthRange,
    createCustomRange,
    selectedColumnIndex,
    setSelectedColumnIndex,
    setSelectedColumn,
    // expose selectedDivision so dashboard radio selection is available everywhere
    selectedDivision,
    addYear,
    saveUserPreferences
  }), [
    availableFilters,
    columnOrder,
    updateColumnOrder,
    addColumn,
    removeColumn,
    clearAllColumns,
    generateData,
    dataGenerated,
    fullYear,
    quarters,
    saveAsStandardSelection,
    clearStandardSelection,
    basePeriodIndex,
    setBasePeriod,
    clearBasePeriod,
    chartVisibleColumns,
    toggleChartColumnVisibility,
    isColumnVisibleInChart,
    areMonthsSequential,
    formatMonthRange,
    createCustomRange,
    selectedColumnIndex,
    setSelectedColumnIndex,
    setSelectedColumn,
    selectedDivision,
    saveUserPreferences
  ]);
  
  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};