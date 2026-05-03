// frontend/src/components/Auth/AuthPage.jsx
// Main authentication page - handles login/register/forgot-password

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // login, register, forgot, reset
  const location = useLocation();

  // Check for reset mode from Supabase hash in URL
  useEffect(() => {
    // Supabase puts the access token in the URL hash for password reset
    const hash = location.hash;
    if (hash && hash.includes('access_token')) {
      setMode('reset');
    } else {
      // Also check query params for backward compatibility
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setMode('reset');
        // Clean URL without reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [location]);

  if (mode === 'login') {
    return (
      <LoginPage 
        onSwitchToRegister={() => setMode('register')}
        onForgotPassword={() => setMode('forgot')}
      />
    );
  }
  
  if (mode === 'register') {
    return (
      <RegisterPage 
        onSwitchToLogin={() => setMode('login')}
      />
    );
  }
  
  if (mode === 'forgot') {
    return (
      <ForgotPasswordPage 
        onBackToLogin={() => setMode('login')}
      />
    );
  }
  
  if (mode === 'reset') {
    return (
      <ResetPasswordPage 
        onComplete={() => setMode('login')}
      />
    );
  }
  
  return null;
}