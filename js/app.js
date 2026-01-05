import OpenMeteo from "./openMeteo.js";

const app = {
  async init() {
    this.cache = {};

    const form = document.getElementById("search-form");
    const input = document.getElementById("city-input");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const city = input.value.trim();
      if (!city) return;
      await this.handleSearch(city);
    });

    // Tab click handling (skeleton for future logic)
    document.querySelectorAll(".tab-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  async handleSearch(city) {
    try {
      this.setRawOutput("Loading...");

      // Fetch current and daily in parallel
      const [currentResp, dailyResp] = await Promise.all([
        OpenMeteo.getCurrentWeather(city),
        OpenMeteo.getDailyForecast(city),
      ]);

      const combined = {
        city,
        current: currentResp.current,
        daily: dailyResp.daily,
        location: currentResp.location,
      };

      this.cache[city.toLowerCase()] = combined;
      this.displayWeather(combined);
    } catch (err) {
      this.setRawOutput(`Error: ${err.message}`);
      console.error(err);
    }
  },

  switchTab(tabName) {
    // Basic tab UI switching; actual metric logic implemented per-tab later
    document.querySelectorAll(".tab-item").forEach((el) => el.classList.toggle("active", el.dataset.tab === tabName));
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabName;
    });
  },

  displayWeather(data) {
    // Simple population of the panels; placeholder for specific metric logic
    const raw = document.getElementById("raw-output");
    const tempContent = document.getElementById("temp-content");
    const rainContent = document.getElementById("rain-content");
    const sunContent = document.getElementById("sun-content");
    const snowContent = document.getElementById("snow-content");

    raw.textContent = JSON.stringify(data, null, 2);

    // Temp panel: show current temperature and unit
    if (data.current) {
      tempContent.textContent = `Current: ${data.current.temperature}° (wind ${data.current.windspeed} km/h)`;
    } else {
      tempContent.textContent = "No current data";
    }

    // Rain/sun/snow placeholders — expand with daily/hourly arrays later
    rainContent.textContent = "Rain metrics will be shown here.";
    sunContent.textContent = "Sun metrics will be shown here.";
    snowContent.textContent = "Snow metrics will be shown here.";

    // Ensure default active tab
    this.switchTab("temp");
  },

  setRawOutput(text) {
    const raw = document.getElementById("raw-output");
    raw.textContent = text;
  },
};

// Start app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
