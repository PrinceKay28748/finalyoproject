// frontend/src/hooks/useAuth.js
// Authentication hook - Supabase Auth version (no OAuth)

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to sync user with your backend's users table
  const syncUserWithBackend = useCallback(async (supabaseUser, accessToken) => {
    try {
      const response = await fetch(`${API_URL}/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          username: supabaseUser.user_metadata?.username || supabaseUser.email.split('@')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to sync user with backend');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      console.error('[useAuth] Sync error:', err);
      return null;
    }
  }, []);

  // Restore session from Supabase on mount
 // Register with Supabase - FIXED to save username correctly
const register = useCallback(async (email, username, password) => {
  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,  // This stores username in user_metadata
          username_display: username
        }
      }
    });

    if (signUpError) {
      return {
        success: false,
        error: signUpError.message
      };
    }

    if (data?.user) {
      // Check if email confirmation is required
      const needsEmailConfirmation = !data.user?.email_confirmed_at;
      
      // Only sync with backend if user is already confirmed or if no confirmation needed
      const accessToken = data.session?.access_token;
      if (accessToken && !needsEmailConfirmation) {
        const backendUser = await syncUserWithBackend(data.user, accessToken);
        
        if (backendUser) {
          const userData = {
            id: backendUser.id,
            email: backendUser.email,
            username: backendUser.username,
            is_admin: backendUser.is_admin || 0,
            created_at: backendUser.created_at,
          };
          
          sessionStorage.setItem('accessToken', accessToken);
          sessionStorage.setItem('user', JSON.stringify(userData));
          
          setUser(userData);
          setIsAuthenticated(true);
        }
      }
      
      console.log('[useAuth] Registration successful:', email);
      return { 
        success: true, 
        needsEmailConfirmation: needsEmailConfirmation 
      };
    }
    
    return { success: false, error: 'Registration failed' };
  } catch (err) {
    console.error('[useAuth] Register error:', err);
    return {
      success: false,
      error: 'Could not connect to server — check your connection',
    };
  }
}, [syncUserWithBackend]);

  // Login with Supabase
  const login = useCallback(async (email, password) => {
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        return {
          success: false,
          error: loginError.message
        };
      }

      if (data?.user && data?.session) {
        const supabaseUser = data.user;
        const accessToken = data.session.access_token;
        
        const backendUser = await syncUserWithBackend(supabaseUser, accessToken);
        
        if (backendUser) {
          const userData = {
            id: backendUser.id,
            email: backendUser.email,
            username: backendUser.username,
            is_admin: backendUser.is_admin || 0,
            created_at: backendUser.created_at,
          };
          
          sessionStorage.setItem('accessToken', accessToken);
          sessionStorage.setItem('user', JSON.stringify(userData));
          
          setUser(userData);
          setIsAuthenticated(true);
        }
        
        console.log('[useAuth] Login successful:', email);
        return { success: true };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (err) {
      console.error('[useAuth] Login error:', err);
      return {
        success: false,
        error: 'Could not connect to server — check your connection',
      };
    }
  }, [syncUserWithBackend]);

  // Logout from Supabase
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.warn('[useAuth] Logout error:', error);
    }
    
    sessionStorage.removeItem('accessToken');
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
    isLoading,
    error,
    register,
    login,
    logout,
    getAuthHeader,
    isAdmin,
  };
}