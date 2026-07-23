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

  const { contents, maxTokens } = body;
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
            generationConfig: { maxOutputTokens: maxTokens || 1000, temperature: 0.7 }
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
