// frontend/src/components/Auth/AuthPage.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // login, register, forgot, reset
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  // Detect system theme on mount
  useEffect(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('authTheme');
    if (saved !== null) {
      setDarkMode(saved === 'dark');
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Only update if user hasn't manually set a preference
      if (localStorage.getItem('authTheme') === null) {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Check for reset mode from Supabase hash in URL
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes('access_token')) {
      setMode('reset');
    } else {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setMode('reset');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [location]);

  // Wrap everything with the theme class
  const themeClass = darkMode ? 'dark' : '';

  if (mode === 'login') {
    return (
      <div className={themeClass}>
        <LoginPage 
          onSwitchToRegister={() => setMode('register')}
          onForgotPassword={() => setMode('forgot')}
        />
      </div>
    );
  }
  
  if (mode === 'register') {
    return (
      <div className={themeClass}>
        <RegisterPage 
          onSwitchToLogin={() => setMode('login')}
        />
      </div>
    );
  }
  
  if (mode === 'forgot') {
    return (
      <div className={themeClass}>
        <ForgotPasswordPage 
          onBackToLogin={() => setMode('login')}
        />
      </div>
    );
  }
  
  if (mode === 'reset') {
    return (
      <div className={themeClass}>
        <ResetPasswordPage 
          onComplete={() => setMode('login')}
        />
      </div>
    );
  }
  
  return null;
}