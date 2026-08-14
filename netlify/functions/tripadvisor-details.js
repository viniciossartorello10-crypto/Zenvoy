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

var _handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const { locationId, language, currency } = params;
    const key = params.key || process.env.TRIPADVISOR_API_KEY;

    if (!key || !locationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required params: key, locationId' })
      };
    }

    const url = new URL(
      `https://api.content.tripadvisor.com/api/v1/location/${encodeURIComponent(locationId)}/details`
    );
    url.searchParams.set('key', key);
    url.searchParams.set('language', language || 'en');
    url.searchParams.set('currency', currency || 'USD');

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

exports.handler = withCors(_handler);
