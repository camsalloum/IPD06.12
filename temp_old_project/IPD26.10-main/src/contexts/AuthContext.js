import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configure axios defaults
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Get token from localStorage
  const getToken = () => {
    return localStorage.getItem('auth_token');
  };

  // Set token in localStorage and axios headers
  const setToken = (token) => {
    if (token) {
      localStorage.setItem('auth_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('auth_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Load user from token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          setToken(token);
          const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
          if (response.data.success) {
            setUser(response.data.user);
          }
        } catch (error) {
          console.error('Failed to load user:', error);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [API_BASE_URL]);

  // Login function
  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        setToken(response.data.token);
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
    }
  }, [API_BASE_URL]);

  // Change password function
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    try {
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/api/auth/change-password`, {
        oldPassword,
        newPassword
      });

      if (response.data.success) {
        // Auto logout after password change
        await logout();
        return { success: true };
      }

      return { success: false, error: 'Password change failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password change failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL, logout]);

  // Update profile function
  const updateProfile = useCallback(async (updates) => {
    try {
      setError(null);
      const response = await axios.put(`${API_BASE_URL}/api/auth/profile`, updates);

      if (response.data.success) {
        setUser(prevUser => ({ ...prevUser, ...response.data.user }));
        return { success: true, user: response.data.user };
      }

      return { success: false, error: 'Profile update failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Profile update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Get preferences function
  const getPreferences = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`);
      if (response.data.success) {
        return { success: true, preferences: response.data.preferences };
      }
      return { success: false, error: 'Failed to load preferences' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to load preferences';
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Update preferences function (including period selection)
  const updatePreferences = useCallback(async (preferences) => {
    try {
      setError(null);
      const response = await axios.put(`${API_BASE_URL}/api/auth/preferences`, preferences);

      if (response.data.success) {
        // Update user object with new preferences
        setUser(prevUser => ({ 
          ...prevUser, 
          preferences: response.data.preferences 
        }));
        return { success: true, preferences: response.data.preferences };
      }

      return { success: false, error: 'Preferences update failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Preferences update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Check if user has access to division
  const hasAccessToDivision = useCallback((division) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.divisions?.includes(division);
  }, [user]);

  // Check if user has specific role
  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }, [user]);

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
        if (response.data.success) {
          setUser(response.data.user);
          return { success: true, user: response.data.user };
        }
      }
      return { success: false, error: 'Not authenticated' };
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return { success: false, error: 'Failed to refresh user data' };
    }
  }, [API_BASE_URL]);

  // Check if user is authenticated
  const isAuthenticated = Boolean(user);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    changePassword,
    updateProfile,
    getPreferences,
    updatePreferences,
    refreshUser,
    hasAccessToDivision,
    hasRole,
    isAuthenticated,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
