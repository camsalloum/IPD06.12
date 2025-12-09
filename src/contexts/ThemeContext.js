import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const ThemeContext = createContext();

// Default theme definitions
export const defaultThemes = {
  light: {
    name: 'Light Professional',
    description: 'Clean white & blue business look',
    icon: '☀️',
    colors: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryLight: '#dbeafe',
      secondary: '#64748b',
      accent: '#0ea5e9',
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceHover: '#f1f5f9',
      text: '#1e293b',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
      border: '#e2e8f0',
      borderLight: '#f1f5f9',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      shadow: 'rgba(0, 0, 0, 0.1)',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
      tabActive: '#3b82f6',
      tabBg: '#f1f5f9',
      overlay: 'rgba(255, 255, 255, 0.15)',
      cardGradient: 'linear-gradient(145deg, #ffffff 0%, #f7fafc 100%)',
      cardBanner: 'linear-gradient(to right, #1e3a8a, #3b82f6, #60a5fa)',
    }
  },
  dark: {
    name: 'Dark Executive',
    description: 'Elegant dark theme with blue accents',
    icon: '🌙',
    colors: {
      primary: '#60a5fa',
      primaryHover: '#3b82f6',
      primaryLight: '#1e3a5f',
      secondary: '#94a3b8',
      accent: '#38bdf8',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#334155',
      borderLight: '#1e293b',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      shadow: 'rgba(0, 0, 0, 0.4)',
      gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      tabActive: '#60a5fa',
      tabBg: '#334155',
      overlay: 'rgba(255, 255, 255, 0.08)',
      cardGradient: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
      cardBanner: 'linear-gradient(to right, #1e3a5f, #3b82f6, #60a5fa)',
    }
  },
  colorful: {
    name: 'Colorful Modern',
    description: 'Vibrant gradients & purple-teal accents',
    icon: '🎨',
    colors: {
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      primaryLight: '#ddd6fe',
      secondary: '#06b6d4',
      accent: '#f472b6',
      background: '#fdf4ff',
      surface: '#ffffff',
      surfaceHover: '#faf5ff',
      text: '#3b0764',
      textSecondary: '#7c3aed',
      textMuted: '#a855f7',
      border: '#d8b4fe',
      borderLight: '#f3e8ff',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#f43f5e',
      shadow: 'rgba(139, 92, 246, 0.25)',
      gradient: 'linear-gradient(135deg, #c026d3 0%, #8b5cf6 35%, #06b6d4 70%, #14b8a6 100%)',
      tabActive: 'linear-gradient(135deg, #c026d3 0%, #8b5cf6 100%)',
      tabBg: '#f5d0fe',
      overlay: 'rgba(192, 38, 211, 0.2)',
      cardGradient: 'linear-gradient(145deg, #ffffff 0%, #fdf4ff 50%, #fae8ff 100%)',
      cardBanner: 'linear-gradient(to right, #c026d3, #8b5cf6, #06b6d4)',
    }
  },
  classic: {
    name: 'Classic Corporate',
    description: 'Professional neutral & minimal design',
    icon: '🏢',
    colors: {
      primary: '#374151',
      primaryHover: '#1f2937',
      primaryLight: '#f3f4f6',
      secondary: '#6b7280',
      accent: '#4b5563',
      background: '#f9fafb',
      surface: '#ffffff',
      surfaceHover: '#f3f4f6',
      text: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af',
      border: '#d1d5db',
      borderLight: '#e5e7eb',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      shadow: 'rgba(0, 0, 0, 0.08)',
      gradient: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
      tabActive: '#374151',
      tabBg: '#e5e7eb',
      overlay: 'rgba(0, 0, 0, 0.05)',
      cardGradient: 'linear-gradient(145deg, #ffffff 0%, #f9fafb 100%)',
      cardBanner: 'linear-gradient(to right, #1f2937, #4b5563, #9ca3af)',
    }
  }
};

// Editable color keys that users can customize
export const editableColorKeys = [
  { key: 'primary', label: 'Primary', description: 'Main brand color' },
  { key: 'accent', label: 'Accent', description: 'Secondary highlight color' },
  { key: 'background', label: 'Background', description: 'Page background' },
  { key: 'surface', label: 'Surface', description: 'Card/panel background' },
  { key: 'text', label: 'Text', description: 'Main text color' },
  { key: 'success', label: 'Success', description: 'Positive indicators' },
  { key: 'warning', label: 'Warning', description: 'Warning indicators' },
  { key: 'error', label: 'Error', description: 'Error indicators' },
];

// Deep clone themes for modification
const cloneThemes = (themes) => JSON.parse(JSON.stringify(themes));

// Export themes as a mutable reference
export let themes = cloneThemes(defaultThemes);

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // First try localStorage for quick initial load
    const saved = localStorage.getItem('app-theme');
    return saved || 'light';
  });
  
  const [customColors, setCustomColors] = useState(() => {
    // Load custom colors from localStorage
    const saved = localStorage.getItem('custom-theme-colors');
    return saved ? JSON.parse(saved) : {};
  });
  const [isLoadedFromServer, setIsLoadedFromServer] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Get merged theme colors (default + custom overrides)
  const getMergedThemeColors = useCallback((themeName) => {
    const defaultTheme = defaultThemes[themeName];
    if (!defaultTheme) return null;
    
    const themeCustomColors = customColors[themeName] || {};
    return {
      ...defaultTheme.colors,
      ...themeCustomColors
    };
  }, [customColors]);

  // Apply theme to DOM
  const applyTheme = useCallback((themeName) => {
    const baseTheme = defaultThemes[themeName];
    if (!baseTheme) {
      console.warn('Theme not found:', themeName);
      return;
    }

    const mergedColors = getMergedThemeColors(themeName);
    const root = document.documentElement;
    
    // Apply CSS variables
    Object.entries(mergedColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Update the themes object with custom colors
    themes[themeName] = {
      ...baseTheme,
      colors: mergedColors
    };

    // Apply theme class to body
    document.body.className = `theme-${themeName}`;
    
    // Also save to localStorage for quick load on next visit
    localStorage.setItem('app-theme', themeName);
  }, [getMergedThemeColors]);

  // Load theme from server when user is logged in
  const loadThemeFromServer = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.preferences?.theme) {
        const serverTheme = response.data.preferences.theme;
        if (themes[serverTheme]) {
          setCurrentTheme(serverTheme);
          applyTheme(serverTheme);
          setIsLoadedFromServer(true);
          console.log('Theme loaded from server:', serverTheme);
        }
      }
    } catch (error) {
      console.log('Could not load theme from server, using local:', error.message);
    }
  }, [API_BASE_URL, applyTheme]);

  // Save theme to server
  const saveThemeToServer = useCallback(async (themeName) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      await axios.put(`${API_BASE_URL}/api/auth/preferences`, 
        { theme: themeName, customColors: customColors },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Theme saved to server:', themeName);
    } catch (error) {
      console.error('Failed to save theme to server:', error.message);
    }
  }, [API_BASE_URL, customColors]);

  // Update a specific color for a theme
  const updateThemeColor = useCallback((themeName, colorKey, colorValue) => {
    setCustomColors(prev => {
      const newCustomColors = {
        ...prev,
        [themeName]: {
          ...(prev[themeName] || {}),
          [colorKey]: colorValue
        }
      };
      
      // Save to localStorage
      localStorage.setItem('custom-theme-colors', JSON.stringify(newCustomColors));
      
      return newCustomColors;
    });
    
    // If updating current theme, apply changes immediately
    if (themeName === currentTheme) {
      const root = document.documentElement;
      root.style.setProperty(`--color-${colorKey}`, colorValue);
    }
  }, [currentTheme]);

  // Reset a theme to default colors
  const resetThemeColors = useCallback((themeName) => {
    setCustomColors(prev => {
      const newCustomColors = { ...prev };
      delete newCustomColors[themeName];
      
      // Save to localStorage
      localStorage.setItem('custom-theme-colors', JSON.stringify(newCustomColors));
      
      return newCustomColors;
    });
    
    // If resetting current theme, reapply default colors
    if (themeName === currentTheme) {
      const defaultTheme = defaultThemes[themeName];
      const root = document.documentElement;
      Object.entries(defaultTheme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
      
      // Update themes object
      themes[themeName] = { ...defaultTheme };
    }
  }, [currentTheme]);

  // Apply theme on initial load and whenever it changes or custom colors change
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme, applyTheme, customColors]);

  // Load theme from server on mount
  useEffect(() => {
    loadThemeFromServer();
  }, [loadThemeFromServer]);

  // Change theme (saves to both localStorage and server)
  const changeTheme = useCallback((themeName) => {
    if (defaultThemes[themeName]) {
      setCurrentTheme(themeName);
      applyTheme(themeName);
      saveThemeToServer(themeName);
    }
  }, [applyTheme, saveThemeToServer]);

  // Get the current theme with merged colors
  const getCurrentTheme = useCallback(() => {
    const baseTheme = defaultThemes[currentTheme];
    if (!baseTheme) return null;
    
    return {
      ...baseTheme,
      colors: getMergedThemeColors(currentTheme)
    };
  }, [currentTheme, getMergedThemeColors]);

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      changeTheme, 
      loadThemeFromServer,
      theme: getCurrentTheme(),
      themes,
      defaultThemes,
      customColors,
      updateThemeColor,
      resetThemeColors,
      getMergedThemeColors
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export default ThemeContext;
