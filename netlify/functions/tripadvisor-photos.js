// Netlify Function: proxies TripAdvisor's Location Photos endpoint.
// The Location Details endpoint (tripadvisor-details.js) does NOT include
// photos — TripAdvisor requires a separate call for that, which is what
// this function does. Uses a server-side key (TRIPADVISOR_API_KEY), same
// as the other TripAdvisor proxy functions.
//
// Expected call from the frontend (GET):
//   /.netlify/functions/tripadvisor-photos?locationId=XXXX&language=en

exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const { locationId, language } = params;
    const key = params.key || process.env.TRIPADVISOR_API_KEY;

    if (!key || !locationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required params: key, locationId' })
      };
    }

    const url = new URL(
      `https://api.content.tripadvisor.com/api/v1/location/${encodeURIComponent(locationId)}/photos`
    );
    url.searchParams.set('key', key);
    url.searchParams.set('language', language || 'en');

    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' }
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
      body: JSON.stringify({ error: 'Proxy error: ' + err.message })
    };
  }
};
