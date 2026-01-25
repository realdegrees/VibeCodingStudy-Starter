import { config } from './config.js';

const app = {
  data: null, // Store fetched data
  isCelsius: true, // State for units

  async init() {
    this.bindEvents();
    // Default search could be added here
  },

  bindEvents() {
    const searchBtn = document.getElementById('search-btn');
    const cityInput = document.getElementById('city-input');
    const unitSwitch = document.getElementById('unit-switch');

    searchBtn.addEventListener('click', () => {
        const city = cityInput.value;
        if (city) this.fetchWeather(city);
    });

    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value;
            if (city) this.fetchWeather(city);
        }
    });

    unitSwitch.addEventListener('change', (e) => {
        this.isCelsius = !e.target.checked;
        if (this.data) {
            // Re-render UI with new unit without re-fetching
            this.updateUI(this.data.weatherData, this.data.name, this.data.country);
        }
    });
  },

  async fetchWeather(city) {
    this.showLoading(true);
    this.showError((null));
    
    try {
        // 1. Geocoding
        const coords = await this.getCoordinates(city);
        if (!coords) {
            throw new Error(`Stadt "${city}" nicht gefunden.`);
        }

        // 2. Fetch Weather Data
        const weatherData = await this.getWeatherData(coords.latitude, coords.longitude);
        
        // Store data for unit toggling
        this.data = { weatherData, name: coords.name, country: coords.country };

        // 3. Update UI
        this.updateUI(weatherData, coords.name, coords.country);
        
        // Show container
        document.getElementById('weather-container').style.display = 'block';

    } catch (error) {
        console.error(error);
        this.showError(error.message);
        document.getElementById('weather-container').style.display = 'none';
    } finally {
        this.showLoading(false);
    }
  },

  async getCoordinates(city) {
      const url = `${config.GEOCODING_API_URL}?name=${encodeURIComponent(city)}&count=1&language=de&format=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Geocoding Failed');
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
          return data.results[0]; // { name, latitude, longitude, country, ... }
      }
      return null;
  },

  async getWeatherData(lat, lon) {
      const params = new URLSearchParams({
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day',
          hourly: 'temperature_2m,weather_code,precipitation_probability',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min',
          timezone: 'auto',
          forecast_days: 7
      });

      const url = `${config.API_URL}/forecast?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather Data Fetch Failed');
      return await response.json();
  },

  updateUI(data, cityName, country) {
      const current = data.current;
      const hourly = data.hourly;
      const daily = data.daily;
      
      // Update Theme based on weather
      this.updateTheme(current.weather_code, current.is_day);

      // Helper for Temp Conversion
      const formatTemp = (t) => {
          const val = this.isCelsius ? t : (t * 9/5) + 32;
          return Math.round(val);
      };
      
      const unitStr = this.isCelsius ? '°C' : '°F';
      const speedUnit = 'km/h'; // Keeping speed simple for now, could also toggle

      // -- Header --
      document.getElementById('city-name').textContent = `${cityName}${country ? ', ' + country : ''}`;
      // Datum formatieren
      const date = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      document.getElementById('current-date').textContent = date.toLocaleDateString('de-DE', options);

      // -- Current Weather --
      document.getElementById('current-temp').textContent = formatTemp(current.temperature_2m);
      document.querySelectorAll('.unit').forEach(el => el.textContent = unitStr); // Update all units

      document.getElementById('apparent-temp').textContent = `${formatTemp(current.apparent_temperature)}${unitStr}`;
      document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
      document.getElementById('wind-speed').textContent = `${current.wind_speed_10m} ${speedUnit}`;
      document.getElementById('precipitation-prob').textContent = `${current.precipitation_probability}%`;

      // Weather Description & Icon
      const codeInfo = this.getWeatherInfo(current.weather_code);
      document.getElementById('weather-desc').textContent = codeInfo.description;
      document.getElementById('weather-icon').textContent = codeInfo.icon;

      // -- Hourly Forecast --
      this.renderHourlyForecast(hourly, formatTemp, unitStr);
      
      // -- Daily Forecast --
      this.renderDailyForecast(daily, formatTemp, unitStr);
  },

  updateTheme(code, isDay) {
      // 0,1 = Clear; 2,3 = Cloudy; 45+ = Fog/Bad; 50+ = Rain/Snow
      let gradient = '';
      
      if (isDay === 0) { // Night
          gradient = 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'; 
      } else {
          if (code <= 1) { // Sunny
               gradient = 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)'; // Bright Blue
          } else if (code <= 3) { // Cloudy
               gradient = 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)'; // Cloudy Purple/Blue
          } else if (code >= 95) { // Storm
               gradient = 'linear-gradient(135deg, #232526 0%, #414345 100%)'; // Dark storm
          } else { // Rain etc
               gradient = 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)'; // Rainy Blue
          }
      }
      
      document.body.style.background = gradient;
  },

  renderHourlyForecast(hourlyData, formatTemp, unitStr) {
      const listContainer = document.getElementById('hourly-list');
      listContainer.innerHTML = ''; // Clear previous

      const currentHour = new Date().getHours();
      let currentHourElement = null;
      
      // Show all 24 hours
      for (let i = 0; i < 24; i++) {
          
          // API returns an array that might be longer, usually matches index 0-23
          // Safety check
          if (i >= hourlyData.time.length) break;

          const timeStr = hourlyData.time[i]; 
          const dateObj = new Date(timeStr);
          const hour = dateObj.getHours();

          const temp = formatTemp(hourlyData.temperature_2m[i]);
          const code = hourlyData.weather_code[i];
          const codeInfo = this.getWeatherInfo(code);

          const item = document.createElement('div');
          item.className = 'hourly-item';
          
          // Highlight current hour visually
          if (hour === currentHour) {
              item.classList.add('current-hour-item');
              currentHourElement = item;
          }

          item.innerHTML = `
                  <div class="hour">${hour}:00</div>
                  <div class="icon">${codeInfo.icon}</div>
                  <div class="temp">${temp}${unitStr}</div>
          `;
          listContainer.appendChild(item);
      }

      // Scroll to current hour
      if (currentHourElement) {
          setTimeout(() => {
            const containerWidth = listContainer.clientWidth;
            const itemLeft = currentHourElement.offsetLeft;
            const itemWidth = currentHourElement.clientWidth;
            const scrollPos = itemLeft - (containerWidth / 2) + (itemWidth / 2);

            listContainer.scrollTo({
                left: scrollPos,
                behavior: 'smooth'
            });
          }, 100);
      }
  },

  renderDailyForecast(dailyData, formatTemp, unitStr) {
      const listContainer = document.getElementById('daily-list');
      listContainer.innerHTML = '';

      for (let i = 0; i < dailyData.time.length; i++) {
          const dateStr = dailyData.time[i];
          const date = new Date(dateStr);
          const dayName = i === 0 ? 'Heute' : date.toLocaleDateString('de-DE', { weekday: 'long' });

          const maxTemp = formatTemp(dailyData.temperature_2m_max[i]);
          const minTemp = formatTemp(dailyData.temperature_2m_min[i]);
          const code = dailyData.weather_code[i];
          const codeInfo = this.getWeatherInfo(code);

          const item = document.createElement('div');
          item.className = 'daily-item';
          item.innerHTML = `
            <div class="daily-day">${dayName}</div>
            <div class="daily-icon">${codeInfo.icon}</div>
            <div class="daily-temps">
                <span class="max-temp">${maxTemp}${unitStr}</span>
                <span class="min-temp">${minTemp}${unitStr}</span>
            </div>
          `;
          listContainer.appendChild(item);
      }
  },

  getWeatherInfo(wmoCode) {
      // https://open-meteo.com/en/docs
      const codes = {
          0: { description: 'Klar', icon: '☀️' },
          1: { description: 'Überwiegend klar', icon: '🌤️' },
          2: { description: 'Teils bewölkt', icon: '⛅' },
          3: { description: 'Bewölkt', icon: '☁️' },
          45: { description: 'Nebel', icon: '🌫️' },
          48: { description: 'Nebel mit Reif', icon: '🌫️' },
          51: { description: 'Leichter Nieselregen', icon: '🌦️' },
          53: { description: 'Nieselregen', icon: '🌦️' },
          55: { description: 'Starker Nieselregen', icon: '🌧️' },
          61: { description: 'Leichter Regen', icon: '🌦️' },
          63: { description: 'Regen', icon: '🌧️' },
          65: { description: 'Starker Regen', icon: '🌧️' },
          80: { description: 'Regenschauer', icon: '🌦️' },
          81: { description: 'Starke Regenschauer', icon: '🌧️' },
          95: { description: 'Gewitter', icon: '⚡' },
          96: { description: 'Gewitter mit Hagel', icon: '⛈️' },
          99: { description: 'Starkes Gewitter', icon: '⛈️' },
      };
      // Fallback für Schnee etc. vereinfacht
      if (wmoCode >= 71 && wmoCode <= 77) return { description: 'Schneefall', icon: '❄️' };
      if (wmoCode >= 85 && wmoCode <= 86) return { description: 'Schneeschauer', icon: '❄️' };

      return codes[wmoCode] || { description: 'Unbekannt', icon: '❓' };
  },

  showLoading(isLoading) {
      const el = document.getElementById('loading');
      if(el) el.style.display = isLoading ? 'block' : 'none';
  },

  showError(msg) {
      const el = document.getElementById('error-message');
      if (el) {
          el.textContent = msg || '';
          el.style.display = msg ? 'block' : 'none';
      }
  },


  displayWeather(data) {
    // UI Update
  },
};

// Start app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
