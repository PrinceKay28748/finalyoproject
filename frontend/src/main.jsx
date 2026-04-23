// frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

// // Service Worker registration with Firefox detection
// if ('serviceWorker' in navigator) {
//   // Check if browser is Firefox (which has stricter CORS with SW)
//   const isFirefox = navigator.userAgent.includes('Firefox');
  
//   window.addEventListener('load', () => {
//     // For Firefox, only register SW in production mode
//     // For development, skip SW to avoid CORS issues
//     const shouldRegister = !isFirefox || import.meta.env.PROD;
    
//     if (shouldRegister) {
//       navigator.serviceWorker.register('/sw.js')
//         .then((reg) => {
//           console.log('[ServiceWorker] Registered successfully:', reg.scope);
//         })
//         .catch((err) => {
//           console.warn('[ServiceWorker] Registration failed:', err);
//         });
//     } else {
//       console.log('[ServiceWorker] Skipped in Firefox development mode');
//     }
//   });
// }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)