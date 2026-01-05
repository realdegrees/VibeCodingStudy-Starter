/**
 * Snow tab logic
 */
import OpenMeteo from "../openMeteo.js";

/**
 * Load snowfall metrics for the given city and render into the snow panel.
 */
export async function load(city) {
  const el = document.getElementById("snow-content");
  if (!city) {
    el.textContent = "Enter a city to see snow data.";
    return null;
  }

  el.textContent = "Loading snow data...";
  const data = await OpenMeteo.getDailyForecast(city, {
    daily: ["snowfall_sum"],
  });

  if (!data || !data.daily) {
    el.textContent = "No snow data available.";
    return data;
  }

  const dates = data.daily.time || [];
  const snow = data.daily.snowfall_sum || [];

  const lines = dates.map((d, i) => `${d}: ${snow[i]} cm`);
  el.textContent = lines.join("\n");
  return data;
}

export default { load };
