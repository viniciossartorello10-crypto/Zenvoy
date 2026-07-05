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
//
// IMPORTANT: Duffel's raw offer_requests response can be huge (hundreds of
// offers, each with full segment/baggage/condition detail) — for complex or
// long-haul routes this can exceed Netlify Functions' ~6MB response size
// limit (Function.ResponseSizeTooLarge). To avoid that, this function parses
// Duffel's response itself and returns only a small, trimmed summary of the
// 3 cheapest offers — never the full raw payload.

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

    if (!res.ok) {
      // Pass Duffel's exact error body through unchanged — error responses
      // are small and the exact detail is useful for diagnostics.
      const errText = await res.text();
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: errText
      };
    }

    // Success path: parse here and return ONLY a trimmed summary — this is
    // the part that can otherwise be megabytes in size on complex routes.
    const data = await res.json();
    const offers = (data && data.data && data.data.offers) || [];

    if (!offers.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offers: [] }) };
    }

    offers.sort(function (a, b) { return parseFloat(a.total_amount) - parseFloat(b.total_amount); });
    const trimmed = offers.slice(0, 5).map(function (o) {
      const firstSlice = o.slices[0];
      const firstSeg = firstSlice.segments[0];
      const lastSeg = firstSlice.segments[firstSlice.segments.length - 1];
      return {
        airline: firstSeg.operating_carrier ? firstSeg.operating_carrier.name : 'Airline',
        from: firstSeg.origin.iata_code,
        to: lastSeg.destination.iata_code,
        dep: firstSeg.departing_at || '',
        arr: lastSeg.arriving_at || '',
        dur: firstSlice.duration || '',
        stopCount: firstSlice.segments.length - 1,
        price: o.total_amount,
        currency: o.total_currency
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers: trimmed })
    };
  } catch (err) {
    // Genuine proxy-level failure (network error, DNS failure, or an error
    // while parsing/trimming the response) — include full detail so the
    // real cause is visible in the browser console instead of just "502".
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
