// frontend/src/hooks/useAuth.js
// Authentication hook - manages login state and tokens

import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../config';

export function useAuth() {
  const [user, setUser]                     = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]           = useState(true);  // only true during session restore
  const [error, setError]                   = useState(null);

  // Restore session from storage on mount — this is the ONLY time isLoading should be true
  useEffect(() => {
    const storedUser  = sessionStorage.getItem('user');
    const storedToken = sessionStorage.getItem('accessToken');

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        console.log('[useAuth] Session restored:', parsedUser.email);
      } catch (err) {
        console.warn('[useAuth] Failed to parse stored user:', err);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
      }
    }

    // Session restore complete — never set isLoading again from login/register
    setIsLoading(false);
  }, []);

  // Extracts the most useful error message from any API response shape
  function extractError(data, fallback) {
    if (data?.error)   return data.error;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.map(e => e.msg || e.message).join(', ');
    }
    return fallback;
  }

  // Register — does NOT touch isLoading (component manages its own loading state)
  const register = useCallback(async (email, username, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: extractError(data, 'Registration failed — please try again'),
        };
      }

      const userData = { ...data.user, is_admin: data.user.is_admin || 0 };

      sessionStorage.setItem('accessToken',  data.accessToken);
      sessionStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.setItem('user',         JSON.stringify(userData));

      setUser(userData);
      setIsAuthenticated(true);

      console.log('[useAuth] Registration successful:', userData.email);
      return { success: true };

    } catch (err) {
      console.error('[useAuth] Register network error:', err);
      return {
        success: false,
        error: 'Could not connect to server — check your connection',
      };
    }
  }, []);

  // Login — does NOT touch isLoading (component manages its own loading state)
  const login = useCallback(async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: extractError(data, 'Invalid email or password'),
        };
      }

      const userData = {
        id:         data.user.id,
        email:      data.user.email,
        username:   data.user.username,
        is_admin:   data.user.is_admin || 0,
        created_at: data.user.created_at,
      };

      sessionStorage.setItem('accessToken',  data.accessToken);
      sessionStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.setItem('user',         JSON.stringify(userData));

      setUser(userData);
      setIsAuthenticated(true);

      console.log('[useAuth] Login successful:', userData.email);
      return { success: true };

    } catch (err) {
      console.error('[useAuth] Login network error:', err);
      return {
        success: false,
        error: 'Could not connect to server — check your connection',
      };
    }
  }, []);

  // Logout — notifies backend then clears local session
  const logout = useCallback(async () => {
    const token = sessionStorage.getItem('accessToken');

    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn('[useAuth] Logout notification failed:', err);
      }
    }

    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');

    setUser(null);
    setIsAuthenticated(false);
    console.log('[useAuth] Logout complete');
  }, []);

  const getAuthHeader = useCallback(() => {
    const token = sessionStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const isAdmin = useCallback(() => {
    return user?.is_admin === 1 || user?.is_admin === true;
  }, [user]);

  return {
    user,
    isAuthenticated,
    isLoading,   // only true during initial session restore
    error,
    register,
    login,
    logout,
    getAuthHeader,
    isAdmin,
  };
}