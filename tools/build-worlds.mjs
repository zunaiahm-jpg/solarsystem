/**
 * Generates the static deep-link pages in /worlds/ (one per major body) plus
 * the sitemap.xml, from the same data the 3D explorer uses (js/data.js).
 *
 * Every world page:
 *   - is a crawlable, shareable landing page for a single object
 *   - carries schema.org JSON-LD (WebPage + the body as a Thing with
 *     additionalProperty stats) and OpenGraph tags
 *   - deep-links into the explorer with ?focus=<id> so the camera flies there
 *
 * Run:  node tools/build-worlds.mjs
 * Commit the generated HTML: the site is served statically with no build step.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PLANETS_DATA, SUN_DATA, OBJECT_METRICS, OBJECT_MEDIA } from '../js/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://solarisvr.com';
const TODAY = new Date().toISOString();

// Per-world editorial: a one-line hook and three classroom-ready facts that the
// data tables do not already say. Kept here (not in data.js) so the 3D bundle
// does not carry copy it never renders.
const EDITORIAL = {
  sun: {
    hook: 'The star that holds 99.8% of the solar system\u2019s mass.',
    facts: [
      'Light from the Sun takes about 8 minutes 20 seconds to reach Earth.',
      'Every second the core fuses roughly 600 million tonnes of hydrogen into helium.',
      'The space-weather halo in the explorer is driven by the live GOES X-ray flare class and planetary Kp index.',
    ],
    tour: 'inner-planets', layers: 'weather',
  },
  mercury: {
    hook: 'Smallest planet, fastest orbit, wildest temperature swings.',
    facts: [
      'A single Mercury day (sunrise to sunrise) lasts 176 Earth days: two full orbits.',
      'Despite being closest to the Sun, Mercury is not the hottest planet. Venus is.',
      'MESSENGER mapped the entire surface between 2011 and 2015.',
    ],
    tour: 'inner-planets',
  },
  venus: {
    hook: 'Earth\u2019s twin in size, its opposite in almost everything else.',
    facts: [
      'Venus rotates backwards and so slowly that its day is longer than its year.',
      'Surface pressure is 92 times Earth\u2019s, about the same as 900 m under the ocean.',
      'Clouds of sulfuric acid reflect 75% of sunlight, making Venus the brightest planet in our sky.',
    ],
    tour: 'inner-planets',
  },
  earth: {
    hook: 'The only world we know with liquid oceans, plate tectonics and life.',
    facts: [
      'In the explorer, Earth\u2019s cloud layer is refreshed daily from real satellite imagery.',
      'The ISS ride-along shows the station\u2019s real latitude, longitude, altitude and speed every five seconds.',
      'Earth\u2019s 23.4\u00b0 axial tilt, not distance from the Sun, is what causes the seasons.',
    ],
    tour: 'inner-planets', layers: 'iss', ride: 'iss',
  },
  moon: {
    hook: 'Our only natural satellite and the stabiliser of Earth\u2019s tilt.',
    facts: [
      'The Moon is drifting away from Earth by about 3.8 cm each year.',
      'It is tidally locked: the same face always points at Earth.',
      'Twelve people have walked on it, all between 1969 and 1972.',
    ],
    tour: 'inner-planets',
  },
  mars: {
    hook: 'A cold desert that once had rivers, lakes and perhaps an ocean.',
    facts: [
      'Olympus Mons is about 22 km high, nearly two and a half times the height of Everest.',
      'A Martian day (a sol) is only 39 minutes longer than an Earth day.',
      'Rovers currently on the surface include Curiosity and Perseverance.',
    ],
    tour: 'inner-planets',
  },
  jupiter: {
    hook: 'A planet so massive it could hold all the others twice over.',
    facts: [
      'The Great Red Spot is a storm wider than Earth that has raged for at least 190 years.',
      'Jupiter\u2019s day is under ten hours, the shortest of any planet.',
      'Its four largest moons, the Galileans, are visible with binoculars.',
    ],
    tour: 'gas-giants',
  },
  saturn: {
    hook: 'Rings hundreds of thousands of kilometres wide and often less than a kilometre thick.',
    facts: [
      'Saturn is less dense than water: it would float in a large enough bath.',
      'Titan, its largest moon, has lakes of liquid methane and a thick nitrogen atmosphere.',
      'Cassini orbited Saturn for 13 years before its 2017 Grand Finale plunge.',
    ],
    tour: 'gas-giants',
  },
  uranus: {
    hook: 'The tipped-over ice giant whose poles take turns facing the Sun.',
    facts: [
      'Its 97.8\u00b0 tilt means each pole gets 42 years of daylight followed by 42 of night.',
      'Methane in the atmosphere absorbs red light, giving Uranus its pale cyan colour.',
      'Only one spacecraft, Voyager 2, has ever visited, in 1986.',
    ],
    tour: 'gas-giants',
  },
  neptune: {
    hook: 'The windiest planet and the first found by mathematics rather than by eye.',
    facts: [
      'Winds reach 2,100 km/h, faster than the speed of sound on Earth.',
      'Neptune has completed only one full orbit since its discovery in 1846.',
      'Its moon Triton orbits backwards and is probably a captured Kuiper Belt object.',
    ],
    tour: 'scale-of-space',
  },
};

// Assemble the ordered list of worlds.
const worlds = [
  { id: 'sun', name: 'Sun', type: SUN_DATA.type, description: SUN_DATA.description, stats: SUN_DATA.stats, color: SUN_DATA.color, texture: 'sun.jpg' },
  ...PLANETS_DATA.flatMap((p) => {
    const planet = { id: p.id, name: p.name, type: p.type, description: p.description, stats: p.stats, color: p.color, rings: !!p.rings, texture: p.id === 'venus' ? 'venus_atmosphere.jpg' : p.id === 'earth' ? 'earth_daymap.jpg' : `${p.id}.jpg` };
    const moon = p.id === 'earth' && p.moons?.[0];
    return moon
      ? [planet, { id: 'moon', name: 'Moon', type: 'Moon of Earth', description: moon.description, stats: moon.stats, color: moon.color, texture: 'moon.jpg', focus: 'Moon' }]
      : [planet];
  }),
];

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function metricsRows(id) {
  const m = OBJECT_METRICS[id];
  if (!m) return '';
  const rows = [];
  if (m.distanceKm != null) rows.push(['Mean distance', `${fmt(m.distanceKm / 1e6)} million km`, id === 'moon' ? 'from Earth' : `${(m.distanceKm / 149.6e6).toFixed(2)} AU`]);
  if (m.diameterKm != null) rows.push(['Diameter', `${fmt(m.diameterKm)} km`, `${(m.diameterKm / OBJECT_METRICS.earth.diameterKm).toFixed(2)}\u00d7 Earth`]);
  if (m.massEarths != null) rows.push(['Mass', `${fmt(m.massEarths)} Earths`, '']);
  if (m.yearDays != null) rows.push(['Orbital period', m.yearDays > 1000 ? `${(m.yearDays / 365.25).toFixed(1)} years` : `${fmt(m.yearDays)} days`, '']);
  if (m.dayHours != null) rows.push(['Rotation period', m.dayHours > 48 ? `${(m.dayHours / 24).toFixed(1)} Earth days` : `${fmt(m.dayHours)} hours`, '']);
  if (m.moons != null) rows.push(['Known moons', String(m.moons), '']);
  return rows.map(([k, v, note]) => `<tr><th scope="row">${esc(k)}</th><td class="num">${esc(v)}</td><td>${esc(note)}</td></tr>`).join('\n              ');
}

function jsonLd(w, url, ed) {
  const props = Object.entries(w.stats).map(([name, value]) => ({ '@type': 'PropertyValue', name, value }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url, url, name: `${w.name} \u2014 Solaris`,
        description: ed.hook, isPartOf: { '@id': `${SITE}/#website` }, inLanguage: 'en',
        primaryImageOfPage: `${SITE}/textures/${w.texture}`,
        mainEntity: { '@id': `${url}#body` },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Solaris', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: 'Worlds', item: `${SITE}/worlds/earth.html` },
            { '@type': 'ListItem', position: 3, name: w.name, item: url },
          ],
        },
      },
      {
        '@type': 'Thing', '@id': `${url}#body`, name: w.name, alternateName: w.type,
        description: w.description, image: `${SITE}/textures/${w.texture}`,
        sameAs: OBJECT_MEDIA[w.id]?.wikipediaUrl ? [OBJECT_MEDIA[w.id].wikipediaUrl, OBJECT_MEDIA[w.id].nasaUrl] : undefined,
        additionalProperty: props,
        subjectOf: { '@type': 'WebApplication', name: 'Solaris Explorer', url: `${SITE}/explorer.html?focus=${w.focus || w.id}`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (WebGL 2, WebXR)' },
      },
    ],
  }, null, 2);
}

function page(w) {
  const ed = EDITORIAL[w.id];
  const url = `${SITE}/worlds/${w.id}.html`;
  const focus = w.focus || w.id;
  const explorerUrl = `/explorer.html?focus=${focus}${ed.layers ? `&layers=${ed.layers}` : ''}`;
  const media = OBJECT_MEDIA[w.id] || {};
  const nav = worlds.map((o) => `<a href="/worlds/${o.id}.html"${o.id === w.id ? ' aria-current="page"' : ''}>${esc(o.name)}</a>`).join('\n        ');
  const stats = Object.entries(w.stats).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('\n              ');
  const facts = ed.facts.map((f) => `<li>${esc(f)}</li>`).join('\n            ');
  const resources = [
    media.nasaUrl && `<a href="${media.nasaUrl}" rel="noopener" target="_blank">NASA Science: ${esc(w.name)}</a>`,
    media.wikipediaUrl && `<a href="${media.wikipediaUrl}" rel="noopener" target="_blank">Wikipedia</a>`,
    ...(media.resources || []).map((r) => `<a href="${r.url}" rel="noopener" target="_blank">${esc(r.label)}</a>`),
  ].filter(Boolean).join('\n              ');
  const video = media.youtubeId
    ? `<div class="video-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${media.youtubeId}" title="${esc(media.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="source-note">${esc(media.title)} &mdash; ${esc(media.quality)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(w.name)} \u2014 Solaris</title>
  <meta name="description" content="${esc(ed.hook)} Real figures, classroom facts and a deep link that flies the Solaris 8K explorer straight to ${esc(w.name)}." />
  <meta name="theme-color" content="#05070a" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(w.name)} \u2014 Solaris" />
  <meta property="og:description" content="${esc(ed.hook)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/textures/${w.texture}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Jura:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/pages.css" />
  <script type="application/ld+json">
${jsonLd(w, url, ed).split('\n').map((l) => '  ' + l).join('\n')}
  </script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Solaris home">SOLARIS</a>
    <nav class="site-nav" aria-label="Site navigation">
      <a href="/today.html">Today</a>
      <a href="/lessons.html">Lessons</a>
      <a href="/worlds/earth.html" aria-current="page">Worlds</a>
      <a href="/about.html">About</a>
      <a href="/press.html">Press</a>
      <a href="/spaceedu/">SpaceEdu</a>
      <a class="nav-cta" href="/explorer.html">Launch</a>
    </nav>
  </header>

  <main class="page">
    <nav class="world-nav" aria-label="All worlds">
        ${nav}
    </nav>

    <section class="world-hero" style="--world: ${hex(w.color)}; margin-top: 40px;" aria-labelledby="world-title">
      <div>
        <p class="eyebrow">${esc(w.type)}</p>
        <h1 class="page-title" id="world-title">${esc(w.name)}</h1>
        <p class="lead">${esc(ed.hook)}</p>
        <div class="btn-row" style="margin-top: 28px;">
          <a class="btn" href="${explorerUrl}">Fly to ${esc(w.name)} in 3D</a>
          ${ed.ride ? `<a class="btn btn-ghost" href="/explorer.html?ride=${ed.ride}">Ride along with the ISS</a>` : `<a class="btn btn-ghost" href="/explorer.html?tour=${ed.tour}">Hear it in a narrated tour</a>`}
        </div>
      </div>
      <div class="world-orb-wrap">
        <div class="world-orb${w.rings ? ' ringed' : ''}" style="background-image: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.28), transparent 45%), url('/textures/${w.texture}'); background-size: cover, 200% 100%; background-position: center, 30% center;" role="img" aria-label="${esc(w.name)} rendered from its NASA-derived texture map"></div>
      </div>
    </section>

    <section class="section" aria-labelledby="overview">
      <h2 id="overview">Overview</h2>
      <p style="color: var(--text); max-width: 72ch;">${esc(w.description)}</p>
      <div class="grid grid-2">
        <article class="card">
          <h3>At a glance</h3>
          <dl class="kv">
              ${stats}
          </dl>
        </article>
        <article class="card">
          <h3>Three things to tell a class</h3>
          <ul>
            ${facts}
          </ul>
        </article>
      </div>
    </section>

    ${metricsRows(w.id) ? `<section class="section" aria-labelledby="numbers">
      <h2 id="numbers">By the numbers</h2>
      <p>The same physical metrics the explorer\u2019s stats table uses, with Earth as the reference. Sources: NASA NSSDC Planetary Fact Sheet and JPL Solar System Dynamics.</p>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Relative</th></tr></thead>
          <tbody>
              ${metricsRows(w.id)}
          </tbody>
        </table>
      </div>
    </section>` : ''}

    <section class="section" aria-labelledby="explore">
      <h2 id="explore">In the explorer</h2>
      <p>These links open the 3D model and act immediately: no menus to find.</p>
      <div class="grid grid-3">
        <a class="card card-link" href="${explorerUrl}">
          <h3>Fly to ${esc(w.name)}</h3>
          <p><code>?focus=${focus}</code> starts the scene and flies the camera straight here.</p>
        </a>
        <a class="card card-link" href="/explorer.html?tour=${ed.tour}">
          <h3>Narrated tour</h3>
          <p>${esc(w.name)} is a stop on the <em>${esc(ed.tour.replace(/-/g, ' '))}</em> tour, aligned to NGSS in the <a href="/lessons.html#lesson-${ed.tour}">lesson plans</a>.</p>
        </a>
        <a class="card card-link" href="${explorerUrl}${explorerUrl.includes('?') ? '&' : '?'}lite=1">
          <h3>Low-bandwidth</h3>
          <p>Same link with <code>lite=1</code>: ~5 MB of textures instead of ~70 MB for slow connections.</p>
        </a>
      </div>
    </section>

    ${video || resources ? `<section class="section" aria-labelledby="media">
      <h2 id="media">Watch and read more</h2>
      ${video}
      ${resources ? `<div class="btn-row" style="gap: 8px 20px;">
              ${resources}
      </div>` : ''}
    </section>` : ''}
  </main>

  <footer class="site-footer">
    <span class="brand">SOLARIS</span>
    <nav aria-label="Footer">
      <a href="/today.html">Today in space</a>
      <a href="/lessons.html">Lesson plans</a>
      <a href="/about.html">Data sources</a>
      <a href="/press.html">Press</a>
      <a href="mailto:contact@solarisvr.com">contact@solarisvr.com</a>
    </nav>
    <span>&copy; <span data-year>2026</span> Solaris</span>
  </footer>
  <script>document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });</script>
</body>
</html>
`;
}

// ── Write world pages ─────────────────────────────────────────────────────────
mkdirSync(path.join(ROOT, 'worlds'), { recursive: true });
for (const w of worlds) {
  writeFileSync(path.join(ROOT, 'worlds', `${w.id}.html`), page(w));
  console.log(`worlds/${w.id}.html`);
}

// ── Sitemap ───────────────────────────────────────────────────────────────────
const urls = [
  ['/', 'daily', '1.0'],
  ['/explorer.html', 'daily', '0.9'],
  ['/today.html', 'hourly', '0.8'],
  ['/lessons.html', 'monthly', '0.8'],
  ['/about.html', 'monthly', '0.6'],
  ['/press.html', 'weekly', '0.5'],
  ...worlds.map((w) => [`/worlds/${w.id}.html`, 'monthly', '0.7']),
  ['/spaceedu/', 'weekly', '0.6'],
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc, freq, pri]) => `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('sitemap.xml');
