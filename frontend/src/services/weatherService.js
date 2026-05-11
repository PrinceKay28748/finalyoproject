// Weather service - Open-Meteo API (free, no API key required)
// Cached for 10 minutes to respect rate limits

const CACHE_KEY = 'ug_weather_cache';
const FORECAST_CACHE_KEY = 'ug_forecast_cache';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Legon campus coordinates
const LEGON_LAT = 5.6502;
const LEGON_LNG = -0.1869;

// Weather code mapping to human-readable conditions
export const WEATHER_CODES = {
  0: { label: 'Clear sky', effect: 'sun', description: 'Sunny and clear', iconType: 'sun' },
  1: { label: 'Mainly clear', effect: 'sun-cloud', description: 'Partly sunny', iconType: 'sun' },
  2: { label: 'Partly cloudy', effect: 'clouds', description: 'Partly cloudy', iconType: 'clouds' },
  3: { label: 'Overcast', effect: 'clouds', description: 'Cloudy', iconType: 'clouds' },
  45: { label: 'Fog', effect: 'fog', description: 'Foggy, limited visibility', iconType: 'fog' },
  48: { label: 'Fog', effect: 'fog', description: 'Foggy', iconType: 'fog' },
  51: { label: 'Light drizzle', effect: 'rain-light', description: 'Light drizzle', iconType: 'rain' },
  53: { label: 'Moderate drizzle', effect: 'rain', description: 'Drizzling', iconType: 'rain' },
  55: { label: 'Heavy drizzle', effect: 'rain-heavy', description: 'Heavy drizzle', iconType: 'rain' },
  61: { label: 'Light rain', effect: 'rain-light', description: 'Light rain', iconType: 'rain' },
  63: { label: 'Moderate rain', effect: 'rain', description: 'Moderate rain', iconType: 'rain' },
  65: { label: 'Heavy rain', effect: 'rain-heavy', description: 'Heavy rain', iconType: 'rain' },
  71: { label: 'Light snow', effect: 'snow', description: 'Light snow', iconType: 'snow' },
  73: { label: 'Moderate snow', effect: 'snow', description: 'Snowing', iconType: 'snow' },
  75: { label: 'Heavy snow', effect: 'snow-heavy', description: 'Heavy snow', iconType: 'snow' },
  77: { label: 'Snow grains', effect: 'snow', description: 'Snow grains', iconType: 'snow' },
  80: { label: 'Rain showers', effect: 'rain', description: 'Rain showers', iconType: 'rain' },
  81: { label: 'Rain showers', effect: 'rain', description: 'Rain showers', iconType: 'rain' },
  82: { label: 'Violent rain', effect: 'rain-heavy', description: 'Violent rain', iconType: 'rain' },
  85: { label: 'Snow showers', effect: 'snow', description: 'Snow showers', iconType: 'snow' },
  86: { label: 'Heavy snow showers', effect: 'snow-heavy', description: 'Heavy snow showers', iconType: 'snow' },
  95: { label: 'Thunderstorm', effect: 'storm', description: 'Thunderstorm', iconType: 'storm' },
  96: { label: 'Thunderstorm', effect: 'storm', description: 'Thunderstorm with hail', iconType: 'storm' },
  99: { label: 'Thunderstorm', effect: 'storm', description: 'Severe thunderstorm', iconType: 'storm' },
};

// Get cached weather or null
function getCachedWeather() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return data;
    return null;
  } catch (e) { return null; }
}

function cacheWeather(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

// Get cached forecast
function getCachedForecast() {
  try {
    const cached = localStorage.getItem(FORECAST_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return data;
    return null;
  } catch (e) { return null; }
}

function cacheForecast(data) {
  try {
    localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

// Fetch current weather from Open-Meteo
export async function fetchWeather() {
  const cached = getCachedWeather();
  if (cached) return cached;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LEGON_LAT}&longitude=${LEGON_LNG}&current_weather=true&hourly=precipitation_probability&timezone=auto`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.current_weather) throw new Error('No weather data');
    
    const weatherInfo = WEATHER_CODES[data.current_weather.weathercode] || WEATHER_CODES[0];
    const weatherData = {
      temperature: Math.round(data.current_weather.temperature),
      weatherCode: data.current_weather.weathercode,
      windSpeed: data.current_weather.windspeed,
      isDay: data.current_weather.is_day === 1,
      precipitationProb: data.hourly?.precipitation_probability?.[0] || 0,
      condition: weatherInfo.label,
      effect: weatherInfo.effect,
      description: weatherInfo.description,
      iconType: weatherInfo.iconType,
      timestamp: new Date().toISOString()
    };
    cacheWeather(weatherData);
    return weatherData;
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    return {
      temperature: 24, weatherCode: 0, windSpeed: 5, isDay: true,
      precipitationProb: 0, condition: 'Weather unavailable', effect: 'none',
      iconType: 'clouds', isFallback: true
    };
  }
}

// Fetch 5-day forecast
export async function fetchForecast() {
  const cached = getCachedForecast();
  if (cached) return cached;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LEGON_LAT}&longitude=${LEGON_LNG}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.daily) throw new Error('No forecast data');
    
    const forecast = [];
    for (let i = 0; i < data.daily.time.length; i++) {
      const weatherInfo = WEATHER_CODES[data.daily.weather_code[i]] || WEATHER_CODES[0];
      forecast.push({
        date: new Date(data.daily.time[i]),
        dayName: new Date(data.daily.time[i]).toLocaleDateString('en-US', { weekday: 'short' }),
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        condition: weatherInfo.label,
        iconType: weatherInfo.iconType,
        effect: weatherInfo.effect
      });
    }
    cacheForecast(forecast);
    return forecast;
  } catch (error) {
    console.error('[Weather] Forecast fetch failed:', error);
    return null;
  }
}

// Get routing multipliers
export function getWeatherMultipliers(weather) {
  if (!weather || weather.isFallback) {
    return { unpavedMultiplier: 1.0, lightingMultiplier: 1.0, exposedMultiplier: 1.0, shadeBonus: 1.0, speedReduction: 1.0, message: null };
  }
  
  const code = weather.weatherCode;
  const isNight = !weather.isDay;
  const isHeavyRain = [65, 67, 82].includes(code);
  const isLightRain = [51, 53, 55, 61, 63, 80, 81].includes(code);
  const isHeat = weather.temperature >= 30;
  const isStorm = [95, 96, 99].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isFog = [45, 48].includes(code);
  
  let unpavedMultiplier = 1.0, lightingMultiplier = 1.0, exposedMultiplier = 1.0, shadeBonus = 1.0, speedReduction = 1.0, message = null;
  
  if (isHeavyRain) {
    unpavedMultiplier = 3.0; exposedMultiplier = 1.5; speedReduction = 1.3;
    message = 'Heavy rain — avoiding unpaved paths';
  } else if (isLightRain) {
    unpavedMultiplier = 1.5; speedReduction = 1.1;
    message = 'Light rain — paved paths preferred';
  }
  if (isStorm) {
    unpavedMultiplier = 5.0; exposedMultiplier = 2.0; speedReduction = 1.4;
    message = 'Storm detected — seeking sheltered routes';
  }
  if (isSnow) {
    unpavedMultiplier = 2.5; speedReduction = 1.3;
    message = 'Snow — caution on all paths';
  }
  if (isFog) {
    lightingMultiplier = 1.5; speedReduction = 1.1;
    message = 'Foggy — reduced visibility';
  }
  if (isHeat) {
    shadeBonus = 0.7; exposedMultiplier = 1.3; speedReduction = 1.15;
    message = 'Heat advisory — preferring shaded routes';
  }
  if (isNight) {
    lightingMultiplier = 2.5;
    message = message ? `${message} · Night time` : 'Night time — prioritizing lit paths';
  }
  
  return { unpavedMultiplier, lightingMultiplier, exposedMultiplier, shadeBonus, speedReduction, message };
}