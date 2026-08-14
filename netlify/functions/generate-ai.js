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

// Netlify Function: proxies Google Gemini's generateContent endpoint using a
// server-side API key (GEMINI_API_KEY environment variable), so end users
// never need to bring their own key. Mirrors the same model-fallback logic
// that used to live in the frontend's callAI() — tries the cheapest/highest
// quota model first, falls back to the next one on 404 (deprecated) or 429
// (quota exhausted).
//
// Expected call from the frontend (POST):
//   /.netlify/functions/generate-ai
//   Body: { contents: [...], maxTokens }

var _handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (parseErr) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON in request body: ' + parseErr.message }) };
  }

  const { contents, maxTokens } = body;
  // Itinerary generation is a factual-recall task (name real, currently-open
  // venues this destination is actually known for), not a creative-writing
  // one. A high temperature actively encourages plausible-sounding invention
  // over accurate recall — which is what produced generic "jazz bar"-style
  // filler instead of a destination's real signature venues. Callers may
  // still override per-request; 0.35 is the default for everything now.
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.35;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured with a GEMINI_API_KEY environment variable. Set it in Netlify: Site configuration > Environment variables.' })
    };
  }

  if (!Array.isArray(contents) || !contents.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: contents (array)' }) };
  }

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
  const maxRetriesPerModel = 2;
  const backoffMs = [800, 1800];
  let lastError = null;

  for (const model of modelsToTry) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: contents,
            generationConfig: { maxOutputTokens: maxTokens || 1000, temperature: temperature }
          })
        });

        if (res.ok) {
          const data = await res.json();
          return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
        }

        // 404 = model not available on this key/version, move to next model immediately.
        if (res.status === 404) { lastError = 'Model ' + model + ' not found (404)'; break; }

        // 429 = rate limited / quota exhausted — retry this model with backoff, then give up on it.
        if (res.status === 429) {
          lastError = 'Rate limited on ' + model + ' (429)';
          if (attempt < maxRetriesPerModel) {
            await new Promise(function (r) { setTimeout(r, backoffMs[attempt]); });
            continue;
          }
          break;
        }

        // Any other error — capture and try next model.
        const errText = await res.text();
        lastError = 'HTTP ' + res.status + ' on ' + model + ': ' + errText;
        break;
      } catch (err) {
        lastError = 'Network error on ' + model + ': ' + err.message;
        break;
      }
    }
  }

  return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'All Gemini models failed. Last error: ' + lastError }) };
};

exports.handler = withCors(_handler);
