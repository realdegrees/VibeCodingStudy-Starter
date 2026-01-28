import { config } from './config.js';

const app = {
  // State
  currentUnit: 'celsius',
  currentLat: null,
  currentLon: null,
  currentCity: null,

  async init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('city-search');
    const unitToggle = document.getElementById('unit-toggle');

    const handleSearch = () => {
      const city = searchInput.value.trim();
      console.log("Searching for:", city);
      if (city) {
        this.geocode(city);
      }
    };

    if (searchBtn && searchInput && unitToggle) {
      searchBtn.addEventListener('click', handleSearch);
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSearch();
        }
      });

      unitToggle.addEventListener('click', () => {
        this.toggleUnit();
      });
    } else {
      console.error("Search or toggle elements not found!");
    }
  },

  toggleUnit() {
    this.currentUnit = this.currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    const toggleBtn = document.getElementById('unit-toggle');
    toggleBtn.textContent = this.currentUnit === 'celsius' ? '°C' : '°F';

    // Refresh weather if we have a location
    if (this.currentLat !== null && this.currentLon !== null) {
      this.fetchWeather(this.currentLat, this.currentLon, this.currentCity);
    }
  },

  async geocode(city) {
    try {
      console.log("Geocoding...");
      const response = await fetch(
        `${config.GEOCODING_API_URL}/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );

      if (!response.ok) throw new Error("Geocoding failed");

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        this.showError(`City "${city}" not found.`);
        return;
      }

      const location = data.results[0];
      this.fetchWeather(location.latitude, location.longitude, location.name);

    } catch (error) {
      console.error("Geocoding error:", error);
      this.showError("Error finding city.");
    }
  },

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 3000);
  },

  async fetchWeather(lat, lon, cityName) {
    // Store current location
    this.currentLat = lat;
    this.currentLon = lon;
    this.currentCity = cityName;

    try {
      const response = await fetch(
        `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&hourly=precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${this.currentUnit}`
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      this.displayWeather(data, cityName);
    } catch (error) {
      console.error("Error fetching weather:", error);
      this.showError("Failed to fetch weather data.");
    }
  },

  getWeatherTheme(code, isDay, temp) {
    if (isDay === 0) return 'night';

    // WMO Weather interpretation codes (WW)
    // 0: Clear sky
    // 1, 2, 3: Mainly clear, partly cloudy, and overcast
    // 45, 48: Fog
    // 51, 53, 55: Drizzle
    // 61, 63, 65: Rain
    // 71, 73, 75: Snow fall
    // 77: Snow grains
    // 80, 81, 82: Rain showers
    // 85, 86: Snow showers
    // 95: Thunderstorm
    // 96, 99: Thunderstorm with slight and heavy hail

    // Use temperature to refine "sunny/clear" days
    if (code === 0 || code === 1) {
      if (temp <= 0) return 'cold';
      if (temp <= 10) return 'cool';
      return 'sunny';
    }

    if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
    if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code === 95 || code === 96 || code === 99) return 'rainy';
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return 'snowy';

    return 'sunny'; // Default
  },

  displayWeather(data, cityName) {
    const current = data.current;
    const daily = data.daily;

    // Apply Theme
    const theme = this.getWeatherTheme(current.weather_code, current.is_day, current.temperature_2m, data.current_units.temperature_2m);
    document.body.className = theme;


    // Update title if city name is provided
    if (cityName) {
      document.querySelector('header h1').textContent = `Weather in ${cityName}`;
    }

    // Get precipitation probability for current hour
    // The API returns hourly data starting from 00:00 today.
    // We need to match current time to the index.
    const currentHourIndex = new Date().getHours();
    const precipProb = data.hourly.precipitation_probability[currentHourIndex];

    const container = document.getElementById('weather-display');
    container.classList.remove('hidden');

    // Generate Forecast HTML
    let forecastHtml = '<div class="forecast-container">';
    // We get 7 days of data usually
    for (let i = 1; i < daily.time.length; i++) {
      const date = new Date(daily.time[i]);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      forecastHtml += `
            <div class="forecast-item">
                <div class="day">${dayName}</div>
                <div class="temps">
                    <span class="max">${Math.round(daily.temperature_2m_max[i])}°</span>
                    <span class="min">${Math.round(daily.temperature_2m_min[i])}°</span>
                </div>
            </div>
        `;
    }
    forecastHtml += '</div>';

    container.innerHTML = `
        <div class="weather-card">
            <div class="weather-main">
                <div class="temp">${Math.round(current.temperature_2m)}${data.current_units.temperature_2m}</div>
            </div>
            <div class="weather-details">
                <div class="detail-item">
                    <span class="label">Apparent</span>
                    <span class="value">${Math.round(current.apparent_temperature)}${data.current_units.apparent_temperature}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Humidity</span>
                    <span class="value">${current.relative_humidity_2m}${data.current_units.relative_humidity_2m}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Wind</span>
                    <span class="value">${current.wind_speed_10m} ${data.current_units.wind_speed_10m}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Rain Prob.</span>
                    <span class="value">${precipProb}%</span>
                </div>
            </div>
        </div>
        ${forecastHtml}
    `;
  },
};

// Start app directly (modules are deferred by default)
app.init();
