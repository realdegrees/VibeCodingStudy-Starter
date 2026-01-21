// config is now loaded globally from config.js

const app = {
  // DOM Elements
  elements: {
    cityInput: document.getElementById('city-input'),
    searchBtn: document.getElementById('search-btn'),
    locationDisplay: document.getElementById('location-display'),
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    currentWeather: document.getElementById('current-weather'),
    statusMessage: document.getElementById('status-message'),
    currentTemp: document.getElementById('current-temp'),
    weatherIconContainer: document.getElementById('weather-icon-container'),
    weatherDesc: document.getElementById('weather-desc'),
    windSpeed: document.getElementById('wind-speed'),
    humidity: document.getElementById('humidity'),
    feelsLike: document.getElementById('feels-like'),
    rainProb: document.getElementById('rain-prob'),
    pressure: document.getElementById('pressure'),
    uvIndex: document.getElementById('uv-index'),
    forecastSection: document.getElementById('forecast-section'),
    // Changing the heading text dynamically
    forecastTitle: document.querySelector('#forecast-section h3'),
    hourlyForecast: document.getElementById('hourly-forecast'),
    dailyForecastSection: document.getElementById('daily-forecast-section'),
    dailyForecast: document.getElementById('daily-forecast'),
  },

  // State
  state: {
    lat: null,
    lon: null,
    city: null,
    isLoading: false,
    fullHourlyData: null,
    hourlyUnits: null,
    timezone: null
  },

  init() {
    this.bindEvents();
    // Default city: Berlin
    this.fetchCoordinates('Berlin');
  },

  bindEvents() {
    this.elements.searchBtn.addEventListener('click', () => {
      const city = this.elements.cityInput.value.trim();
      if (city) this.fetchCoordinates(city);
    });

    this.elements.cityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const city = this.elements.cityInput.value.trim();
        e.preventDefault();
        if (city) this.fetchCoordinates(city);
      }
    });
  },

  async fetchCoordinates(city) {
    this.setLoading(true);
    console.log(`Fetching coordinates for: ${city}`);
    try {
      const url = `${config.GEO_API_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Geocoding service unavailable');

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('City not found');
      }

      const result = data.results[0];
      this.state.lat = result.latitude;
      this.state.lon = result.longitude;
      this.state.city = `${result.name}, ${result.country}`;

      await this.fetchWeather(this.state.lat, this.state.lon);

    } catch (error) {
      console.error(error);
      this.showError(error.message);
    } finally {
      this.setLoading(false);
    }
  },

  async fetchWeather(lat, lon) {
    try {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,is_day',
        hourly: 'temperature_2m,weather_code,precipitation_probability,uv_index',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,uv_index_max',
        timezone: 'auto',
        forecast_days: 7
      });

      const url = `${config.API_URL}/forecast?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Weather service unavailable');

      const data = await response.json();

      // Store data needed for interactions
      this.state.fullHourlyData = data.hourly;
      this.state.hourlyUnits = data.current_units;
      this.state.timezone = data.timezone;

      this.displayWeather(data);

    } catch (error) {
      console.error(error);
      this.showError(error.message);
    }
  },

  displayWeather(data) {
    const { current, daily, current_units } = data;

    // 1. Update Location & Date
    this.elements.cityName.textContent = this.state.city;
    const now = new Date();
    this.elements.currentDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    this.elements.locationDisplay.classList.remove('hidden');

    // 2. Dynamic Styling (Background)
    this.updateTheme(current.weather_code, current.is_day);

    // 3. Update Current Weather
    this.elements.currentTemp.textContent = `${Math.round(current.temperature_2m)}${current_units.temperature_2m}`;
    this.elements.weatherDesc.textContent = this.getWeatherDescription(current.weather_code);
    this.elements.weatherIconContainer.innerHTML = this.getWeatherIcon(current.weather_code);

    this.elements.windSpeed.textContent = `${current.wind_speed_10m} ${current_units.wind_speed_10m}`;
    this.elements.humidity.textContent = `${current.relative_humidity_2m}${current_units.relative_humidity_2m}`;
    this.elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}${current_units.temperature_2m}`;
    this.elements.rainProb.textContent = `${current.precipitation} ${current_units.precipitation}`;
    this.elements.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;

    const uvMax = daily.uv_index_max[0];
    this.elements.uvIndex.textContent = uvMax;

    this.elements.currentWeather.classList.remove('hidden');
    this.elements.statusMessage.classList.add('hidden');

    // 4. Update Daily Forecast (Navigation)
    this.displayDailyForecast(daily, current_units);

    // 5. Initial Hourly display (Current Day / Today)
    this.selectDay(0); // Select first day by default
  },

  updateTheme(code, isDay) {
    document.body.className = '';
    if (isDay === 0) {
      document.body.classList.add('bg-night');
      return;
    }
    if (code === 0 || code === 1) document.body.classList.add('bg-sunny');
    else if (code >= 2 && code <= 48) document.body.classList.add('bg-cloudy');
    else if (code >= 51) document.body.classList.add('bg-rainy');
    else document.body.classList.add('bg-cloudy');
  },

  displayDailyForecast(daily, units) {
    this.elements.dailyForecast.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
      const date = new Date(daily.time[i]);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      const icon = this.getWeatherIcon(daily.weather_code[i]);
      const maxTemp = `${Math.round(daily.temperature_2m_max[i])}${units.temperature_2m}`;
      const minTemp = `${Math.round(daily.temperature_2m_min[i])}${units.temperature_2m}`;

      const item = document.createElement('div');
      item.className = 'daily-item';
      item.dataset.index = i; // Store index to identify clicked day

      const isToday = i === 0;
      const label = isToday ? 'Today' : dayName;

      item.innerHTML = `
                <span class="daily-day">${label}</span>
                <div class="daily-icon">${icon}</div>
                <div class="daily-temps">
                    <span class="max-temp">${maxTemp}</span>
                    <span class="min-temp">${minTemp}</span>
                </div>
            `;

      // Add click listener
      item.addEventListener('click', () => this.selectDay(i));

      this.elements.dailyForecast.appendChild(item);
    }

    this.elements.dailyForecastSection.classList.remove('hidden');
  },

  selectDay(index) {
    // 1. Highlight selected item
    const items = this.elements.dailyForecast.querySelectorAll('.daily-item');
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) items[index].classList.add('selected');

    // 2. Update toggle title
    const isToday = index === 0;
    const dateStr = new Date(this.state.fullHourlyData.time[index * 24]).toLocaleDateString('en-US', { weekday: 'long' });
    this.elements.forecastTitle.textContent = isToday ? "Hourly Forecast (Next 24h)" : `Hourly Forecast for ${dateStr}`;

    // 3. Render Hourly Data
    // Each day has exactly 24 hours in the API (hourly index maps to daily index * 24)
    // EXCEPTION: "Today" should visually start from *now* to be useful, 
    // but if user clicks a future day, it should start from 00:00.

    const startIndex = index * 24;
    const endIndex = startIndex + 24;

    this.displayHourlySlice(startIndex, endIndex, isToday);
  },

  displayHourlySlice(startIndex, endIndex, isToday) {
    this.elements.hourlyForecast.innerHTML = '';
    const hourly = this.state.fullHourlyData;
    const units = this.state.hourlyUnits;
    const currentHour = new Date().getHours();

    for (let i = startIndex; i < endIndex; i++) {
      const time = new Date(hourly.time[i]);
      const hour = time.getHours();

      // Logic: 
      // If it's TODAY, don't show passed hours (e.g. if now is 2PM, don't show 9AM).
      // UNLESS the user explicitly wants to see the whole day history? 
      // Usually "Forecast" implies future. Let's hide past hours for Today.
      // For future days, show all hours.

      if (isToday && hour < currentHour) continue;

      const item = document.createElement('div');
      item.className = 'forecast-item';

      const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const icon = this.getWeatherIcon(hourly.weather_code[i]);
      const temp = `${Math.round(hourly.temperature_2m[i])}${units.temperature_2m}`;
      const precipProb = `${hourly.precipitation_probability[i]}%`;

      item.innerHTML = `
                <span class="forecast-time">${timeStr}</span>
                <div class="forecast-icon">${icon}</div>
                <span class="forecast-temp">${temp}</span>
                <span class="precip-prob"><ion-icon name="water-outline"></ion-icon> ${precipProb}</span>
            `;

      this.elements.hourlyForecast.appendChild(item);
    }

    // If today and late, maybe we show nothing? API handles returns, loop handles checks.
    // If filtered list is empty (e.g. 11:59PM), show "End of day".
    if (this.elements.hourlyForecast.children.length === 0) {
      this.elements.hourlyForecast.innerHTML = '<p style="opacity:0.7; padding: 10px;">End of day</p>';
    }

    this.elements.forecastSection.classList.remove('hidden');
  },

  setLoading(loading) {
    this.state.isLoading = loading;
    if (loading) {
      this.elements.statusMessage.textContent = 'Loading...';
      this.elements.statusMessage.classList.remove('hidden');
      this.elements.currentWeather.classList.add('hidden');
      this.elements.forecastSection.classList.add('hidden');
      this.elements.dailyForecastSection.classList.add('hidden');
    }
  },

  showError(message) {
    this.elements.statusMessage.innerHTML = `<p style="color: #ff6b6b; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 10px;">Error: ${message}</p>`;
    this.elements.statusMessage.classList.remove('hidden');
  },

  getWeatherDescription(code) {
    const codes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      56: 'Light freezing drizzle', 57: 'Dense freezing drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      66: 'Light freezing rain', 67: 'Heavy freezing rain', 71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
      77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      85: 'Slight snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm with hail'
    };
    return codes[code] || 'Unknown';
  },

  getWeatherIcon(code) {
    let iconName = 'help-outline';
    if (code === 0) iconName = 'sunny-outline';
    else if (code >= 1 && code <= 3) iconName = 'partly-sunny-outline';
    else if (code === 45 || code === 48) iconName = 'cloud-outline';
    else if (code >= 51 && code <= 57) iconName = 'rainy-outline';
    else if (code >= 61 && code <= 67) iconName = 'rainy-outline';
    else if (code >= 71 && code <= 77) iconName = 'snow-outline';
    else if (code >= 80 && code <= 82) iconName = 'rainy-outline';
    else if (code >= 85 && code <= 86) iconName = 'snow-outline';
    else if (code >= 95) iconName = 'thunderstorm-outline';
    return `<ion-icon name="${iconName}"></ion-icon>`;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
