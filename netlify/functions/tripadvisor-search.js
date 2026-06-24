exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const { key, searchQuery, category, language } = params;

    if (!key || !searchQuery) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required params: key, searchQuery' })
      };
    }

    const url = new URL('https://api.content.tripadvisor.com/api/v1/location/search');
    url.searchParams.set('key', key);
    url.searchParams.set('searchQuery', searchQuery);
    if (category) url.searchParams.set('category', category);
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
