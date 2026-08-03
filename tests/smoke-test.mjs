// Zenvoy — production smoke test
//
// Plain Node.js (v18+), zero dependencies — calls every deployed Netlify
// Function with a minimal valid request and reports pass/fail. This exists
// because the app has no build step and no test framework; this is the
// lightest-weight way to confirm the serverless integrations actually work
// end-to-end against the real deployed site, not just that the code looks
// right.
//
// Usage:
//   node tests/smoke-test.mjs                  # tests production
//   BASE_URL=http://localhost:8888 node tests/smoke-test.mjs   # or a local `netlify dev`

const BASE_URL = process.env.BASE_URL || 'https://zenvoytravel.netlify.app';

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`✔ ${name} — ${detail}`);
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
    console.log(`✘ ${name} — ${err.message}`);
  }
}

async function expectJsonOk(res, describe) {
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return describe(body);
}

async function main() {
  console.log(`Running smoke test against ${BASE_URL}\n`);

  await check('weather', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/weather?city=Lisbon`);
    return expectJsonOk(res, (b) => {
      if (!b.daily || !b.daily.length) throw new Error('no daily forecast returned');
      return `${b.daily.length}-day forecast for ${b.city}`;
    });
  });

  await check('generate-ai', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/generate-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }], maxTokens: 10 })
    });
    return expectJsonOk(res, (b) => {
      const text = b.candidates && b.candidates[0] && b.candidates[0].content.parts[0].text;
      if (!text) throw new Error('no candidate text returned');
      return `model replied: "${text.trim()}"`;
    });
  });

  await check('unsplash-car-image', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/unsplash-car-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'SUV rental car' })
    });
    return expectJsonOk(res, (b) => `imageUrl: ${b.imageUrl ? 'present' : 'null (no match, not an error)'}`);
  });

  await check('duffel-flights', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/duffel-flights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slices: [{ origin: 'LIS', destination: 'CDG', departure_date: '2026-09-01' }],
        passengers: [{ type: 'adult' }]
      })
    });
    return expectJsonOk(res, (b) => `${(b.offers || []).length} offers returned`);
  });

  await check('duffel-stays', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/duffel-stays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 38.7223, longitude: -9.1393, checkIn: '2026-09-01', checkOut: '2026-09-03', guests: 2 })
    });
    return expectJsonOk(res, (b) => `${(b.stays || []).length} stays returned`);
  });

  await check('amadeus-hotels', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/amadeus-hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 38.7223, longitude: -9.1393, checkIn: '2026-09-01', checkOut: '2026-09-03', guests: 2 })
    });
    // Amadeus's self-serve sandbox only has a limited test dataset, so a
    // short or empty stays[] array is a valid non-error outcome, not a failure.
    return expectJsonOk(res, (b) => `${(b.stays || []).length} stays returned (sandbox data may be sparse)`);
  });

  await check('duffel-cars', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/duffel-cars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 38.7223, longitude: -9.1393, pickupDate: '2026-09-01', dropoffDate: '2026-09-03' })
    });
    // Duffel Cars is a newer, best-effort endpoint per the function's own
    // comment — an empty result is a valid non-error outcome, not a failure.
    return expectJsonOk(res, (b) => `${(b.cars || []).length} cars returned`);
  });

  let locationId = null;
  await check('tripadvisor-search', async () => {
    const res = await fetch(`${BASE_URL}/.netlify/functions/tripadvisor-search?searchQuery=Lisbon`);
    return expectJsonOk(res, (b) => {
      const first = b.data && b.data[0];
      if (!first) throw new Error('no search results returned');
      locationId = first.location_id;
      return `found location_id ${locationId} (${first.name})`;
    });
  });

  await check('tripadvisor-details', async () => {
    if (!locationId) throw new Error('skipped — no locationId from tripadvisor-search');
    const res = await fetch(`${BASE_URL}/.netlify/functions/tripadvisor-details?locationId=${locationId}`);
    return expectJsonOk(res, (b) => `details for "${b.name || locationId}" returned`);
  });

  await check('tripadvisor-photos', async () => {
    if (!locationId) throw new Error('skipped — no locationId from tripadvisor-search');
    const res = await fetch(`${BASE_URL}/.netlify/functions/tripadvisor-photos?locationId=${locationId}`);
    return expectJsonOk(res, (b) => `${(b.data || []).length} photos returned`);
  });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main();
