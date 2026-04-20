import { useState, useEffect } from 'react';
import './OfflineIndicator.css';

/**
 * Offline indicator - shows when network connection is lost
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[OfflineIndicator] Back online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[OfflineIndicator] Went offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="offline-indicator">
      <span className="offline-icon">📡</span>
      <span className="offline-text">You're offline — using cached data</span>
    </div>
  );
}
