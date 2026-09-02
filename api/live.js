// Live data proxy for the explorer and the /today page.
//
// Aggregates three free public feeds behind one same-origin endpoint so the
// browser never has to deal with CORS, rate limits or an exposed NASA key:
//
//   ISS position      Where The ISS At        https://wheretheiss.at
//   Asteroid passes   NASA NeoWs              https://api.nasa.gov/neo/rest/v1/feed
//   Space weather     NOAA SWPC               https://services.swpc.noaa.gov
//
// Each feed is cached in memory for a short period. Set NASA_API_KEY in the
// environment for a higher NeoWs quota; without it the public DEMO_KEY is used.
//
//   GET /api/live?feed=iss        → { lat, lon, altitudeKm, velocityKmh, ts }
//   GET /api/live?feed=asteroids  → { date, count, objects: [...] }
//   GET /api/live?feed=weather    → { kp, kpLabel, xray, xrayClass, ... }
//   GET /api/live                 → all three (individual failures are null)

const CACHE_TTL = {
  iss: 5 * 1000,
  asteroids: 60 * 60 * 1000,
  weather: 10 * 60 * 1000,
};

const cache = new Map();

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Solaris/1.0 (+https://solarisvr.com)' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL[key] });
  return value;
}

async function loadIss() {
  const data = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544');
  return {
    lat: Number(data.latitude),
    lon: Number(data.longitude),
    altitudeKm: Number(data.altitude),
    velocityKmh: Number(data.velocity),
    visibility: data.visibility,
    ts: Number(data.timestamp) * 1000,
    source: 'wheretheiss.at',
  };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function loadAsteroids() {
  const key = process.env.NASA_API_KEY || 'DEMO_KEY';
  const today = new Date();
  const end = new Date(today.getTime() + 2 * 86400000);
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${isoDate(today)}&end_date=${isoDate(end)}&api_key=${encodeURIComponent(key)}`;
  const data = await fetchJson(url, 12000);

  const objects = [];
  for (const [date, list] of Object.entries(data.near_earth_objects || {})) {
    for (const neo of list) {
      const approach = (neo.close_approach_data || [])[0];
      if (!approach) continue;
      const diameter = neo.estimated_diameter?.meters || {};
      objects.push({
        id: neo.id,
        name: String(neo.name || '').replace(/[()]/g, '').trim(),
        date,
        approachTime: approach.close_approach_date_full || approach.close_approach_date,
        missDistanceKm: Number(approach.miss_distance?.kilometers),
        missDistanceLunar: Number(approach.miss_distance?.lunar),
        velocityKms: Number(approach.relative_velocity?.kilometers_per_second),
        diameterMinM: Number(diameter.estimated_diameter_min),
        diameterMaxM: Number(diameter.estimated_diameter_max),
        hazardous: Boolean(neo.is_potentially_hazardous_asteroid),
        url: neo.nasa_jpl_url,
      });
    }
  }
  objects.sort((a, b) => a.missDistanceKm - b.missDistanceKm);

  return {
    date: isoDate(today),
    count: objects.length,
    objects: objects.slice(0, 40),
    source: 'NASA NeoWs',
    demoKey: key === 'DEMO_KEY',
  };
}

function kpLabel(kp) {
  if (kp >= 7) return 'Severe geomagnetic storm';
  if (kp >= 6) return 'Strong geomagnetic storm';
  if (kp >= 5) return 'Minor geomagnetic storm';
  if (kp >= 4) return 'Active';
  return 'Quiet';
}

function xrayClass(flux) {
  if (!(flux > 0)) return 'n/a';
  const bands = [['X', 1e-4], ['M', 1e-5], ['C', 1e-6], ['B', 1e-7], ['A', 1e-8]];
  for (const [letter, base] of bands) {
    if (flux >= base) return `${letter}${(flux / base).toFixed(1)}`;
  }
  return 'A0.1';
}

async function loadWeather() {
  const [kpRows, xrayRows, windRows] = await Promise.all([
    fetchJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').catch(() => null),
    fetchJson('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json').catch(() => null),
    fetchJson('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json').catch(() => null),
  ]);

  // The K-index feed has shipped as both an array-of-rows (header first) and
  // an array of objects; accept either shape.
  let kp = null;
  let kpTime = null;
  if (Array.isArray(kpRows) && kpRows.length) {
    const last = kpRows[kpRows.length - 1];
    if (Array.isArray(last)) {
      kp = Number(last[1]);
      kpTime = last[0];
    } else if (last && typeof last === 'object') {
      kp = Number(last.Kp ?? last.kp_index ?? last.estimated_kp);
      kpTime = last.time_tag;
    }
    if (!Number.isFinite(kp)) kp = null;
  }

  // Long-wavelength (0.1–0.8 nm) channel is the one used for flare classes.
  let xray = null;
  let xrayTime = null;
  if (Array.isArray(xrayRows)) {
    const longBand = xrayRows.filter((row) => row.energy === '0.1-0.8nm');
    const last = longBand[longBand.length - 1];
    if (last) {
      xray = Number(last.flux);
      xrayTime = last.time_tag;
    }
  }

  let windSpeed = null;
  let windDensity = null;
  if (Array.isArray(windRows) && windRows.length) {
    // Real-time solar wind: newest record first.
    const latest = windRows.find((row) => row && Number.isFinite(Number(row.proton_speed)));
    if (latest) {
      windSpeed = Number(latest.proton_speed);
      windDensity = Number(latest.proton_density);
    }
  }

  if (kp === null && xray === null && windSpeed === null) {
    throw new Error('All SWPC feeds unavailable');
  }

  return {
    kp,
    kpLabel: kp === null ? null : kpLabel(kp),
    kpTime,
    xray,
    xrayClass: xrayClass(xray),
    xrayTime,
    windSpeedKms: windSpeed,
    windDensity,
    source: 'NOAA SWPC',
  };
}

const LOADERS = { iss: loadIss, asteroids: loadAsteroids, weather: loadWeather };

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const feed = url.searchParams.get('feed');

  res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=30');

  try {
    if (feed) {
      if (!LOADERS[feed]) return res.status(400).json({ error: 'Unknown feed' });
      const value = await cached(feed, LOADERS[feed]);
      return res.status(200).json(value);
    }

    const [iss, asteroids, weather] = await Promise.all(
      Object.keys(LOADERS).map((key) => cached(key, LOADERS[key]).catch((error) => {
        console.log(`[v0] live feed ${key} failed:`, error && error.message);
        return null;
      }))
    );
    return res.status(200).json({ iss, asteroids, weather, generatedAt: Date.now() });
  } catch (error) {
    console.log('[v0] live feed error:', error && error.message);
    return res.status(502).json({ error: 'Live feed temporarily unavailable' });
  }
};
