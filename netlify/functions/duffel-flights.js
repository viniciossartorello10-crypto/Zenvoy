exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { token, slices, passengers, cabin_class } = body;

    if (!token || !slices || !passengers) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: token, slices, passengers' })
      };
    }

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
      body: JSON.stringify({ error: 'Proxy error: ' + err.message })
    };
  }
};
