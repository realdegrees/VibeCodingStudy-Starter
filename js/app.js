const app = {
  async init() {
    const response = await fetch(
      `${config.API_URL}/forecast?latitude=52.52&longitude=13.41&current_weather=true`
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log(data);
  },

  fetchWeather(city) {
    // API-Call
  },

  displayWeather(data) {
    // UI Update
  },
};

// Start app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
