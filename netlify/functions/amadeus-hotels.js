// Netlify Function: real hotel search via Amadeus for Developers' Hotel
// Search API — used instead of Duffel Stays (netlify/functions/duffel-stays.js),
// which returns 403 "This feature is not enabled for your account" on this
// Duffel account. duffel-stays.js is kept, unused, in case Duffel Stays gets
// enabled later; this function is what the frontend actually calls today.
//
// Unlike Duffel's single static bearer token, Amadeus uses OAuth2
// client-credentials: an API Key + API Secret are exchanged for a
// short-lived (30 min) access token on every call, since Netlify Functions
// are stateless between invocations and can't reliably cache it.
//
// A fresh self-serve Amadeus signup only has access to the TEST environment
// (test.api.amadeus.com), which serves a limited, curated dataset — not the
// full production hotel inventory. That's expected and not a bug; coverage
// for smaller cities may be sparse until/unless the account is moved to
// production. When Amadeus returns few or no hotels, this returns
// { stays: [] } and the app's existing AI-estimated accommodations fill the
// gap, exactly like it already does for uncovered Duffel Stays cities.
//
// Expected call from the frontend (POST):
//   /.netlify/functions/amadeus-hotels
//   Body: { latitude, longitude, checkIn, checkOut, guests, radius }

const AMADEUS_BASE = 'https://test.api.amadeus.com';

async function getAccessToken(apiKey, apiSecret) {
  const res = await fetch(AMADEUS_BASE + '/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret
    }).toString()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Amadeus auth failed (' + res.status + '): ' + errText);
  }
  const data = await res.json();
  return data.access_token;
}

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

  const { latitude, longitude, checkIn, checkOut, guests, radius } = body;
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured with AMADEUS_API_KEY / AMADEUS_API_SECRET environment variables. Set them in Netlify: Site configuration > Environment variables.' })
    };
  }

  if (latitude === undefined || longitude === undefined || !checkIn || !checkOut) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: latitude, longitude, checkIn, checkOut',
        received: { hasLat: latitude !== undefined, hasLon: longitude !== undefined, hasCheckIn: !!checkIn, hasCheckOut: !!checkOut }
      })
    };
  }

  try {
    const token = await getAccessToken(apiKey, apiSecret);
    const authHeader = { Authorization: 'Bearer ' + token };

    // Step 1: find hotel IDs near these coordinates.
    const geoUrl = AMADEUS_BASE + '/v1/reference-data/locations/hotels/by-geocode?' +
      new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(radius || 5), radiusUnit: 'KM' }).toString();
    const geoRes = await fetch(geoUrl, { headers: authHeader });

    if (!geoRes.ok) {
      const errText = await geoRes.text();
      return { statusCode: geoRes.status, headers: { 'Content-Type': 'application/json' }, body: errText };
    }

    const geoData = await geoRes.json();
    const hotels = (geoData && geoData.data) || [];
    if (!hotels.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stays: [] }) };
    }

    // Step 2: get priced offers for those hotels. The offers endpoint has a
    // practical limit on how many hotelIds can be queried at once — 20 is a
    // safe, well-documented ceiling.
    const hotelIds = hotels.slice(0, 20).map(function (h) { return h.hotelId; }).filter(Boolean);
    const guestCount = Math.max(1, guests || 1);
    const offersUrl = AMADEUS_BASE + '/v3/shopping/hotel-offers?' +
      new URLSearchParams({ hotelIds: hotelIds.join(','), checkInDate: checkIn, checkOutDate: checkOut, adults: String(guestCount) }).toString();
    const offersRes = await fetch(offersUrl, { headers: authHeader });

    if (!offersRes.ok) {
      // A 404 here just means none of these specific hotels had bookable
      // offers for these dates — a normal, expected outcome in a limited
      // test dataset, not a real error worth surfacing as one.
      if (offersRes.status === 404) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stays: [] }) };
      }
      const errText = await offersRes.text();
      return { statusCode: offersRes.status, headers: { 'Content-Type': 'application/json' }, body: errText };
    }

    const offersData = await offersRes.json();
    const results = (offersData && offersData.data) || [];

    const extracted = results.map(function (r) {
      const hotel = r.hotel || {};
      const firstOffer = (r.offers && r.offers[0]) || {};
      const price = firstOffer.price && firstOffer.price.total;
      return {
        name: hotel.name || 'Hotel',
        rating: hotel.rating ? Number(hotel.rating) : null,
        reviewScore: null,
        reviewCount: null,
        photoUrl: null, // not included in this tier of the Hotel Search API
        price: price || null,
        currency: (firstOffer.price && firstOffer.price.currency) || 'USD',
        accommodationId: hotel.hotelId || null
      };
    }).filter(function (s) { return s.price !== null; });

    extracted.sort(function (a, b) { return parseFloat(a.price) - parseFloat(b.price); });
    const trimmed = extracted.slice(0, 5);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stays: trimmed })
    };
  } catch (err) {
    console.error('Proxy error reaching Amadeus:', err);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Proxy error reaching Amadeus',
        errorName: err.name,
        errorMessage: err.message
      })
    };
  }
};
