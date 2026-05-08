// WeatherBanner.jsx - No changes needed, but here it is for completeness
import { useWeather } from '../../hooks/useWeather';
import './WeatherBanner.css';

// SVG Refresh Icon
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
  </svg>
);

export default function WeatherBanner() {
  const { weather, getWeatherDisplay, hasWeatherImpact, getMultipliers, refreshWeather, isLoading } = useWeather();
  
  const display = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();
  const multipliers = getMultipliers();
  
  if (!weather) {
    return (
      <div className="weather-banner weather-banner--loading">
        <span className="weather-icon">🌡️</span>
        <span className="weather-text">Loading weather...</span>
      </div>
    );
  }
  
  return (
    <div className={`weather-banner ${hasImpact ? 'weather-banner--impact' : ''}`}>
      <div className="weather-banner-main">
        <div className="weather-info">
          <span className="weather-icon">{display.icon}</span>
          <div className="weather-details">
            <span className="weather-temp">{display.temperature}°C</span>
            <span className="weather-condition">{display.label}</span>
          </div>
        </div>
        <button 
          className="weather-refresh" 
          onClick={refreshWeather} 
          disabled={isLoading}
          title="Refresh weather"
        >
          <RefreshIcon />
        </button>
      </div>
      
      {multipliers.message && (
        <div className={`weather-message ${hasImpact ? 'weather-message--active' : ''}`}>
          <span className="message-icon">{display.icon}</span>
          <span className="message-text">{multipliers.message}</span>
        </div>
      )}
      
      <div className="weather-impact-badge">
        {hasImpact ? (
          <span className="impact-active">🌧️ Routing adjusted for conditions</span>
        ) : (
          <span className="impact-normal">✅ Clear conditions — normal routing</span>
        )}
      </div>
    </div>
  );
}