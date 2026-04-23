// frontend/src/hooks/useAuth.js
// Authentication hook - manages login state and tokens

import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../config';

//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load user from session storage on mount
    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        const storedToken = sessionStorage.getItem('accessToken');

        if (storedUser && storedToken) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
                console.log('[useAuth] User loaded from storage:', parsedUser.email, 'is_admin:', parsedUser.is_admin);
            } catch (err) {
                console.warn('[useAuth] Failed to parse stored user:', err);
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('accessToken');
                sessionStorage.removeItem('refreshToken');
            }
        }

        setIsLoading(false);
    }, []);

    // Extracts the most useful error message from any API response shape
    // Backend may return { error }, { message }, or { errors: [...] }
    function extractError(data, fallback) {
        if (data?.error) return data.error;
        if (data?.message) return data.message;
        if (Array.isArray(data?.errors) && data.errors.length > 0) {
            // express-validator returns an array of validation errors
            return data.errors.map(e => e.msg || e.message).join(', ');
        }
        return fallback;
    }

    // Register new user
    const register = useCallback(async (email, username, password) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: extractError(data, 'Registration failed — please try again'),
                };
            }

            // Ensure user object includes is_admin field (default 0 for new users)
            const userData = {
                ...data.user,
                is_admin: data.user.is_admin || 0
            };

            // Store tokens and user
            sessionStorage.setItem('accessToken', data.accessToken);
            sessionStorage.setItem('refreshToken', data.refreshToken);
            sessionStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            setIsAuthenticated(true);
            
            console.log('[useAuth] Registration successful:', userData.email, 'is_admin:', userData.is_admin);

            return { success: true };

        } catch (err) {
            // Network error — backend unreachable
            console.error('[useAuth] Register network error:', err);
            return {
                success: false,
                error: 'Could not connect to server — check your connection',
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Login user
    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: extractError(data, 'Invalid email or password'),
                };
            }

            // Ensure user object includes is_admin field (from database)
            const userData = {
                id: data.user.id,
                email: data.user.email,
                username: data.user.username,
                is_admin: data.user.is_admin || 0,
                created_at: data.user.created_at
            };

            // Store tokens and user
            sessionStorage.setItem('accessToken', data.accessToken);
            sessionStorage.setItem('refreshToken', data.refreshToken);
            sessionStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            setIsAuthenticated(true);
            
            console.log('[useAuth] Login successful:', userData.email, 'is_admin:', userData.is_admin);

            return { success: true };

        } catch (err) {
            // Network error — backend unreachable
            console.error('[useAuth] Login network error:', err);
            return {
                success: false,
                error: 'Could not connect to server — check your connection',
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Logout user — notifies backend then clears local session
    const logout = useCallback(async () => {
        const token = sessionStorage.getItem('accessToken');

        if (token) {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
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

    // Get authorization header for API calls
    const getAuthHeader = useCallback(() => {
        const token = sessionStorage.getItem('accessToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }, []);

    // Helper to check if current user is admin
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
        isAdmin,  // ← Add this helper
    };
}