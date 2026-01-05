/**
 * Sun tab logic
 */
import OpenMeteo from "../openMeteo.js";
import { createAreaChart } from "../charts/simpleCharts.js";

/**
 * Load solar metrics (sunrise/sunset) for the given city and render into the sun panel.
 */
export async function load(city) {
  const el = document.getElementById("sun-content");
  if (!city) {
    el.textContent = "Enter a city to see sun data.";
    return null;
  }

  const canvas = document.getElementById("sun-canvas");
  el.hidden = true;
  canvas.hidden = false;
  const chart = createAreaChart(canvas, { title: `Shortwave Radiation — ${city}`, yLabel: "W/m²" });

  const [dailyData, hourlyData] = await Promise.all([
    OpenMeteo.getDailyForecast(city, { daily: ["sunrise", "sunset", "sunshine_duration"] }),
    OpenMeteo.getHourlyByType(city, "sun", { startDate: new Date(), endDate: new Date(new Date().getTime() + 48 * 60 * 60 * 1000) }),
  ]);

  if (!dailyData || !dailyData.daily) {
    el.hidden = false;
    el.textContent = "No sun data available.";
    canvas.hidden = true;
    return dailyData;
  }

  const dates = dailyData.daily.time || [];
  const sunrise = dailyData.daily.sunrise || [];
  const sunset = dailyData.daily.sunset || [];

  const dailyLines = dates.map((d, i) => `${d}: sunrise ${sunrise[i]}  •  sunset ${sunset[i]}`);

  let times = [];
  let rad = [];
  if (hourlyData && hourlyData.hourly) {
    times = hourlyData.hourly.time || [];
    rad = hourlyData.hourly.shortwave_radiation || [];
  }

  chart.update({ labels: times, series: rad });
  el.hidden = false;
  el.textContent = dailyLines.join("\n");
  return { daily: dailyData.daily, hourly: hourlyData && hourlyData.hourly };
}

export default { load };
