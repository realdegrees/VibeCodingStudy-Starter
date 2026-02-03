import { config } from './config.js';

const app = {
  elements: {
    searchInput: document.getElementById('city-search'),
    searchBtn: document.getElementById('search-btn'),
    searchResults: document.getElementById('search-results'),
    weatherContent: document.getElementById('weather-content'),
    loading: document.getElementById('loading'),
    ivyContainer: document.getElementById('ivy-container'),
    unitToggle: document.getElementById('unit-toggle'),
    dailyForecast: document.getElementById('daily-forecast'),
  },

  state: {
    currentLocation: null,
    units: 'metric', // 'metric' or 'imperial'
    selectedDayIndex: 0, // 0 = today, 1 = tomorrow, etc.
    weatherData: null,
  },

  init() {
    this.bindEvents();
    // Pre-generate Ivy (invisible)
    this.generateIvy();
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  bindEvents() {
    this.elements.searchBtn.addEventListener('click', () => {
      const query = this.elements.searchInput.value;
      if (query) this.searchLocation(query);
    });

    this.elements.unitToggle.addEventListener('click', () => {
      this.state.units = this.state.units === 'metric' ? 'imperial' : 'metric';
      this.elements.unitToggle.querySelector('.unit-icon').textContent = this.state.units === 'metric' ? '°C' : '°F';

      if (this.state.currentLocation) {
        this.fetchWeather(this.state.currentLocation);
      }
    });

    // Instant search with debounce
    const debouncedSearch = this.debounce((e) => {
      const query = e.target.value;
      if (query) this.searchLocation(query);
    }, 300);

    this.elements.searchInput.addEventListener('input', debouncedSearch);

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.elements.searchResults.contains(e.target) &&
        e.target !== this.elements.searchInput) {
        this.elements.searchResults.classList.add('hidden');
      }
    });
  },

  async searchLocation(query) {
    if (query.length < 2) return;

    try {
      const response = await fetch(`${config.GEOCODING_API_URL}?name=${query}&count=5&language=en&format=json`);
      if (!response.ok) throw new Error('Geocoding fetch failed');

      const data = await response.json();
      this.displaySearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching location:', error);
      // Optionally show user support
    }
  },

  displaySearchResults(results) {
    const resultsContainer = this.elements.searchResults;
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
      resultsContainer.classList.add('hidden');
      return;
    }

    const ul = document.createElement('ul');
    results.forEach(result => {
      const li = document.createElement('li');
      li.textContent = `${result.name}, ${result.country}`;
      if (result.admin1) li.textContent += ` (${result.admin1})`;

      li.addEventListener('click', () => {
        this.elements.searchInput.value = result.name;
        resultsContainer.classList.add('hidden');
        this.fetchWeather(result);
      });
      ul.appendChild(li);
    });

    resultsContainer.appendChild(ul);
    resultsContainer.classList.remove('hidden');
  },

  async fetchWeather(locationData) {
    this.state.currentLocation = locationData;
    this.elements.weatherContent.classList.add('hidden');
    this.resetIvy();
    this.animateIvy();

    try {
      const { latitude, longitude } = locationData;
      const isMetric = this.state.units === 'metric';

      const params = new URLSearchParams({
        latitude,
        longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,cloud_cover',
        hourly: 'temperature_2m,weather_code,precipitation_probability,surface_pressure,visibility,uv_index',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
        current_units: isMetric ? 'temperature_2m,wind_speed_10m,precipitation' : 'temperature_2m,wind_speed_10m,precipitation',
        temperature_unit: isMetric ? 'celsius' : 'fahrenheit',
        windspeed_unit: isMetric ? 'kmh' : 'mph',
        precipitation_unit: isMetric ? 'mm' : 'inch',
        timezone: 'auto'
      });

      // Simulate delay to show off animation
      await new Promise(r => setTimeout(r, 1000));

      const response = await fetch(`${config.API_URL}/forecast?${params.toString()}`);
      if (!response.ok) throw new Error('Weather data fetch failed');

      const data = await response.json();
      this.state.weatherData = data;

      // Reset to Day 0 (Today) on new search
      this.state.selectedDayIndex = 0;

      this.updateDisplay();
    } catch (error) {
      console.error('Error fetching weather:', error);
      alert('Failed to fetch weather data. Please try again.');
    }
  },

  updateDisplay() {
    if (!this.state.weatherData) return;

    this.displayDailyForecast();
    this.displayWeather();
  },

  generateIvy() {
    const svgNS = "http://www.w3.org/2000/svg";
    const container = this.elements.ivyContainer;
    container.innerHTML = '';

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "ivy-svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");

    // Procedural Vine Generation
    const createVine = (startX, startY, angle, length, width, depth) => {
      if (depth === 0 || length < 20) return;

      // Calculate end point with some curve
      // Bezier control points
      const rad = angle * (Math.PI / 180);
      const endX = startX + Math.cos(rad) * length;
      const endY = startY + Math.sin(rad) * length;

      // Randomize control points for organic flow
      const cp1X = startX + Math.cos(rad - 0.2) * (length / 3);
      const cp1Y = startY + Math.sin(rad - 0.2) * (length / 3);
      const cp2X = endX - Math.cos(rad + 0.2) * (length / 3);
      const cp2Y = endY - Math.sin(rad + 0.2) * (length / 3);

      const path = document.createElementNS(svgNS, "path");
      const d = `M${startX},${startY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`;
      path.setAttribute("d", d);
      path.setAttribute("class", "ivy-stem");
      // Vary stroke width
      path.style.strokeWidth = width;
      // Stagger animations based on depth
      path.style.animationDelay = `${(5 - depth) * 0.5}s`;
      svg.appendChild(path);

      // Add Leaves along the path
      const leafCount = Math.floor(length / 40);
      for (let i = 1; i <= leafCount; i++) {
        const t = i / (leafCount + 1);
        // Estimate point on curve (simple linear approx for placement)
        const lx = startX + (endX - startX) * t;
        const ly = startY + (endY - startY) * t; // + jitter?

        // Actually computing bezier point is better but expensive, linear is ok for this "vibe"
        // Let's add some randomness to leaf position
        const leafGroup = document.createElementNS(svgNS, "g");
        leafGroup.setAttribute("transform", `translate(${lx}, ${ly}) rotate(${Math.random() * 360})`);

        const leaf = document.createElementNS(svgNS, "path");
        leaf.setAttribute("d", "M0,0 Q-10,-15 0,-30 Q10,-15 0,0");
        leaf.setAttribute("class", "ivy-leaf");
        leaf.style.transform = "scale(0)";
        leaf.dataset.delay = `${(5 - depth) * 0.5 + i * 0.2}s`; // Stagger leaves

        leafGroup.appendChild(leaf);
        svg.appendChild(leafGroup);
      }

      // Branching
      // Chance to split
      const branchCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 branches
      for (let i = 0; i < branchCount; i++) {
        // Diverge angle
        const newAngle = angle + (Math.random() * 60 - 30); // +/- 30 degrees
        const newLength = length * 0.8;
        const newWidth = Math.max(1, width * 0.7);

        createVine(endX, endY, newAngle, newLength, newWidth, depth - 1);
      }
    };

    // Start a few main stems from the bottom
    // Center-ish
    createVine(width * 0.2, height, -80, height * 0.4, 6, 5);
    createVine(width * 0.5, height, -90, height * 0.5, 8, 6);
    createVine(width * 0.8, height, -100, height * 0.4, 6, 5);

    this.elements.ivyContainer.appendChild(svg);
  },

  resetIvy() {
    const stem = document.querySelector('.ivy-stem');
    const leaves = document.querySelectorAll('.ivy-leaf');
    if (stem) {
      stem.classList.remove('grow-stem');
      const newStem = stem.cloneNode(true);
      stem.parentNode.replaceChild(newStem, stem);
    }
    leaves.forEach(leaf => {
      leaf.classList.remove('grow-leaf');
      leaf.style.transform = 'scale(0)';
    });
  },

  animateIvy() {
    const stem = document.querySelector('.ivy-stem');
    const leaves = document.querySelectorAll('.ivy-leaf');

    if (stem) {
      stem.classList.add('grow-stem');
    }

    leaves.forEach(leaf => {
      leaf.style.animationDelay = leaf.dataset.delay;
      leaf.classList.add('grow-leaf');
    });
  },

  displayDailyForecast() {
    const { daily } = this.state.weatherData;
    const container = this.elements.dailyForecast;
    container.innerHTML = '';
    container.classList.remove('hidden');

    daily.time.forEach((time, index) => {
      const date = new Date(time);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const maxTemp = Math.round(daily.temperature_2m_max[index]);
      const minTemp = Math.round(daily.temperature_2m_min[index]);
      const code = daily.weather_code[index];
      const isActive = index === this.state.selectedDayIndex;

      const card = document.createElement('div');
      card.className = `daily-card ${isActive ? 'active' : ''}`;
      card.innerHTML = `
                <div class="day-name">${dayName}</div>
                <div class="day-icon">${this.getWeatherDescription(code).icon}</div>
                <div class="day-temp">${maxTemp}° / ${minTemp}°</div>
            `;

      card.addEventListener('click', () => {
        this.state.selectedDayIndex = index;
        this.updateDisplay();
      });

      container.appendChild(card);
    });
  },

  displayWeather() {
    const data = this.state.weatherData;
    if (!data) return;

    const index = this.state.selectedDayIndex;
    const isToday = index === 0;
    const cityName = this.state.currentLocation.name;

    let displayData = {};
    const units = data.current_units;

    const getDesc = this.getWeatherDescription.bind(this);

    if (isToday) {
      displayData = {
        temp: data.current.temperature_2m,
        condition: getDesc(data.current.weather_code).label,
        icon: getDesc(data.current.weather_code).icon,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        wind: data.current.wind_speed_10m,
        rainChance: data.hourly.precipitation_probability[new Date().getHours()] || 0,
        pressure: data.current.surface_pressure,
        uv: data.daily.uv_index_max[0],
        sunrise: data.daily.sunrise[0],
        sunset: data.daily.sunset[0],
      };
    } else {
      displayData = {
        temp: data.daily.temperature_2m_max[index],
        condition: getDesc(data.daily.weather_code[index]).label,
        icon: getDesc(data.daily.weather_code[index]).icon,
        feelsLike: data.daily.temperature_2m_min[index],
        humidity: '-',
        wind: '-',
        rainChance: '-',
        pressure: '-',
        uv: data.daily.uv_index_max[index],
        sunrise: data.daily.sunrise[index],
        sunset: data.daily.sunset[index],
      };
    }

    const formatTime = (isoString) => {
      if (!isoString) return '-';
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const currentWeatherHTML = `
            <div class="weather-card current-main">
                <h2>${cityName} <span style="font-size:0.5em; font-weight:normal;">${isToday ? '(Now)' : `(${new Date(data.daily.time[index]).toLocaleDateString('en-US', { weekday: 'long' })})`}</span></h2>
                <div class="temp-big">${displayData.temp}${units.temperature_2m}</div>
                <div class="condition">${displayData.condition}</div>
                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="label">Feels like</span>
                        <span class="value">${displayData.feelsLike}${units.temperature_2m}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Humidity</span>
                        <span class="value">${displayData.humidity}${isToday ? units.relative_humidity_2m : ''}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Wind</span>
                        <span class="value">${displayData.wind}${isToday ? units.wind_speed_10m : ''}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Rain Chance</span>
                        <span class="value">${displayData.rainChance}${isToday ? '%' : ''}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">UV Index</span>
                        <span class="value">${displayData.uv}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Pressure</span>
                        <span class="value">${displayData.pressure} hPa</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Sunrise</span>
                        <span class="value">${formatTime(displayData.sunrise)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Sunset</span>
                        <span class="value">${formatTime(displayData.sunset)}</span>
                    </div>
                </div>
            </div>
        `;

    const startHourIndex = index * 24;
    const endHourIndex = startHourIndex + 24;

    let forecastHTML = '<div class="forecast-scroll">';

    for (let i = startHourIndex; i < endHourIndex; i++) {
      if (i >= data.hourly.time.length) break;

      const time = data.hourly.time[i];
      const temp = data.hourly.temperature_2m[i];
      const code = data.hourly.weather_code[i];
      const date = new Date(time);
      const hours = date.getHours().toString().padStart(2, '0') + ':00';

      const isCurrentHour = isToday && date.getHours() === new Date().getHours();

      forecastHTML += `
                <div class="forecast-item ${isCurrentHour ? 'active-hour' : ''}" style="${isCurrentHour ? 'background:var(--color-secondary);' : ''}">
                    <div class="time">${hours}</div>
                    <div class="icon">${this.getWeatherDescription(code).icon}</div>
                    <div class="temp">${temp}${units.temperature_2m}</div>
                </div>
            `;
    }
    forecastHTML += '</div>';

    // Graph Container
    forecastHTML += '<div id="hourly-graph"></div>';

    this.elements.weatherContent.innerHTML = `
            <section class="current-weather">${currentWeatherHTML}</section>
            <section class="forecast">
                <h3>Hourly Forecast & Trend</h3>
                ${forecastHTML}
            </section>
        `;
    this.elements.weatherContent.classList.remove('hidden');

    // Generate Graph after insertion
    const hourlySlice = [];
    for (let i = startHourIndex; i < endHourIndex; i++) {
      if (i < data.hourly.time.length) {
        hourlySlice.push(data.hourly.temperature_2m[i]);
      }
    }
    this.generateGraph(hourlySlice);
  },

  generateGraph(temps) {
    const container = document.getElementById('hourly-graph');
    if (!container || temps.length === 0) return;

    // Increase height for labels
    const width = container.offsetWidth || 600;
    const height = (container.offsetHeight || 150) + 20;
    const padding = 30; // More padding for text

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    // Ensure we have some range to avoid flatline division by zero
    const range = (maxTemp - minTemp) || 1;

    const getX = (i) => (i / (temps.length - 1)) * (width - padding * 2) + padding;
    // Invert Y so higher temp is higher up
    const getY = (temp) => height - padding - ((temp - minTemp) / range) * (height - padding * 3);

    // Build path
    let d = `M${getX(0)},${getY(temps[0])}`;
    for (let i = 1; i < temps.length; i++) {
      const x = getX(i);
      const y = getY(temps[i]);
      d += ` L${x},${y}`;
    }

    // Fill path (close loop)
    const dFill = `${d} L${getX(temps.length - 1)},${height} L${getX(0)},${height} Z`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "graph-svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");

    // Defs for gradient
    const defs = document.createElementNS(svgNS, "defs");
    const lg = document.createElementNS(svgNS, "linearGradient");
    lg.setAttribute("id", "gradient-fill");
    lg.setAttribute("x1", "0");
    lg.setAttribute("x2", "0");
    lg.setAttribute("y1", "0");
    lg.setAttribute("y2", "1");

    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "var(--color-primary)");
    stop1.setAttribute("stop-opacity", "0.5");

    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "var(--color-primary)");
    stop2.setAttribute("stop-opacity", "0");

    lg.appendChild(stop1);
    lg.appendChild(stop2);
    defs.appendChild(lg);
    svg.appendChild(defs);

    const fillPath = document.createElementNS(svgNS, "path");
    fillPath.setAttribute("d", dFill);
    fillPath.setAttribute("class", "graph-fill");
    svg.appendChild(fillPath);

    const linePath = document.createElementNS(svgNS, "path");
    linePath.setAttribute("d", d);
    linePath.setAttribute("class", "graph-line");
    svg.appendChild(linePath);

    // Add points and labels
    temps.forEach((temp, i) => {
      const x = getX(i);
      const y = getY(temp);

      // Circle point
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 3);
      circle.setAttribute("class", "graph-point");
      svg.appendChild(circle);

      // Text Label (only every 2nd point to avoid crowding, always first/last)
      if (i % 2 === 0 || i === temps.length - 1) {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y - 10); // Above the point
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("class", "graph-label");
        text.textContent = Math.round(temp) + '°';
        svg.appendChild(text);
      }
    });

    container.innerHTML = '';
    container.appendChild(svg);
  },

  getWeatherDescription(code) {
    const codes = {
      0: { label: 'Clear sky', icon: '☀️' },
      1: { label: 'Mainly clear', icon: '🌤️' },
      2: { label: 'Partly cloudy', icon: '⛅' },
      3: { label: 'Overcast', icon: '☁️' },
      45: { label: 'Fog', icon: '🌫️' },
      48: { label: 'Depositing rime fog', icon: '🌫️' },
      51: { label: 'Light Drizzle', icon: '🌧️' },
      61: { label: 'Slight Rain', icon: '🌧️' },
      63: { label: 'Moderate Rain', icon: '🌧️' },
      65: { label: 'Heavy Rain', icon: '🌧️' },
      71: { label: 'Slight Snow', icon: '❄️' },
      73: { label: 'Moderate Snow', icon: '❄️' },
      75: { label: 'Heavy Snow', icon: '❄️' },
      95: { label: 'Thunderstorm', icon: '⚡' },
    };
    return codes[code] || { label: 'Unknown', icon: '❓' };
  }
};

document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
