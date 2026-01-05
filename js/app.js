import OpenMeteo from "./openMeteo.js";

const app = {
  async init() {
    this.cache = {};
    this.form = document.getElementById("search-form");
    this.input = document.getElementById("city-input");
    this.forecastContainer = document.getElementById("forecast-container");

    this.form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const city = this.input.value.trim();
      if (!city) return;
      await this.handleSearch(city);
    });
  },

  async handleSearch(city) {
    try {
      if (this.forecastContainer) this.forecastContainer.innerHTML = "<div class=\"no-data\">Loading forecast...</div>";

      const currentResp = await OpenMeteo.getCurrentWeather(city);

      // Request a few days of hourly variables we need
      const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const hourlyResp = await OpenMeteo.getHourlyByVariables(city, [
        "temperature_2m",
        "precipitation",
        "rain",
        "showers",
        "snowfall",
        "weathercode",
        "shortwave_radiation",
        "is_day",
      ], { startDate: new Date(), endDate });

      const combined = {
        city,
        current: currentResp.current,
        location: currentResp.location,
        hourly: hourlyResp.hourly,
      };

      this.cache[city.toLowerCase()] = combined;
      this.renderForecast(combined);
    } catch (err) {
      console.error(err);
      if (this.forecastContainer) this.forecastContainer.innerHTML = `<div class="no-data">Error loading forecast: ${err.message}</div>`;
    }
  },

  renderForecast(data) {
    const container = this.forecastContainer;
    if (!container) return;
    const hourly = data.hourly;
    if (!hourly || !hourly.time) {
      container.innerHTML = '<div class="no-data">No hourly data available.</div>';
      return;
    }

    const times = hourly.time || [];
    const temps = hourly.temperature_2m || [];
    const precip = hourly.precipitation || [];
    const snowfall = hourly.snowfall || [];
    const rain = hourly.rain || [];
    const showers = hourly.showers || [];
    const weathercode = hourly.weathercode || [];
    const shortwave = hourly.shortwave_radiation || [];
    const is_day = hourly.is_day || [];

    // Group by local day (YYYY-MM-DD)
    const days = {};
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const d = new Date(t);
      const dayKey = d.toISOString().slice(0, 10);
      if (!days[dayKey]) days[dayKey] = [];
      days[dayKey].push({
        time: d,
        temp: temps[i],
        precip: precip[i],
        snowfall: snowfall[i],
        rain: rain[i],
        showers: showers[i],
        weathercode: weathercode[i],
        shortwave: shortwave[i],
        is_day: is_day[i],
      });
    }

    let html = "";
    const dayKeys = Object.keys(days).sort();

    // Build a simple day tab list and a single-day column area
    html += `<div class="day-tabs" role="tablist">`;
    for (let i = 0; i < dayKeys.length; i++) {
      const dayKey = dayKeys[i];
      const dateObj = new Date(dayKey + 'T00:00:00');
      const headerLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const sel = i === 0 ? ' selected' : '';
      html += `<button class="day-tab${sel}" data-day="${dayKey}" role="tab" aria-selected="${i === 0}">${headerLabel}</button>`;
    }
    html += `</div>`;

    // Render the first day column initially
    const firstKey = dayKeys[0];
    html += `<div class="single-day">`;
    html += renderDayHtml(firstKey, days[firstKey]);
    html += `</div>`;

    container.innerHTML = html;

    // Helper to render day's inner HTML for reuse
    function renderDayHtml(dayKey, entries) {
      const totalPrecip = entries.reduce((s, e) => s + (Number(e.precip) || 0), 0).toFixed(1);
      const tempsArr = entries.map((e) => (Number(e.temp) || -999)).filter((v) => v > -998);
      const maxTemp = tempsArr.length ? Math.max(...tempsArr) : null;
      const dateObj = new Date(dayKey + 'T00:00:00');
      const headerLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      let inner = `<div class="hours" role="list">`;
      for (const e of entries) {
        const hh = e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const icon = getIconForEntry(e);
        const precipLabel = e.precip ? `${e.precip} mm` : '';
        const snowLabel = e.snowfall ? `${e.snowfall} cm` : '';
        // determine time-of-day class
        const hr = e.time.getHours();
        let tod = 'day';
        if (!e.is_day || e.is_day === 0) tod = 'night';
        else if (hr >= 5 && hr < 11) tod = 'morning';
        else if (hr >= 11 && hr < 17) tod = 'day';
        else tod = 'evening';

        const todLabel = tod[0].toUpperCase() + tod.slice(1);
        const weatherText = weatherCodeToText(Number(e.weathercode));

        // precipitation icons
        const precipIcon = (Number(e.precip) || 0) > 0 ? `<span class="precip-icon" title="Precipitation: ${precipLabel}">💧</span>` : '';
        const snowIcon = (Number(e.snowfall) || 0) > 0 ? `<span class="snow-icon" title="Snowfall: ${snowLabel}">❄️</span>` : '';

        inner += `<div class="hour-row" role="listitem" data-time="${e.time.toISOString()}"><div class="time-indicator ${tod}" title="${todLabel}" aria-hidden="true"></div><div class="hour-time">${hh}</div><div class="hour-icon" title="${weatherText}">${icon}</div><div class="hour-temp" title="Temperature">${e.temp ?? '--'}°</div><div class="hour-precip">${precipIcon}${precipLabel}${snowIcon ? ' ' + snowIcon + snowLabel : ''}</div></div>`;
      }
      inner += `</div>`;
      return inner;
    }

    // Wire up tab clicks to swap the single-day view
    const tabs = container.querySelectorAll('.day-tab');
    const singleDay = container.querySelector('.single-day');
    tabs.forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const target = ev.currentTarget;
        const dayKey = target.getAttribute('data-day');
        // update selection classes and aria
        tabs.forEach((t) => { t.classList.remove('selected'); t.setAttribute('aria-selected', 'false'); });
        target.classList.add('selected');
        target.setAttribute('aria-selected', 'true');
        // update the day column
        singleDay.innerHTML = renderDayHtml(dayKey, days[dayKey]);
      });
    });
  },

  setRawOutput(text) {
    const raw = document.getElementById("raw-output");
    if (raw) raw.textContent = text;
  },
};

function getIconForEntry(entry) {
  // Snow takes precedence
  const snow = Number(entry.snowfall) || 0;
  const p = Number(entry.precip) || 0;
  const sw = Number(entry.shortwave) || 0;
  const day = entry.is_day === 1 || entry.is_day === true;

  if (snow > 0.1) return '❄️';
  if (p > 10) return '💦';
  if (p > 2) return '💧💧';
  if (p > 0.1) return '💧';
  if (day && sw > 120) return '☀️';
  // fallback by weathercode: 0 clear — respect day/night
  if (entry.weathercode === 0) return day ? '☀️' : '🌙';
  // default: show partly-cloudy in day, cloud at night
  return day ? '⛅' : '☁️';
}

/**
 * Map WMO `weathercode` to human readable text.
 */
function weatherCodeToText(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    80: 'Rain showers: Slight',
    81: 'Rain showers: Moderate',
    82: 'Rain showers: Violent',
    85: 'Snow showers: Slight',
    86: 'Snow showers: Heavy',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] || `Weather code ${code}`;
}

// Start app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
