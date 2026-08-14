// CORS wrapper — lets the Capacitor Android app (origin https://localhost) call
// this function cross-origin. Adds the headers to every response and answers
// the preflight OPTIONS request. Web (same-origin) calls are unaffected.
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
function withCors(handler) {
  return async function (event, context) {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    var res = await handler(event, context);
    res.headers = Object.assign({}, res.headers || {}, CORS_HEADERS);
    return res;
  };
}

// Netlify Function: proxies OpenWeather's Geocoding + One Call / forecast
// endpoints to get a real weather forecast for the destination, using a
// server-side key (OPENWEATHER_API_KEY env var) — no key ever reaches the
// browser. If the key isn't configured, or the city can't be geocoded, this
// returns null and the frontend just keeps the AI's text-based weather
// guess instead — nothing breaks either way.
//
// Expected call from the frontend (GET):
//   /.netlify/functions/weather?city=Lisbon

var _handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const city = params.city;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is not configured with an OPENWEATHER_API_KEY environment variable.' }) };
    }
    if (!city) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required param: city' }) };
    }

    // Step 1: geocode the city name to lat/lon (OpenWeather's forecast
    // endpoints need coordinates, not a free-text city name).
    const geoUrl = 'https://api.openweathermap.org/geo/1.0/direct?q=' + encodeURIComponent(city) + '&limit=1&appid=' + apiKey;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return { statusCode: geoRes.status, body: JSON.stringify({ error: 'Geocoding failed' }) };
    const geoData = await geoRes.json();
    if (!geoData || !geoData.length) return { statusCode: 404, body: JSON.stringify({ error: 'City not found: ' + city }) };
    const { lat, lon } = geoData[0];

    // Step 2: 5-day / 3-hour forecast (available on OpenWeather's free tier —
    // unlike One Call 3.0, which requires a separate paid subscription).
    const forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast?lat=' + lat + '&lon=' + lon + '&units=metric&appid=' + apiKey;
    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) return { statusCode: forecastRes.status, body: JSON.stringify({ error: 'Forecast fetch failed' }) };
    const forecastData = await forecastRes.json();

    // Collapse the 3-hour slices into one summary per day (min/max temp,
    // most common condition/icon for that day) — the frontend just wants a
    // simple daily forecast, not 40 raw 3-hour data points.
    const byDay = {};
    (forecastData.list || []).forEach(function (slot) {
      const day = slot.dt_txt.split(' ')[0];
      if (!byDay[day]) byDay[day] = { temps: [], icons: {}, descriptions: {} };
      byDay[day].temps.push(slot.main.temp);
      const icon = slot.weather[0].icon;
      const desc = slot.weather[0].description;
      byDay[day].icons[icon] = (byDay[day].icons[icon] || 0) + 1;
      byDay[day].descriptions[desc] = (byDay[day].descriptions[desc] || 0) + 1;
    });

    const daily = Object.keys(byDay).slice(0, 5).map(function (day) {
      const d = byDay[day];
      const topIcon = Object.keys(d.icons).sort(function (a, b) { return d.icons[b] - d.icons[a]; })[0];
      const topDesc = Object.keys(d.descriptions).sort(function (a, b) { return d.descriptions[b] - d.descriptions[a]; })[0];
      return {
        date: day,
        minTemp: Math.round(Math.min.apply(null, d.temps)),
        maxTemp: Math.round(Math.max.apply(null, d.temps)),
        icon: topIcon,
        description: topDesc
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: geoData[0].name, country: geoData[0].country, daily: daily })
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Proxy error: ' + err.message }) };
  }
};

exports.handler = withCors(_handler);
