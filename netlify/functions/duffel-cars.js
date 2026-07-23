// Netlify Function: proxies Duffel's Cars search endpoint.
// Same CORS-dodging purpose as duffel-flights.js and duffel-stays.js.
//
// IMPORTANT CAVEAT: Duffel Cars launched in April 2026 and, unlike Flights
// and Stays, we could not find confirmed public documentation of its exact
// request/response schema at the time this was written. This implementation
// follows Duffel's established conventions (Bearer token, Duffel-Version
// header, JSON body, location+dates search shape modeled on Stays) as a
// best-effort. If the real schema differs, this fails gracefully — the
// frontend falls back to external car rental links, exactly like every
// other optional enrichment in this app. Nothing breaks either way.
//
// Expected call from the frontend (POST):
//   /.netlify/functions/duffel-cars
//   Body: { token, latitude, longitude, pickupDate, dropoffDate }

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (parseErr) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON in request body: ' + parseErr.message }) };
  }

  const { token, latitude, longitude, pickupDate, dropoffDate } = body;

  if (!token || latitude === undefined || longitude === undefined || !pickupDate || !dropoffDate) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: token, latitude, longitude, pickupDate, dropoffDate',
        received: { hasToken: !!token, hasLat: latitude !== undefined, hasLon: longitude !== undefined, hasPickup: !!pickupDate, hasDropoff: !!dropoffDate }
      })
    };
  }

  try {
    const res = await fetch('https://api.duffel.com/cars/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Duffel-Version': 'v2',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        data: {
          pickup_location: { latitude: latitude, longitude: longitude },
          pickup_date: pickupDate + 'T10:00:00',
          dropoff_date: dropoffDate + 'T10:00:00',
          driver_age: 30
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: res.status, headers: { 'Content-Type': 'application/json' }, body: errText };
    }

    const data = await res.json();
    const results = (data && data.data && data.data.results) || (data && data.data) || [];

    if (!Array.isArray(results) || !results.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cars: [] }) };
    }

    // Defensive extraction — same approach as duffel-stays.js, since the
    // exact response shape isn't confirmed. Checks a couple of plausible paths.
    const extracted = results.map(function (r) {
      const vehicle = r.vehicle || r;
      const photo = (vehicle.photos && vehicle.photos[0] && vehicle.photos[0].url) || null;
      const price = r.total_amount || r.cheapest_rate_total_amount || null;
      const currency = r.total_currency || r.cheapest_rate_currency || 'USD';
      return {
        name: vehicle.name || vehicle.model || 'Rental car',
        supplier: (r.supplier && r.supplier.name) || (vehicle.supplier && vehicle.supplier.name) || null,
        category: vehicle.category || null,
        photoUrl: photo,
        price: price,
        currency: currency
      };
    }).filter(function (c) { return c.price !== null; });

    extracted.sort(function (a, b) { return parseFloat(a.price) - parseFloat(b.price); });
    const trimmed = extracted.slice(0, 5);

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cars: trimmed }) };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy error reaching Duffel Cars', errorName: err.name, errorMessage: err.message, stack: err.stack })
    };
  }
};
