// Hook for weather data and routing integration

import { useState, useEffect, useCallback } from 'react';
import { fetchWeather, getWeatherMultipliers, WEATHER_CODES } from '../services/weatherService';

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshWeather = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWeather();
      setWeather(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[useWeather] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      feelsLike: weather.temperature, // Open-Meteo doesn't provide feels-like by default
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