import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ExcelDataProvider } from './contexts/ExcelDataContext';
import { SalesDataProvider } from './contexts/SalesDataContext';
import { SalesRepReportsProvider } from './contexts/SalesRepReportsContext';
import { FilterProvider } from './contexts/FilterContext';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './components/dashboard/Dashboard';
import Settings from './components/settings/Settings';

import './App.css';

function App() {
  return (
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
  );
}

export default App;
