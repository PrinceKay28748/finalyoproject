// frontend/src/components/Auth/AuthPage.jsx
// Main authentication page - handles login/register/forgot-password

import { useState } from 'react';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // login, register, forgot, reset
  const [resetToken, setResetToken] = useState('');

  // Check URL for reset token on mount
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
      // Clean URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
        token={resetToken}
        onComplete={() => setMode('login')}
      />
    );
  }
  
  return null;
}