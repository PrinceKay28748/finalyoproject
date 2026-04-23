// frontend/src/config.js
// API configuration - works for both development and production

// Determine API URL based on environment
const getApiUrl = () => {
  // Production (deployed on Render)
  if (import.meta.env.PROD) {
    // This will be your backend URL once deployed
    // For now, we'll update this after backend is deployed
    return 'https://api.ug-navigator.onrender.com';
  }
  
  // Development (localhost)
  return `http://${window.location.hostname}:3001`;
};

export const API_URL = getApiUrl();