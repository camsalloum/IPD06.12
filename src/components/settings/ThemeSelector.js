import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, defaultThemes, editableColorKeys } from '../../contexts/ThemeContext';
import './ThemeSelector.css';

// Utility function to calculate luminance of a color
const getLuminance = (hexColor) => {
  if (!hexColor || !hexColor.startsWith('#')) return 0.5;
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

// Darken a color by percentage
const darkenColor = (hexColor, percent) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#1a1a2e';
  const hex = hexColor.replace('#', '');
  let r = parseInt(hex.substr(0, 2), 16);
  let g = parseInt(hex.substr(2, 2), 16);
  let b = parseInt(hex.substr(4, 2), 16);
  
  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Lighten a color by percentage
const lightenColor = (hexColor, percent) => {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  let r = parseInt(hex.substr(0, 2), 16);
  let g = parseInt(hex.substr(2, 2), 16);
  let b = parseInt(hex.substr(4, 2), 16);
  
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Color Picker Component with pending state indicator
const ColorPicker = ({ colorKey, label, description, value, onChange, themeKey, isPending }) => {
  const inputRef = useRef(null);
  
  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };
  
  return (
    <div className={`color-picker-item ${isPending ? 'pending' : ''}`}>
      <div className="color-picker-info">
        <span className="color-picker-label">
          {label}
          {isPending && <span className="pending-dot" title="Unsaved change">●</span>}
        </span>
        <span className="color-picker-description">{description}</span>
      </div>
      <div className="color-picker-control">
        <div 
          className="color-picker-preview"
          style={{ background: value }}
          onClick={handleClick}
          title="Click to change color"
        >
          <input
            ref={inputRef}
            type="color"
            value={value?.startsWith('#') ? value : '#000000'}
            onChange={(e) => onChange(themeKey, colorKey, e.target.value)}
            className="color-picker-input"
          />
        </div>
        <span className="color-picker-value" onClick={handleClick} style={{ cursor: 'pointer' }}>{value}</span>
      </div>
    </div>
  );
};

const ThemeSelector = () => {
  const { 
    currentTheme, 
    changeTheme, 
    customColors, 
    updateThemeColor, 
    resetThemeColors,
    getMergedThemeColors 
  } = useTheme();
  
  const [expandedTheme, setExpandedTheme] = useState(null);
  const [pendingColors, setPendingColors] = useState({});
  const [saveNotification, setSaveNotification] = useState(null);

  const themeEntries = Object.entries(defaultThemes);

  const handleThemeClick = (key) => {
    changeTheme(key);
  };

  const toggleColorPicker = (e, key) => {
    e.stopPropagation();
    setExpandedTheme(expandedTheme === key ? null : key);
  };

  // Smart color change with auto-contrast adjustment
  const handleSmartColorChange = useCallback((themeKey, colorKey, colorValue) => {
    const newPending = { ...pendingColors };
    if (!newPending[themeKey]) {
      newPending[themeKey] = {};
    }
    newPending[themeKey][colorKey] = colorValue;
    
    // Get current colors (merged + pending)
    const mergedColors = getMergedThemeColors(themeKey) || defaultThemes[themeKey].colors;
    const currentBg = newPending[themeKey]?.background || mergedColors.background;
    const currentText = newPending[themeKey]?.text || mergedColors.text;
    const currentSurface = newPending[themeKey]?.surface || mergedColors.surface;
    
    // Smart contrast adjustment for TEXT changes
    if (colorKey === 'text') {
      const textLuminance = getLuminance(colorValue);
      const bgLuminance = getLuminance(currentBg);
      
      // Calculate contrast ratio
      const lighter = Math.max(textLuminance, bgLuminance);
      const darker = Math.min(textLuminance, bgLuminance);
      const contrastRatio = (lighter + 0.05) / (darker + 0.05);
      
      // If contrast is poor (less than 4.5:1), adjust background
      if (contrastRatio < 4.5) {
        if (textLuminance > 0.5) {
          // Light text - darken background significantly
          newPending[themeKey].background = darkenColor(currentBg, 70);
          newPending[themeKey].surface = darkenColor(currentSurface, 60);
        } else {
          // Dark text - lighten background
          newPending[themeKey].background = lightenColor(currentBg, 70);
          newPending[themeKey].surface = lightenColor(currentSurface, 60);
        }
      }
    }
    
    // Smart contrast adjustment for BACKGROUND changes
    if (colorKey === 'background') {
      const bgLuminance = getLuminance(colorValue);
      const textLuminance = getLuminance(currentText);
      
      // Calculate contrast ratio
      const lighter = Math.max(textLuminance, bgLuminance);
      const darker = Math.min(textLuminance, bgLuminance);
      const contrastRatio = (lighter + 0.05) / (darker + 0.05);
      
      // If contrast is poor, adjust text
      if (contrastRatio < 4.5) {
        if (bgLuminance > 0.5) {
          // Light background needs dark text
          newPending[themeKey].text = '#1a1a2e';
        } else {
          // Dark background needs light text
          newPending[themeKey].text = '#f5f5f7';
        }
      }
      
      // Adjust surface relative to background
      if (bgLuminance > 0.5) {
        newPending[themeKey].surface = darkenColor(colorValue, 8);
      } else {
        newPending[themeKey].surface = lightenColor(colorValue, 12);
      }
    }
    
    // Smart adjustment for SURFACE changes
    if (colorKey === 'surface') {
      const surfaceLuminance = getLuminance(colorValue);
      const textLuminance = getLuminance(currentText);
      
      const lighter = Math.max(textLuminance, surfaceLuminance);
      const darker = Math.min(textLuminance, surfaceLuminance);
      const contrastRatio = (lighter + 0.05) / (darker + 0.05);
      
      if (contrastRatio < 3) {
        if (surfaceLuminance > 0.5) {
          newPending[themeKey].text = '#1a1a2e';
        } else {
          newPending[themeKey].text = '#f5f5f7';
        }
      }
    }
    
    setPendingColors(newPending);
  }, [pendingColors, getMergedThemeColors]);

  // Save pending changes
  const handleSaveChanges = useCallback((themeKey) => {
    if (pendingColors[themeKey]) {
      Object.entries(pendingColors[themeKey]).forEach(([colorKey, colorValue]) => {
        updateThemeColor(themeKey, colorKey, colorValue);
      });
      
      // Clear pending for this theme
      const newPending = { ...pendingColors };
      delete newPending[themeKey];
      setPendingColors(newPending);
      
      // Show save notification
      setSaveNotification(themeKey);
      setTimeout(() => setSaveNotification(null), 2000);
    }
  }, [pendingColors, updateThemeColor]);

  // Cancel pending changes
  const handleCancelChanges = useCallback((themeKey) => {
    const newPending = { ...pendingColors };
    delete newPending[themeKey];
    setPendingColors(newPending);
  }, [pendingColors]);

  // Reset to default theme colors
  const handleResetColors = useCallback((themeKey) => {
    resetThemeColors(themeKey);
    // Also clear any pending
    const newPending = { ...pendingColors };
    delete newPending[themeKey];
    setPendingColors(newPending);
    
    setSaveNotification(`${themeKey}-reset`);
    setTimeout(() => setSaveNotification(null), 2000);
  }, [resetThemeColors, pendingColors]);

  const getThemeColors = (themeKey) => {
    return getMergedThemeColors(themeKey) || defaultThemes[themeKey].colors;
  };

  const hasCustomColors = (themeKey) => {
    return customColors[themeKey] && Object.keys(customColors[themeKey]).length > 0;
  };

  // Check if theme has pending changes
  const hasPendingChanges = (themeKey) => {
    return pendingColors[themeKey] && Object.keys(pendingColors[themeKey]).length > 0;
  };

  // Get preview colors (merged + pending)
  const getPreviewColors = (themeKey) => {
    const merged = getThemeColors(themeKey);
    if (pendingColors[themeKey]) {
      return { ...merged, ...pendingColors[themeKey] };
    }
    return merged;
  };

  // Check if a specific color has pending changes
  const isColorPending = (themeKey, colorKey) => {
    return pendingColors[themeKey]?.[colorKey] !== undefined;
  };

  return (
    <div className="theme-selector">
      <div className="theme-selector-header">
        <h3>🎨 Theme Appearance</h3>
        <p>Choose a theme and customize colors to your preference</p>
        <p className="smart-hint">💡 Smart Contrast: Colors auto-adjust for best readability!</p>
      </div>

      <div className="theme-grid">
        {themeEntries.map(([key, theme], index) => {
          const previewColors = getPreviewColors(key);
          const isExpanded = expandedTheme === key;
          const hasPending = hasPendingChanges(key);
          const hasCustom = hasCustomColors(key);
          
          return (
            <motion.div
              key={key}
              className={`theme-card ${currentTheme === key ? 'active' : ''} ${isExpanded ? 'expanded' : ''} ${hasPending ? 'has-pending' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              layout
            >
              {/* Clickable Theme Selection Area */}
              <div 
                className="theme-card-selectable"
                onClick={() => handleThemeClick(key)}
              >
                {/* Theme Preview */}
                <div 
                  className="theme-preview"
                  style={{ 
                    background: previewColors.background,
                    borderColor: previewColors.border
                  }}
                >
                  {/* Mini Dashboard Preview */}
                  <div 
                    className="preview-header"
                    style={{ background: previewColors.surface }}
                  >
                    <div className="preview-dots">
                      <span style={{ background: previewColors.error }}></span>
                      <span style={{ background: previewColors.warning }}></span>
                      <span style={{ background: previewColors.success }}></span>
                    </div>
                  </div>
                  
                  <div className="preview-content">
                    {/* Sidebar */}
                    <div 
                      className="preview-sidebar"
                      style={{ background: previewColors.surface }}
                    >
                      <div 
                        className="preview-nav-item active"
                        style={{ background: previewColors.primary }}
                      ></div>
                      <div 
                        className="preview-nav-item"
                        style={{ background: previewColors.borderLight }}
                      ></div>
                      <div 
                        className="preview-nav-item"
                        style={{ background: previewColors.borderLight }}
                      ></div>
                    </div>
                    
                    {/* Main Area */}
                    <div className="preview-main">
                      {/* Tab Bar */}
                      <div 
                        className="preview-tabs"
                        style={{ background: previewColors.surface }}
                      >
                        <div 
                          className="preview-tab active"
                          style={{ background: previewColors.primary }}
                        ></div>
                        <div 
                          className="preview-tab"
                          style={{ background: previewColors.tabBg }}
                        ></div>
                        <div 
                          className="preview-tab"
                          style={{ background: previewColors.tabBg }}
                        ></div>
                      </div>
                      
                      {/* Cards */}
                      <div className="preview-cards">
                        <div 
                          className="preview-card"
                          style={{ background: previewColors.surface }}
                        >
                          <div 
                            className="preview-card-header"
                            style={{ background: previewColors.primary, opacity: 0.8 }}
                          ></div>
                        </div>
                        <div 
                          className="preview-card"
                          style={{ background: previewColors.surface }}
                        >
                          <div 
                            className="preview-card-header"
                            style={{ background: previewColors.accent, opacity: 0.8 }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Theme Info */}
                <div className="theme-info">
                  <div className="theme-name">
                    <span className="theme-icon">{theme.icon}</span>
                    <span>{theme.name}</span>
                    {hasCustom && !hasPending && (
                      <span className="customized-badge">Customized</span>
                    )}
                    {hasPending && (
                      <span className="pending-badge">Unsaved</span>
                    )}
                  </div>
                  <p className="theme-description">{theme.description}</p>
                </div>

                {/* Selection Indicator */}
                {currentTheme === key && (
                  <motion.div 
                    className="selected-indicator"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </motion.div>
                )}
              </div>

              {/* Color Swatches with Edit Button */}
              <div className="color-swatches-row">
                <div className="color-swatches">
                  {editableColorKeys.slice(0, 5).map(({ key: colorKey }) => (
                    <div 
                      key={colorKey}
                      className={`swatch ${isColorPending(key, colorKey) ? 'pending' : ''}`}
                      style={{ background: previewColors[colorKey] }}
                      title={colorKey}
                    />
                  ))}
                </div>
                <button 
                  className={`customize-btn ${isExpanded ? 'active' : ''}`}
                  onClick={(e) => toggleColorPicker(e, key)}
                  title="Customize colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  <span>{isExpanded ? 'Close' : 'Customize'}</span>
                </button>
              </div>

              {/* Expanded Color Picker Panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    className="color-picker-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="color-picker-header">
                      <h4>🎨 Customize {theme.name}</h4>
                      <div className="color-picker-actions">
                        {/* Always show Reset button */}
                        <button 
                          className={`reset-colors-btn ${hasCustom || hasPending ? '' : 'disabled'}`}
                          onClick={() => handleResetColors(key)}
                          disabled={!hasCustom && !hasPending}
                          title={hasCustom || hasPending ? "Reset to default colors" : "No customizations to reset"}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                          </svg>
                          Reset
                        </button>
                      </div>
                    </div>
                    
                    {/* Save/Cancel bar when there are pending changes */}
                    {hasPending && (
                      <motion.div 
                        className="pending-changes-bar"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <span className="pending-message">
                          <span className="pending-icon">●</span>
                          You have unsaved color changes
                        </span>
                        <div className="pending-actions">
                          <button 
                            className="cancel-btn"
                            onClick={() => handleCancelChanges(key)}
                          >
                            Cancel
                          </button>
                          <button 
                            className="save-btn"
                            onClick={() => handleSaveChanges(key)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Save Changes
                          </button>
                        </div>
                      </motion.div>
                    )}
                    
                    <div className="color-picker-grid">
                      {editableColorKeys.map(({ key: colorKey, label, description }) => (
                        <ColorPicker
                          key={colorKey}
                          colorKey={colorKey}
                          label={label}
                          description={description}
                          value={previewColors[colorKey]}
                          onChange={handleSmartColorChange}
                          themeKey={key}
                          isPending={isColorPending(key, colorKey)}
                        />
                      ))}
                    </div>
                    
                    {/* Smart contrast info */}
                    <div className="smart-contrast-info">
                      <p>💡 <strong>Smart Contrast:</strong> When you change text or background colors, complementary colors auto-adjust to maintain readability.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Save notification */}
              <AnimatePresence>
                {saveNotification === key && (
                  <motion.div 
                    className="save-notification success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ✓ Colors saved successfully!
                  </motion.div>
                )}
                {saveNotification === `${key}-reset` && (
                  <motion.div 
                    className="save-notification reset"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ↺ Colors reset to default!
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
