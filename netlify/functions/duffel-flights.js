// Netlify Function: proxies Duffel's Offer Requests endpoint.
// The browser can't call api.duffel.com directly (CORS), so the frontend
// calls THIS function instead, and this function (running on Netlify's
// server) calls Duffel on the browser's behalf.
//
// Expected call from the frontend (POST):
//   /.netlify/functions/duffel-flights
//   Body: { token: "duffel_test_...", slices: [...], passengers: [...], cabin_class: "economy" }
//
// The Duffel token is passed through from the browser (same pattern as
// the TripAdvisor proxy) — this function does not store its own secret.

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

  const { token, slices, passengers, cabin_class } = body;

  if (!token || !slices || !passengers) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: token, slices, passengers',
        received: { hasToken: !!token, hasSlices: !!slices, hasPassengers: !!passengers }
      })
    };
  }

  try {
    const res = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Duffel-Version': 'v2',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ data: { slices, passengers, cabin_class: cabin_class || 'economy' } })
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Proxy error reaching Duffel',
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack
      })
    };
  }
};
