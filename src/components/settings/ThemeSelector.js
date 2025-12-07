import React from 'react';
import { motion } from 'framer-motion';
import { useTheme, themes } from '../../contexts/ThemeContext';
import './ThemeSelector.css';

const ThemeSelector = () => {
  const { currentTheme, changeTheme } = useTheme();

  const themeEntries = Object.entries(themes);

  return (
    <div className="theme-selector">
      <div className="theme-selector-header">
        <h3>🎨 Theme Appearance</h3>
        <p>Choose a theme that suits your preference</p>
      </div>

      <div className="theme-grid">
        {themeEntries.map(([key, theme], index) => (
          <motion.div
            key={key}
            className={`theme-card ${currentTheme === key ? 'active' : ''}`}
            onClick={() => changeTheme(key)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Theme Preview */}
            <div 
              className="theme-preview"
              style={{ 
                background: theme.colors.background,
                borderColor: theme.colors.border
              }}
            >
              {/* Mini Dashboard Preview */}
              <div 
                className="preview-header"
                style={{ background: theme.colors.surface }}
              >
                <div className="preview-dots">
                  <span style={{ background: theme.colors.error }}></span>
                  <span style={{ background: theme.colors.warning }}></span>
                  <span style={{ background: theme.colors.success }}></span>
                </div>
              </div>
              
              <div className="preview-content">
                {/* Sidebar */}
                <div 
                  className="preview-sidebar"
                  style={{ background: theme.colors.surface }}
                >
                  <div 
                    className="preview-nav-item active"
                    style={{ background: theme.colors.primary }}
                  ></div>
                  <div 
                    className="preview-nav-item"
                    style={{ background: theme.colors.borderLight }}
                  ></div>
                  <div 
                    className="preview-nav-item"
                    style={{ background: theme.colors.borderLight }}
                  ></div>
                </div>
                
                {/* Main Area */}
                <div className="preview-main">
                  {/* Tab Bar */}
                  <div 
                    className="preview-tabs"
                    style={{ background: theme.colors.surface }}
                  >
                    <div 
                      className="preview-tab active"
                      style={{ background: theme.colors.tabActive }}
                    ></div>
                    <div 
                      className="preview-tab"
                      style={{ background: theme.colors.tabBg }}
                    ></div>
                    <div 
                      className="preview-tab"
                      style={{ background: theme.colors.tabBg }}
                    ></div>
                  </div>
                  
                  {/* Cards */}
                  <div className="preview-cards">
                    <div 
                      className="preview-card"
                      style={{ background: theme.colors.surface }}
                    >
                      <div 
                        className="preview-card-header"
                        style={{ background: theme.colors.primary, opacity: 0.8 }}
                      ></div>
                    </div>
                    <div 
                      className="preview-card"
                      style={{ background: theme.colors.surface }}
                    >
                      <div 
                        className="preview-card-header"
                        style={{ background: theme.colors.accent, opacity: 0.8 }}
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

            {/* Color Swatches */}
            <div className="color-swatches">
              <div 
                className="swatch" 
                style={{ background: theme.colors.primary }}
                title="Primary"
              ></div>
              <div 
                className="swatch" 
                style={{ background: theme.colors.accent }}
                title="Accent"
              ></div>
              <div 
                className="swatch" 
                style={{ background: theme.colors.surface }}
                title="Surface"
              ></div>
              <div 
                className="swatch" 
                style={{ background: theme.colors.text }}
                title="Text"
              ></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ThemeSelector;
