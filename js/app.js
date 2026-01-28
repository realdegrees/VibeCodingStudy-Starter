import { config } from './config.js';

const app = {
  elements: {
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    weatherContent: document.getElementById('weather-content'),
    loadingIndicator: document.getElementById('loading-indicator'),
    errorMessage: document.getElementById('error-message'),
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    feelsLike: document.getElementById('feels-like'),
    precipitation: document.getElementById('precipitation'),
    rainChance: document.getElementById('rain-chance'),
    uvIndex: document.getElementById('uv-index'),
    pressure: document.getElementById('pressure'),
    cyclingText: document.getElementById('cycling-text'),
    forecastContainer: document.getElementById('forecast-container'),
    dailyForecastContainer: document.getElementById('daily-forecast-container'),
  },

  state: {
    unit: 'C', // 'C' or 'F'
    savedData: null,
    savedLocation: null
  },

  init() {
    this.bindEvents();
    this.fetchWeatherForCity('Berlin');
  },

  bindEvents() {
    this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
    this.elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });
    // Click on temp to toggle unit
    this.elements.currentTemp.addEventListener('click', () => this.toggleUnit());
  },

  toggleUnit() {
    this.state.unit = this.state.unit === 'C' ? 'F' : 'C';
    // Removed button text update since button is gone

    if (this.state.savedData && this.state.savedLocation) {
      this.updateUI(this.state.savedData, this.state.savedLocation);
    }
  },

  async handleSearch() {
    const query = this.elements.searchInput.value.trim();
    if (!query) return;

    await this.fetchWeatherForCity(query);
  },

  async fetchWeatherForCity(city) {
    this.showLoading(true);
    this.hideError();

    try {
      const location = await this.fetchLocation(city);
      if (!location) {
        this.showError(`City "${city}" not found.`);
        this.showLoading(false);
        return;
      }

      const weatherData = await this.fetchWeatherData(location.latitude, location.longitude);

      this.state.savedData = weatherData;
      this.state.savedLocation = location;

      this.updateUI(weatherData, location);
    } catch (error) {
      console.error('Error:', error);
      this.showError('Failed to fetch weather data. Please try again.');
    } finally {
      this.showLoading(false);
    }
  },

  async fetchLocation(query) {
    const url = `${config.GEO_API_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0];
  },

  async fetchWeatherData(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,uv_index',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'auto',
      forecast_days: 7
    });

    const response = await fetch(`${config.API_URL}/forecast?${params}`);
    if (!response.ok) throw new Error('Weather API error');

    return await response.json();
  },

  updateUI(data, location) {
    const current = data.current;
    const currentUnits = data.current_units; // Always returns API units (usually C)
    const hourly = data.hourly;
    const daily = data.daily;

    // Apply Theme
    this.updateTheme(current.temperature_2m, current.weather_code);

    // Header
    this.elements.cityName.textContent = location.name;
    this.elements.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Main Weather
    this.elements.currentTemp.textContent = this.formatTemp(current.temperature_2m);
    this.elements.weatherDesc.textContent = this.getWeatherDescription(current.weather_code);

    // Find current hour index for rain probability
    const currentHour = new Date().getHours();
    // Assuming API returns hourly data starting from 00:00 today (usually does with timezone auto)
    // We need to match the time string or just use the index if we trust it starts at 00:00
    // A safer way is to find the index where time matches current hour.
    const currentHourIndex = hourly.time.findIndex(t => new Date(t).getHours() === currentHour && new Date(t).getDate() === new Date().getDate());
    const rainProb = currentHourIndex !== -1 ? hourly.precipitation_probability[currentHourIndex] : 0;

    // Details
    this.elements.humidity.textContent = `${current.relative_humidity_2m}%`;

    // Wind speed conversion (raw is km/h usually) - keep as is for simplicity or convert?
    // Let's assume we keep metric for non-temp measurements primarily, or do simple conversion.
    this.elements.windSpeed.textContent = `${current.wind_speed_10m} km/h`;

    this.elements.feelsLike.textContent = this.formatTemp(current.apparent_temperature);
    this.elements.precipitation.textContent = `${current.precipitation} mm`;
    this.elements.rainChance.textContent = `${rainProb}%`; // Updated

    // Extra Metrics
    this.elements.uvIndex.textContent = current.uv_index.toFixed(1);
    this.elements.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;

    // Cycling Advice
    this.elements.cyclingText.textContent = this.getCyclingAdvice(current.temperature_2m, rainProb, current.wind_speed_10m);

    // Hourly Forecast
    this.renderForecast(hourly);

    // Daily Forecast
    this.renderDailyForecast(daily);

    // Show Content
    this.elements.weatherContent.classList.remove('hidden');
  },

  getCyclingAdvice(tempC, rainProb, windKmh) {
    let advice = [];

    // Temp
    if (tempC < 5) advice.push("It's freezing! Wear thermal layers, gloves, and a hat.");
    else if (tempC < 15) advice.push("Chilly. A jacket and long pants are recommended.");
    else if (tempC < 22) advice.push("Pleasant. T-shirt and shorts/light pants are good.");
    else advice.push("It's warm! Light breathable clothing is best.");

    // Rain
    if (rainProb > 50) advice.push("High chance of rain. Bring a waterproof jacket!");
    else if (rainProb > 20) advice.push("Might rain. Pack a light shell just in case.");

    // Wind
    if (windKmh > 20) advice.push("Windy! A windbreaker will help.");

    if (advice.length === 0) return "Great weather for a ride!";
    return advice.join(' ');
  },

  formatTemp(celsius) {
    if (this.state.unit === 'F') {
      const f = (celsius * 9 / 5) + 32;
      return `${Math.round(f)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  },

  updateTheme(temp, code) {
    // Temperature-based themes as requested
    // Overrides: Thunder or Heavy Rain might still deserve dark themes, but let's stick to temp primarily as requested.

    document.body.className = ''; // Reset
    let themeClass = 'temp-mild'; // Default

    if (temp <= 0) themeClass = 'temp-freezing';
    else if (temp < 15) themeClass = 'temp-cold';
    else if (temp < 25) themeClass = 'temp-mild';
    else if (temp < 30) themeClass = 'temp-warm';
    else themeClass = 'temp-hot';

    document.body.classList.add(themeClass);
  },

  renderForecast(hourly) {
    this.elements.forecastContainer.innerHTML = '';
    const currentHour = new Date().getHours();

    // Limit to next 24 hours
    let count = 0;

    hourly.time.forEach((timeStr, index) => {
      const time = new Date(timeStr);
      const hour = time.getHours();

      // Basic "is today/tomorrow" check handled by just ignoring past hours of today
      // But we might be crossing midnight, so just check index vs current time index roughly
      // API returns time series matching "now" or "today" start.
      // Simplified: if time > now

      if (new Date(timeStr) >= new Date() && count < 24) {
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
                    <span class="forecast-time">${hour}:00</span>
                    <span class="forecast-icon">${this.getWeatherIcon(hourly.weather_code[index])}</span>
                    <span class="forecast-temp">${this.formatTemp(hourly.temperature_2m[index])}</span>
                `;
        this.elements.forecastContainer.appendChild(card);
        count++;
      }
    });
  },

  renderDailyForecast(daily) {
    this.elements.dailyForecastContainer.innerHTML = '';

    // daily.time is Array of dates "YYYY-MM-DD"
    daily.time.forEach((dateStr, index) => {
      // Index 0 is Today
      const date = new Date(dateStr);
      const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' });

      const card = document.createElement('div');
      card.className = 'daily-card';

      card.innerHTML = `
                <div class="daily-date">${dayName}</div>
                <div class="daily-icon">${this.getWeatherIcon(daily.weather_code[index])}</div>
                <div class="daily-temp">
                    <span class="max">${this.formatTemp(daily.temperature_2m_max[index])}</span>
                    <span class="min" style="opacity: 0.7">${this.formatTemp(daily.temperature_2m_min[index])}</span>
                </div>
            `;

      this.elements.dailyForecastContainer.appendChild(card);
    });
  },

  showLoading(isLoading) {
    if (isLoading) {
      this.elements.loadingIndicator.classList.remove('hidden');
      this.elements.weatherContent.classList.add('hidden');
    } else {
      this.elements.loadingIndicator.classList.add('hidden');
    }
  },

  showError(msg) {
    this.elements.errorMessage.textContent = msg;
    this.elements.errorMessage.classList.remove('hidden');
    setTimeout(() => {
      this.elements.errorMessage.classList.add('hidden');
    }, 5000);
  },

  hideError() {
    this.elements.errorMessage.classList.add('hidden');
  },

  getWeatherDescription(code) {
    const codes = {
      0: 'Clear sky',
      1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog',
      51: 'Light drizzles', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Light snow', 73: 'Moderate snow', 75: 'Heavy snow',
      95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
    };
    return codes[code] || 'Unknown';
  },

  getWeatherIcon(code) {
    if (code === 0) return '☀️'; // Clear
    if (code >= 1 && code <= 3) return '☁️'; // Cloudy
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 67) return '🌧️'; // Rain
    if (code >= 71 && code <= 77) return '❄️'; // Snow
    if (code >= 80 && code <= 82) return '🌧️'; // Rain showers
    if (code >= 85 && code <= 86) return '❄️'; // Snow showers
    if (code >= 95) return '⛈️'; // Thunder
    return '❓';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
