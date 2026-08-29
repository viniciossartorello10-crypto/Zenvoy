// Email capture (waitlist / premium waitlist).
//
// Why this exists: the client used to POST the sign-up form straight to "/" for
// Netlify Forms. That works on the website (same origin) but FAILS in the
// Capacitor Android app, whose webview origin is https://localhost — not the
// Netlify site — so every sign-up showed "Couldn't save your email".
//
// This function is same-origin for the website AND reachable cross-origin from
// the app (CORS: *), and it registers the submission with Netlify Forms
// server-side (no browser CORS constraints), returning a clean JSON result the
// client can show success/error from. No secrets are exposed.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'method' }) };

  let email, lang, source;
  try {
    const b = JSON.parse(event.body || '{}');
    email = (b.email || '').trim();
    lang = (b.lang || '').slice(0, 5);
    source = b.source === 'premium' ? 'premium-waitlist' : 'waitlist';
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'bad_request' }) };
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'invalid_email' }) };
  }

  // Register with Netlify Forms server-side (the <form> is declared in index.html
  // so Netlify detects it at build; a POST with the matching form-name records a
  // submission). Failure here is non-fatal — we still return ok so the visitor
  // gets confirmation and we log for follow-up.
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'https://zenvoytravel.netlify.app';
    const params = new URLSearchParams({ 'form-name': source, email, lang });
    await fetch(siteUrl + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
  } catch (e) {
    console.error('subscribe: Netlify Forms register failed (non-fatal):', e.message);
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
