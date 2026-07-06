// Netlify Function: proxies Duffel's Stays (accommodation) search endpoint.
// Same CORS-dodging purpose as duffel-flights.js — the browser can't call
// api.duffel.com directly.
//
// Expected call from the frontend (POST):
//   /.netlify/functions/duffel-stays
//   Body: { token, latitude, longitude, checkIn, checkOut, guests, radius }
//
// IMPORTANT: like duffel-flights.js, this parses Duffel's response and
// returns only a small trimmed summary of the cheapest options — never the
// full raw payload — to avoid exceeding Netlify Functions' ~6MB response
// size limit on searches with many results.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (parseErr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON in request body: ' + parseErr.message })
    };
  }

  const { token, latitude, longitude, checkIn, checkOut, guests, radius } = body;

  if (!token || latitude === undefined || longitude === undefined || !checkIn || !checkOut) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: token, latitude, longitude, checkIn, checkOut',
        received: { hasToken: !!token, hasLat: latitude !== undefined, hasLon: longitude !== undefined, hasCheckIn: !!checkIn, hasCheckOut: !!checkOut }
      })
    };
  }

  const guestList = [];
  for (let i = 0; i < Math.max(1, guests || 1); i++) guestList.push({ type: 'adult' });

  try {
    const res = await fetch('https://api.duffel.com/stays/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Duffel-Version': 'v2',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        data: {
          location: { geographic_coordinates: { latitude: latitude, longitude: longitude }, radius: radius || 5 },
          check_in_date: checkIn,
          check_out_date: checkOut,
          guests: guestList
        }
      })
    });

    if (!res.ok) {
      // Pass Duffel's exact error body through — small and useful for diagnostics.
      const errText = await res.text();
      return { statusCode: res.status, headers: { 'Content-Type': 'application/json' }, body: errText };
    }

    const data = await res.json();
    const results = (data && data.data && data.data.results) || (data && data.data) || [];

    if (!Array.isArray(results) || !results.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stays: [] }) };
    }

    // Defensively extract fields — the exact nesting can vary, so we check
    // a couple of plausible shapes rather than assuming just one.
    const extracted = results.map(function (r) {
      const acc = r.accommodation || r;
      const photo = (acc.photos && acc.photos[0] && acc.photos[0].url) || null;
      const priceRaw = r.cheapest_rate_total_amount || acc.cheapest_rate_total_amount || null;
      const currency = r.cheapest_rate_currency || acc.cheapest_rate_currency || 'USD';
      return {
        name: acc.name || 'Hotel',
        rating: acc.rating || null,
        reviewScore: acc.review_score || null,
        reviewCount: acc.review_count || null,
        photoUrl: photo,
        price: priceRaw,
        currency: currency,
        accommodationId: acc.id || null
      };
    }).filter(function (s) { return s.price !== null; }); // drop entries with no usable price

    extracted.sort(function (a, b) { return parseFloat(a.price) - parseFloat(b.price); });
    const trimmed = extracted.slice(0, 5);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stays: trimmed })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Proxy error reaching Duffel Stays',
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack
      })
    };
  }
};
