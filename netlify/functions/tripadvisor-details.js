exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const { key, locationId, language, currency } = params;

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
