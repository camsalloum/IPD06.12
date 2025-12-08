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
  const [token, setTokenState] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configure axios defaults
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Get token - returns state value which is always in sync
  const getToken = useCallback(() => {
    return token;
  }, [token]);

  // Set token in localStorage, state, and axios headers
  const setToken = useCallback((newToken) => {
    console.log('setToken called with:', newToken ? 'token exists' : 'null/undefined');
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      console.log('Token stored in localStorage, verify:', localStorage.getItem('auth_token') ? 'SUCCESS' : 'FAILED');
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setTokenState(newToken);
    } else {
      localStorage.removeItem('auth_token');
      delete axios.defaults.headers.common['Authorization'];
      setTokenState(null);
    }
  }, []);

  // Load user from token on mount
  useEffect(() => {
    const initAuth = async () => {
      // Read token directly from localStorage to avoid stale closure
      const existingToken = localStorage.getItem('auth_token');
      console.log('initAuth - checking localStorage token:', existingToken ? 'exists' : 'null');
      if (existingToken) {
        try {
          // Ensure axios headers are set
          axios.defaults.headers.common['Authorization'] = `Bearer ${existingToken}`;
          // Also update state if needed
          setTokenState(existingToken);
          const response = await axios.get(`${API_BASE_URL}/api/auth/me`);
          if (response.data.success) {
            console.log('initAuth - user loaded successfully');
            setUser(response.data.user);
          } else {
            console.log('initAuth - /api/auth/me returned failure');
            // Clear invalid token
            localStorage.removeItem('auth_token');
            delete axios.defaults.headers.common['Authorization'];
            setTokenState(null);
          }
        } catch (error) {
          console.error('initAuth - Failed to load user:', error);
          // Clear invalid token
          localStorage.removeItem('auth_token');
          delete axios.defaults.headers.common['Authorization'];
          setTokenState(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [API_BASE_URL]); // Only run on mount - reads from localStorage directly

  // Keep localStorage in sync with token state (belt and suspenders)
  useEffect(() => {
    if (token && !localStorage.getItem('auth_token')) {
      console.log('Token exists in state but not localStorage - syncing...');
      localStorage.setItem('auth_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

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
        // Server returns "accessToken", not "token"
        const receivedToken = response.data.accessToken || response.data.token;
        console.log('Login successful - received token:', receivedToken ? 'exists' : 'undefined');
        setToken(receivedToken);
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
  }, [API_BASE_URL, setToken]);

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
  }, [API_BASE_URL, setToken]);

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
      // Read token directly from localStorage to avoid stale closure issues
      const currentToken = localStorage.getItem('auth_token');
      if (!currentToken) {
        return { success: false, error: 'No authentication token' };
      }
      const response = await axios.put(`${API_BASE_URL}/api/auth/profile`, updates, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

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
      // First try localStorage, then fall back to axios header
      let currentToken = localStorage.getItem('auth_token');
      
      // Fallback: if localStorage is empty but axios has the token, use that
      if (!currentToken) {
        const axiosToken = axios.defaults.headers.common['Authorization'];
        if (axiosToken && axiosToken.startsWith('Bearer ')) {
          currentToken = axiosToken.substring(7);
          // Re-save to localStorage
          localStorage.setItem('auth_token', currentToken);
        }
      }
      
      if (!currentToken) {
        return { success: false, error: 'No authentication token' };
      }
      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
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
      // First try localStorage, then fall back to axios header (which was set during login)
      let currentToken = localStorage.getItem('auth_token');
      console.log('updatePreferences - localStorage auth_token:', currentToken ? 'exists' : 'NULL');
      
      // Fallback: if localStorage is empty but axios has the token, use that
      if (!currentToken) {
        const axiosToken = axios.defaults.headers.common['Authorization'];
        if (axiosToken && axiosToken.startsWith('Bearer ')) {
          currentToken = axiosToken.substring(7);
          console.log('updatePreferences - Using token from axios headers instead');
          // Re-save to localStorage
          localStorage.setItem('auth_token', currentToken);
          console.log('updatePreferences - Token re-saved to localStorage');
        }
      }
      
      if (!currentToken) {
        console.log('updatePreferences - All localStorage keys:', Object.keys(localStorage));
        return { success: false, error: 'No authentication token' };
      }
      const response = await axios.put(`${API_BASE_URL}/api/auth/preferences`, preferences, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

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
    token,
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
    setError,
    getToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
