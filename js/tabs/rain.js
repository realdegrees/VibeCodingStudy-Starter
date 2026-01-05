/**
 * Rain tab logic
 */
import OpenMeteo from "../openMeteo.js";
import { createBarChart } from "../charts/simpleCharts.js";

/**
 * Load rainfall metrics for the given city and render into the rain panel.
 */
export async function load(city) {
  const el = document.getElementById("rain-content");
  if (!city) {
    el.textContent = "Enter a city to see rain data.";
    return null;
  }

  const canvas = document.getElementById("rain-canvas");
  el.hidden = true;
  canvas.hidden = false;
  const chart = createBarChart(canvas, { fillStyle: "#3498db", title: `Precipitation — ${city}`, yLabel: "mm" });

  const data = await OpenMeteo.getHourlyByType(city, "rain", { startDate: new Date(), endDate: new Date(new Date().getTime() + 48 * 60 * 60 * 1000) });
  if (!data || !data.hourly) {
    el.hidden = false;
    el.textContent = "No rain data available.";
    canvas.hidden = true;
    return data;
  }

  const dates = data.hourly.time || [];
  const precip = data.hourly.precipitation || [];
  chart.update({ labels: dates, series: precip });
  return data;
}

export default { load };
