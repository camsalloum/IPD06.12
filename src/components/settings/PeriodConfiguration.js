import React, { useState, useRef, useMemo } from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getAvailableColorOptions, 
  getColumnColorPalette, 
  getReadableTextColor, 
  lightenColor 
} from '../dashboard/utils/colorUtils';
import './PeriodConfiguration.css';

const PREDEFINED_COLOR_SCHEMES = getAvailableColorOptions();

const PeriodConfiguration = () => {
  const { user } = useAuth();
  const { 
    columnOrder, 
    updateColumnOrder, 
    removeColumn, 
    clearAllColumns, 
    saveAsStandardSelection,
    clearStandardSelection,
    basePeriodIndex,
    setBasePeriod,
    clearBasePeriod,
    chartVisibleColumns,
    toggleChartColumnVisibility,
    isColumnVisibleInChart,
    selectedColumnIndex,
    setSelectedColumnIndex,
    saveUserPreferences, // New function we'll add to FilterContext
    availableFilters,
    addColumn,
    addYear
  } = useFilter();
  
  const [standardSaved, setStandardSaved] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedType, setSelectedType] = useState('Actual');
  const [error, setError] = useState('');

  const colorInputRef = useRef(null);
  
  // Initialize default selections
  React.useEffect(() => {
    if (availableFilters.years.length > 0 && !selectedYear) {
      // Default to current system year if available, otherwise use latest year
      const currentYear = new Date().getFullYear();
      const yearToSelect = availableFilters.years.includes(currentYear) 
        ? currentYear 
        : availableFilters.years[availableFilters.years.length - 1];
      setSelectedYear(yearToSelect);
    }
    if (availableFilters.months.length > 0 && !selectedMonth) {
      setSelectedMonth('FY');
    }
  }, [availableFilters, selectedYear, selectedMonth]);

  const handleAddColumn = () => {
    setError('');
    if (!selectedYear || !selectedMonth || !selectedType) {
      setError('Please select Year, Period, and Type');
      return;
    }
    
    const result = addColumn(selectedYear, selectedMonth, selectedType);
    if (!result.success) {
      setError(result.error || 'Failed to add column');
    }
  };

  const handleAddYear = () => {
    if (newYear && !isNaN(newYear)) {
      const success = addYear(newYear);
      if (success) {
        setSelectedYear(Number(newYear));
        setNewYear('');
      } else {
        setError('Invalid year or year already exists');
      }
    }
  };

  // Native HTML5 drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Native HTML5 drag-and-drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    if (sourceIndex === null || sourceIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    
    const newOrder = Array.from(columnOrder);
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    updateColumnOrder(newOrder);
    
    // Update selectedColumnIndex if needed
    if (selectedColumnIndex !== null) {
      if (sourceIndex === selectedColumnIndex) {
        setSelectedColumnIndex(dropIndex);
      } else if (sourceIndex < selectedColumnIndex && dropIndex >= selectedColumnIndex) {
        setSelectedColumnIndex(selectedColumnIndex - 1);
      } else if (sourceIndex > selectedColumnIndex && dropIndex <= selectedColumnIndex) {
        setSelectedColumnIndex(selectedColumnIndex + 1);
      }
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  const selectedColumn = useMemo(() => (
    selectedColumnIndex !== null ? columnOrder[selectedColumnIndex] : null
  ), [selectedColumnIndex, columnOrder]);

  // Get background color for column (for inline styling)
  const getColumnStyle = (column, isSelected = false) => {
    const baseStyle = { fontWeight: 'bold' };
    const palette = getColumnColorPalette(column);
    return {
      ...baseStyle,
      backgroundColor: palette.primary,
      color: palette.text,
      boxShadow: isSelected ? '0 0 5px 2px rgba(0,0,0,0.3)' : 'none'
    };
  };
  
  // Handle column click to select it
  const handleColumnClick = (index) => {
    setSelectedColumnIndex(index === selectedColumnIndex ? null : index);
  };
  
  // Handle remove column
  const handleRemoveColumn = () => {
    if (selectedColumnIndex !== null) {
      removeColumn(columnOrder[selectedColumnIndex].id);
      setSelectedColumnIndex(null);
    }
  };
  
  // Set custom color for the selected column
  const setColumnColor = (colorScheme) => {
    if (selectedColumnIndex !== null) {
      const newOrder = [...columnOrder];
      const updatedColumn = {
        ...newOrder[selectedColumnIndex]
      };

      if (colorScheme === 'custom') {
        if (colorInputRef.current) {
          colorInputRef.current.click();
        }
        return;
      }

      updatedColumn.customColor = colorScheme;
      delete updatedColumn.customColorHex;
      delete updatedColumn.customColorText;
      delete updatedColumn.customColorLight;
      delete updatedColumn.customColorSecondary;
      newOrder[selectedColumnIndex] = updatedColumn;
      updateColumnOrder(newOrder);
    }
  };

  const applyCustomColor = (hexValue) => {
    if (selectedColumnIndex === null || !hexValue) return;
    const colorHex = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
    const newOrder = [...columnOrder];
    const updatedColumn = {
      ...newOrder[selectedColumnIndex],
      customColor: 'custom',
      customColorHex: colorHex.toUpperCase(),
      customColorText: getReadableTextColor(colorHex),
      customColorLight: lightenColor(colorHex, 0.78),
      customColorSecondary: lightenColor(colorHex, 0.4)
    };
    newOrder[selectedColumnIndex] = updatedColumn;
    updateColumnOrder(newOrder);
  };

  const handleCustomColorInput = (event) => {
    const value = event?.target?.value;
    if (value) {
      applyCustomColor(value);
    }
  };

  const handleCustomColorButton = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };
  
  // Handle saving as standard selection (Admin only)
  const handleSaveAsStandard = async () => {
    try {
      const success = await saveAsStandardSelection();
      if (success) {
        setStandardSaved(true);
        setTimeout(() => setStandardSaved(false), 2000);
      } else {
        alert('Failed to save standard configuration.');
      }
    } catch (error) {
      console.error('Error saving standard configuration:', error);
      alert('Failed to save standard configuration.');
    }
  };

  // Handle saving user preferences
  const handleSavePreferences = async () => {
    try {
      const success = await saveUserPreferences();
      if (success) {
        setPreferencesSaved(true);
        setTimeout(() => setPreferencesSaved(false), 2000);
      } else {
        alert('Failed to save preferences.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences.');
    }
  };

  return (
    <div className="period-config-container">
      <div className="config-controls">
        <div className="control-group">
          <label>Year:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="config-select"
          >
            {availableFilters.years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="add-year-control">
            <input 
              type="number" 
              placeholder="Add Year" 
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="year-input"
            />
            <button onClick={handleAddYear} className="btn-small">+</button>
          </div>
        </div>

        <div className="control-group">
          <label>Period:</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="config-select"
          >
            {availableFilters.months.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Type:</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="config-select"
          >
            {availableFilters.types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <button onClick={handleAddColumn} className="btn-add-column">
          Add Column
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="column-config-container" style={{ marginTop: '20px' }}>
        <div className="column-config-header">
          <div className="header-title-actions">
            <h3>Active Columns</h3>
            <div className="header-buttons-container">
              <button 
                onClick={handleSavePreferences} 
                className={`save-pref-btn ${preferencesSaved ? 'saved' : ''}`}
              >
                {preferencesSaved ? 'Preferences Saved!' : 'Save My Preferences'}
              </button>
              
              {user?.role === 'admin' && (
                <button 
                  onClick={handleSaveAsStandard} 
                  className={`standard-btn ${standardSaved ? 'saved' : ''}`}
                  title="Save as default for all users"
                >
                  {standardSaved ? 'Saved as Global Default!' : 'Save as Global Default'}
                </button>
              )}
              
              {columnOrder.length > 0 && (
                <button onClick={clearAllColumns} className="clear-all-btn">
                  Clear All
                </button>
              )}
            </div>
          </div>
          
          {selectedColumnIndex !== null && (
            <div className="column-actions">
              <button onClick={handleRemoveColumn} className="remove-btn">
                Remove
              </button>
              <div className="color-selector">
                <span>Color Scheme:</span>
                <div className="color-options">
                  {PREDEFINED_COLOR_SCHEMES.map((scheme) => {
                    const isSelected = !!selectedColumn && !selectedColumn.customColorHex && selectedColumn.customColor === scheme.name;
                    return (
                      <div 
                        key={scheme.name} 
                        className={`color-option${isSelected ? ' selected' : ''}`}
                        style={{ 
                          backgroundColor: scheme.primary,
                          borderColor: scheme.secondary || scheme.primary
                        }}
                        onClick={() => setColumnColor(scheme.name)}
                        title={scheme.label}
                      />
                    );
                  })}
                  <div
                    className={`color-option custom-option${selectedColumn?.customColorHex ? ' selected' : ''}`}
                    onClick={handleCustomColorButton}
                    title="Custom Color"
                    style={{
                      backgroundColor: selectedColumn?.customColorHex || 'transparent',
                      borderColor: selectedColumn?.customColorHex ? selectedColumn.customColorHex : '#ccc'
                    }}
                  >
                    {!selectedColumn?.customColorHex && <span>+</span>}
                  </div>
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="color-picker-input"
                    onChange={handleCustomColorInput}
                    value={selectedColumn?.customColorHex || '#288cfa'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="config-grid">
          {columnOrder.length > 0 ? (
            <>
              <div
                className="columns-display-section"
                style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
              >
                <div className="config-row year-row">
                  {columnOrder.map((column, index) => (
                    <div
                      key={column.id || index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`config-column ${selectedColumnIndex === index ? 'selected' : ''} ${dragOverIndex === index ? 'drag-over' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                      style={{
                        ...getColumnStyle(column, selectedColumnIndex === index),
                        cursor: 'grab',
                        opacity: draggedIndex === index ? 0.5 : 1,
                        border: dragOverIndex === index ? '2px dashed #007bff' : undefined
                      }}
                      onClick={() => handleColumnClick(index)}
                    >
                      {column.year}
                    </div>
                  ))}
                </div>
                <div className="config-row period-row">
                  {columnOrder.map((column, index) => (
                    <div
                      key={`period-${index}`}
                      className={`config-column ${selectedColumnIndex === index ? 'selected' : ''}`}
                      style={getColumnStyle(column, selectedColumnIndex === index)}
                      onClick={() => handleColumnClick(index)}
                    >
                      {column.isCustomRange ? column.displayName : column.month}
                    </div>
                  ))}
                </div>
                <div className="config-row type-row">
                  {columnOrder.map((column, index) => (
                    <div
                      key={`type-${index}`}
                      className={`config-column ${selectedColumnIndex === index ? 'selected' : ''}`}
                      style={getColumnStyle(column, selectedColumnIndex === index)}
                      onClick={() => handleColumnClick(index)}
                    >
                      {column.type}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Options Sections - Cards Layout */}
              <div className="options-cards-container">
                {/* Base Period Card */}
                <div className="option-card">
                  <div className="option-card-header">
                    <span className="option-icon">★</span>
                    <h4>Base Period for Comparisons</h4>
                  </div>
                  <p className="option-description">Select one column as the reference point for variance calculations</p>
                  <div className="option-selectors base-period-selectors">
                    {columnOrder.map((column, index) => {
                      const palette = getColumnColorPalette(column);
                      const isSelected = basePeriodIndex === index;
                      return (
                        <div
                          key={`base-period-${index}`}
                          className={`option-selector base-period-item${isSelected ? ' selected' : ''}`}
                          onClick={() => setBasePeriod(index)}
                          title={isSelected ? 'Currently selected as base period' : 'Click to set as base period'}
                          style={{ 
                            backgroundColor: palette.primary, 
                            color: palette.text,
                            border: isSelected ? '4px solid #ffffff' : '2px solid rgba(0,0,0,0.15)',
                            boxShadow: isSelected 
                              ? `0 0 0 3px ${palette.primary}, 0 4px 20px rgba(0,0,0,0.35)` 
                              : '0 2px 4px rgba(0,0,0,0.1)',
                            transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                            filter: isSelected ? 'brightness(1.1)' : 'brightness(0.95)'
                          }}
                        >
                          <span className="selector-icon" style={{ fontSize: isSelected ? '20px' : '16px' }}>
                            {isSelected ? '★' : '☆'}
                          </span>
                          <span className="selector-label">{column.year} {column.isCustomRange ? column.displayName : column.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Chart Visibility Card */}
                <div className="option-card">
                  <div className="option-card-header">
                    <span className="option-icon">📊</span>
                    <h4>Chart Column Visibility</h4>
                  </div>
                  <p className="option-description">Toggle which columns appear in charts and visualizations</p>
                  <div className="option-selectors chart-visibility-selectors">
                    {columnOrder.map((column, index) => {
                      const palette = getColumnColorPalette(column);
                      const isVisible = isColumnVisibleInChart(column.id);
                      return (
                        <div
                          key={`chart-visibility-${index}`}
                          className={`option-selector chart-visibility-item${isVisible ? ' visible' : ' hidden'}`}
                          onClick={() => toggleChartColumnVisibility(column.id)}
                          title={isVisible ? 'Visible in Chart (click to hide)' : 'Hidden from Chart (click to show)'}
                          style={{ 
                            backgroundColor: isVisible ? palette.primary : '#e5e7eb',
                            color: isVisible ? palette.text : '#9ca3af',
                            border: isVisible ? '4px solid #ffffff' : '2px dashed #d1d5db',
                            boxShadow: isVisible 
                              ? `0 0 0 3px ${palette.primary}, 0 4px 20px rgba(0,0,0,0.35)` 
                              : '0 1px 2px rgba(0,0,0,0.05)',
                            transform: isVisible ? 'scale(1.05)' : 'scale(0.95)',
                            filter: isVisible ? 'brightness(1.1)' : 'grayscale(0.5)'
                          }}
                        >
                          <span className="selector-icon" style={{ fontSize: isVisible ? '20px' : '14px', fontWeight: isVisible ? 'bold' : 'normal' }}>
                            {isVisible ? '✓' : '✗'}
                          </span>
                          <span className="selector-label">{column.year} {column.isCustomRange ? column.displayName : column.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="no-columns-message">
              <span className="no-columns-icon">📋</span>
              <p>No columns configured yet</p>
              <span className="no-columns-hint">Use the controls above to add columns to your report</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeriodConfiguration;
