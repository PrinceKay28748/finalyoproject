// Hook for weather data and routing integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWeather, getWeatherMultipliers, WEATHER_CODES } from '../services/weatherService';
import { useVoiceGuidance } from './useVoiceGuidance';

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const previousWeatherRef = useRef(null);
  const hasSpokenInitialRef = useRef(false);
  
  const { isVoiceEnabled, speak } = useVoiceGuidance();

  // Format weather message for voice
  const formatWeatherMessage = useCallback((weatherData, hasImpact) => {
    const temp = Math.round(weatherData.temperature);
    const condition = weatherData.condition || 'Unknown';
    const impactText = hasImpact ? ' Routing adjusted for conditions.' : ' Normal routing.';
    
    return `Current weather: ${condition}, ${temp} degrees.${impactText}`;
  }, []);

  // Format weather update message (when weather changes)
  const formatWeatherUpdateMessage = useCallback((oldWeather, newWeather, hasImpact) => {
    const oldCondition = oldWeather?.condition || 'Unknown';
    const newCondition = newWeather?.condition || 'Unknown';
    const temp = Math.round(newWeather.temperature);
    
    if (oldCondition !== newCondition) {
      return `Weather update: ${newCondition} detected, ${temp} degrees. Routing adjusted for conditions.`;
    }
    return `Weather updated: ${newCondition}, ${temp} degrees.`;
  }, []);

  // Speak weather on load and when weather changes
  useEffect(() => {
    if (!weather || !isVoiceEnabled) return;
    
    // Initial weather announcement (first load only)
    if (!hasSpokenInitialRef.current && !weather.isFallback) {
      hasSpokenInitialRef.current = true;
      const hasImpact = hasWeatherImpact();
      const message = formatWeatherMessage(weather, hasImpact);
      setTimeout(() => speak(message, { priority: 'normal' }), 500);
    }
    
    // Check if weather changed significantly
    if (previousWeatherRef.current && !weather.isFallback) {
      const prevCondition = previousWeatherRef.current.condition;
      const currCondition = weather.condition;
      
      if (prevCondition !== currCondition) {
        const hasImpact = hasWeatherImpact();
        const message = formatWeatherUpdateMessage(previousWeatherRef.current, weather, hasImpact);
        speak(message, { priority: 'normal' });
      }
    }
    
    // Store current weather for next comparison
    previousWeatherRef.current = weather;
    
  }, [weather, isVoiceEnabled, speak, formatWeatherMessage, formatWeatherUpdateMessage, hasWeatherImpact]);

  const refreshWeather = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWeather();
      setWeather(data);
      setError(null);
      setLastUpdated(new Date());
      
      // Speak manual refresh confirmation
      if (isVoiceEnabled && !data.isFallback) {
        const temp = Math.round(data.temperature);
        const condition = data.condition || 'Unknown';
        speak(`Weather refreshed: ${condition}, ${temp} degrees.`, { priority: 'normal' });
      }
    } catch (err) {
      console.error('[useWeather] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isVoiceEnabled, speak]);

  // Initial fetch
  useEffect(() => {
    refreshWeather();
    
    // Refresh every 10 minutes (cache duration)
    const interval = setInterval(refreshWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshWeather]);

  // Get multipliers for routing
  const getMultipliers = useCallback(() => {
    return getWeatherMultipliers(weather);
  }, [weather]);

  // Get current weather icon and description
  const getWeatherDisplay = useCallback(() => {
    if (!weather) {
      return { icon: '🌡️', label: 'Loading...', description: 'Fetching weather data' };
    }
    
    const weatherInfo = WEATHER_CODES[weather.weatherCode] || WEATHER_CODES[0];
    return {
      icon: weather.icon || weatherInfo.icon,
      label: weather.condition,
      description: weatherInfo.description,
      temperature: weather.temperature,
      feelsLike: weather.temperature,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      isDay: weather.isDay
    };
  }, [weather]);

  // Check if weather affects routing
  const hasWeatherImpact = useCallback(() => {
    if (!weather || weather.isFallback) return false;
    
    const code = weather.weatherCode;
    const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
    const isStorm = [95, 96, 99].includes(code);
    const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
    const isHeat = weather.temperature >= 30;
    const isNight = !weather.isDay;
    const isFog = [45, 48].includes(code);
    
    return isRain || isStorm || isSnow || isHeat || isNight || isFog;
  }, [weather]);

  return {
    weather,
    isLoading,
    error,
    lastUpdated,
    refreshWeather,
    getMultipliers,
    getWeatherDisplay,
    hasWeatherImpact
  };
}