// Netlify Function: proxies Unsplash's search/photos endpoint to fetch a
// real, high-quality photo for a car category (e.g. "SUV", "sports car").
// Uses a server-side Access Key (UNSPLASH_ACCESS_KEY env var) — no key ever
// reaches the browser. If the key isn't configured, or the lookup fails,
// the frontend just keeps showing the colored category illustration
// instead — nothing breaks.
//
// Note: Unsplash returns genuinely great photos for the *category*
// (e.g. "modern SUV", "red sports car") — not the exact make/model/color
// Duffel suggested. That's a deliberate, disclosed trade-off: no free photo
// API can reliably return the exact rental vehicle, so this optimizes for
// "always a real, beautiful photo" over "sometimes the exact car".
//
// Expected call from the frontend (POST):
//   /.netlify/functions/unsplash-car-image
//   Body: { query }

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

  const { query } = body;
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured with an UNSPLASH_ACCESS_KEY environment variable. Set it in Netlify: Site configuration > Environment variables.' })
    };
  }

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: query' }) };
  }

  try {
    const params = new URLSearchParams({
      query: query,
      per_page: '1',
      orientation: 'landscape',
      content_filter: 'high'
    });

    const res = await fetch('https://api.unsplash.com/search/photos?' + params.toString(), {
      headers: { Authorization: 'Client-ID ' + accessKey }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: res.status, headers: { 'Content-Type': 'application/json' }, body: errText };
    }

    const data = await res.json();
    const firstResult = data && data.results && data.results[0];
    const imageUrl = firstResult ? firstResult.urls.regular : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: imageUrl })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Proxy error reaching Unsplash', errorName: err.name, errorMessage: err.message })
    };
  }
};
