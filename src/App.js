import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ExcelDataProvider } from './contexts/ExcelDataContext';
import { SalesDataProvider } from './contexts/SalesDataContext';
import { SalesRepReportsProvider } from './contexts/SalesRepReportsContext';
import { FilterProvider } from './contexts/FilterContext';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './components/dashboard/Dashboard';
import Settings from './components/settings/Settings';

import './styles/themes.css';
import './App.css';

// Inner App component that uses theme context
function AppContent() {
  const { currentTheme } = useTheme();
  
  // Map our themes to Ant Design algorithms
  const getAntdAlgorithm = () => {
    switch (currentTheme) {
      case 'dark':
        return antdTheme.darkAlgorithm;
      case 'colorful':
        return antdTheme.defaultAlgorithm;
      case 'classic':
        return antdTheme.compactAlgorithm;
      default:
        return antdTheme.defaultAlgorithm;
    }
  };

  // Get primary color based on theme
  const getPrimaryColor = () => {
    switch (currentTheme) {
      case 'dark':
        return '#3b82f6';
      case 'colorful':
        return '#8b5cf6';
      case 'classic':
        return '#6b7280';
      default:
        return '#1677ff';
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: getAntdAlgorithm(),
        token: {
          colorPrimary: getPrimaryColor(),
          borderRadius: currentTheme === 'classic' ? 4 : 8,
        },
      }}
    >
      <AntdApp>
        <div className="App">
          <AuthProvider>
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <ExcelDataProvider>
                        <SalesDataProvider>
                          <SalesRepReportsProvider>
                            <FilterProvider>
                              <Dashboard />
                            </FilterProvider>
                          </SalesRepReportsProvider>
                        </SalesDataProvider>
                      </ExcelDataProvider>
                    </ProtectedRoute>
                  }
                />

                {/* Settings Route (Admin only) */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <ExcelDataProvider>
                        <FilterProvider>
                          <Settings />
                        </FilterProvider>
                      </ExcelDataProvider>
                    </ProtectedRoute>
                  }
                />

                {/* Redirect root to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
