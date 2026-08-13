import { OBJECT_MEDIA, SEARCHABLE_OBJECTS } from './data.js';
import { loadLatestNews, renderNewsFeed } from './news.js';
import * as THREE from 'three';

let camera, controls;
let onFlyTo = null;
let selectedObject = null;
let timeScale = 1;

// ---- Setup ----
export function setupUI(opts) {
  camera = opts.camera;
  controls = opts.controls;
  onFlyTo = opts.flyToCallback;

  setupSearch();
  setupLayerToggles(opts.layerCallbacks);
  setupZoomControls();
  setupTimeControl();
  setupInfoPanel();
  setupBottomBar();
  setupPlanetSidebar(opts.flyToCallback, opts.sidebarSelectCallback);
  startLoadingSequence(opts.onLoaded);
  loadLatestNews().then(() => renderNewsFeed(3));
}

// ---- Planet sidebar (NASA Eyes style quick-select) ----
let activeSidebarBtn = null;
function setupPlanetSidebar(flyToCallback, selectCallback) {
  const buttons = document.querySelectorAll('.planet-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      highlightSidebarPlanet(id);
      if (flyToCallback) flyToCallback(id);
      if (selectCallback) selectCallback(id);
    });
  });
}

export function highlightSidebarPlanet(id) {
  const buttons = document.querySelectorAll('.planet-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-id') === id) {
      btn.classList.add('active');
      activeSidebarBtn = btn;
    } else {
      btn.classList.remove('active');
    }
  });
}

export function clearSidebarHighlight() {
  if (activeSidebarBtn) activeSidebarBtn.classList.remove('active');
  activeSidebarBtn = null;
}

function startLoadingSequence(onLoaded) {
  const bar = document.getElementById('loader-progress');
  const text = document.getElementById('loader-text');
  const screen = document.getElementById('loading-screen');
  const startedAt = performance.now();
  let textureProgress = 0;
  let finished = false;

  const setProgress = (value, message) => {
    if (bar) bar.style.width = `${Math.min(100, value * 100)}%`;
    if (text && message) text.textContent = message;
  };

  window.addEventListener('space-texture-progress', event => {
    const { loaded, total } = event.detail;
    textureProgress = total ? loaded / total : 0;
    setProgress(0.12 + textureProgress * 0.82, `Streaming cinematic imagery ${loaded}/${total}…`);
  });

  const finish = () => {
    if (finished) return;
    finished = true;
    setProgress(1, 'Visual systems online');
    setTimeout(() => {
      if (!screen) return;
      screen.style.opacity = '0';
      screen.style.transition = 'opacity .8s ease';
      setTimeout(() => {
        screen.style.display = 'none';
        if (onLoaded) onLoaded();
      }, 800);
    }, 350);
  };

  const maybeFinish = () => {
    if (window._spaceTexturesReady && window._spaceSkyReady) finish();
  };
  window.addEventListener('space-textures-ready', maybeFinish, { once: true });
  window.addEventListener('space-sky-ready', () => {
    setProgress(0.97, 'Photographic human-eye sky ready…');
    maybeFinish();
  }, { once: true });
  setProgress(0.08, 'Initializing orbital renderer…');

  // Do not trap the visitor if an external live-data provider is temporarily slow.
  const watchdog = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    if ((window._spaceTexturesReady && window._spaceSkyReady) || elapsed > 30000) {
      clearInterval(watchdog);
      finish();
    } else if (elapsed > 2500 && textureProgress === 0) {
      setProgress(0.14, 'Connecting to deep-space image services…');
    } else if (window._spaceTexturesReady && !window._spaceSkyReady) {
      setProgress(0.95, 'Calibrating photographic sky exposure…');
    }
  }, 250);
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('search-input');
  const submit = document.getElementById('search-submit');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  const getMatches = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) return [];
    return SEARCHABLE_OBJECTS.filter(object => object.name.toLowerCase().includes(query)).slice(0, 8);
  };

  const closeResults = () => {
    results.classList.remove('open');
    results.innerHTML = '';
  };

  const activateSearchObject = object => {
    if (!object) return;
    input.value = object.name;
    closeResults();
    input.blur();
    if (onFlyTo) onFlyTo(object.id);
  };

  const activateBestMatch = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const matches = getMatches();
    const exactMatch = SEARCHABLE_OBJECTS.find(object => object.name.toLowerCase() === query);
    activateSearchObject(exactMatch || matches[0]);
  };

  const renderResults = () => {
    const matches = getMatches();
    results.innerHTML = '';
    if (!matches.length) {
      results.classList.remove('open');
      return;
    }

    matches.forEach(object => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'search-result-item';

      const emoji = document.createElement('span');
      emoji.className = 'search-result-emoji';
      emoji.textContent = object.emoji;
      const name = document.createElement('span');
      name.className = 'search-result-name';
      name.textContent = object.name;
      const type = document.createElement('span');
      type.className = 'search-result-type';
      type.textContent = object.type;

      item.append(emoji, name, type);
      item.addEventListener('click', () => activateSearchObject(object));
      results.appendChild(item);
    });
    results.classList.add('open');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      activateBestMatch();
    } else if (event.key === 'Escape') {
      closeResults();
      input.blur();
    }
  });
  submit?.addEventListener('click', activateBestMatch);

  document.addEventListener('click', event => {
    if (!event.target.closest('.search-wrap')) closeResults();
  });
}

// ---- Layer toggles ----
function setupLayerToggles(callbacks) {
  const toggleMap = {
    'toggle-planets': 'planets',
    'toggle-orbits': 'orbits',
    'toggle-stars': 'stars',
    'toggle-constellations': 'constellations',
    'toggle-nebulae': 'nebulae',
    'toggle-labels': 'labels'
  };
  Object.entries(toggleMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && callbacks && callbacks[key]) {
      el.addEventListener('change', () => callbacks[key](el.checked));
    }
  });
}

// ---- Zoom controls ----
function setupZoomControls() {
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    if (!camera) return;
    camera.position.multiplyScalar(0.85);
    if (controls) controls.update();
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    if (!camera) return;
    camera.position.multiplyScalar(1.18);
    if (controls) controls.update();
  });
}

// ---- Time speed ----
function setupTimeControl() {
  const slider = document.getElementById('time-speed');
  const label = document.getElementById('speed-label');
  if (!slider) return;
  slider.addEventListener('input', () => {
    timeScale = parseFloat(slider.value);
    if (label) label.textContent = timeScale === 0 ? 'Paused' : timeScale + '×';
    window._spaceMapTimeScale = timeScale;
  });
  window._spaceMapTimeScale = 1;
}

// ---- Info panel ----
function setupInfoPanel() {
  document.getElementById('info-close')?.addEventListener('click', closeInfoPanel);
  document.getElementById('btn-fly-to')?.addEventListener('click', () => {
    if (selectedObject && onFlyTo) onFlyTo(selectedObject.userData.id);
  });
  document.getElementById('btn-focus')?.addEventListener('click', () => {
    if (selectedObject && controls) {
      const pos = new THREE.Vector3();
      selectedObject.getWorldPosition(pos);
      controls.target.copy(pos);
    }
  });
}

export function showInfoPanel(obj) {
  selectedObject = obj;
  const data = obj.userData;
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  document.getElementById('info-icon').textContent = data.emoji || '⭐';
  document.getElementById('info-name').textContent = data.name || 'Unknown';
  document.getElementById('info-type').textContent = data.type || '';
  document.getElementById('info-description').textContent = data.description || '';

  const statsEl = document.getElementById('info-stats');
  statsEl.innerHTML = '';
  if (data.stats) {
    Object.entries(data.stats).forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'stat-card';
      row.innerHTML = `<span class="stat-key">${k}</span><span class="stat-val">${v}</span>`;
      statsEl.appendChild(row);
    });
  }

  const media = OBJECT_MEDIA[String(data.id || data.name || '').toLowerCase()];
  const mediaSection = document.getElementById('info-media');
  const video = document.getElementById('info-video');
  const videoTitle = document.getElementById('media-title');
  const quality = document.getElementById('media-quality');
  const links = document.getElementById('info-links');

  if (media && mediaSection && video && links) {
    video.src = `https://www.youtube-nocookie.com/embed/${media.youtubeId}?rel=0&modestbranding=1`;
    video.title = media.title;
    if (videoTitle) videoTitle.textContent = media.title;
    if (quality) quality.textContent = media.quality;
    links.innerHTML = '';
    [
      { label: 'NASA Official', url: media.nasaUrl },
      { label: 'Wikipedia', url: media.wikipediaUrl },
      ...(media.resources || [])
    ].forEach(resource => {
      const link = document.createElement('a');
      link.className = 'resource-link';
      link.href = resource.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${resource.label} ↗`;
      links.appendChild(link);
    });
    mediaSection.classList.remove('hidden');
  } else {
    clearInfoMedia();
  }

  // Show the latest developments feed whenever any object panel is open
  const devSection = document.getElementById('latest-developments');
  if (devSection) {
    devSection.classList.remove('hidden');
    const feed = document.getElementById('news-feed');
    if (feed && !feed.innerHTML.trim()) renderNewsFeed(3);
  }

  panel.classList.remove('hidden');
  panel.classList.add('visible');
}

function clearInfoMedia() {
  const mediaSection = document.getElementById('info-media');
  const video = document.getElementById('info-video');
  const links = document.getElementById('info-links');
  if (video) video.src = '';
  if (links) links.innerHTML = '';
  mediaSection?.classList.add('hidden');
}

export function closeInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) { panel.classList.remove('visible'); panel.classList.add('hidden'); }
  clearInfoMedia();
  selectedObject = null;
  clearSidebarHighlight();
  document.getElementById('latest-developments')?.classList.add('hidden');
}

// ---- Tooltip ----
const tooltip = document.getElementById('tooltip');
export function showTooltip(name, x, y) {
  if (!tooltip) return;
  tooltip.textContent = name;
  tooltip.style.left = (x + 14) + 'px';
  tooltip.style.top = (y - 24) + 'px';
  tooltip.classList.add('visible');
}
export function hideTooltip() {
  if (tooltip) tooltip.classList.remove('visible');
}

// ---- Bottom bar / coordinates ----
// The simulation clock seeds from the real wall-clock time the page loaded,
// then advances only when the visitor moves the TIME slider. At 1x it stays
// very close to the actual date; pausing (0x) freezes it without affecting
// the live wall-clock readout shown next to it.
let simEpoch = Date.now();
let simTime = simEpoch;
let lastTick = performance.now();

function setupBottomBar() {
  updateDate();
  setInterval(updateDate, 1000);
}

function updateDate() {
  const now = performance.now();
  const realDelta = Math.min(2000, now - lastTick) / 1000; // seconds since last tick
  lastTick = now;
  const scale = window._spaceMapTimeScale ?? 1;
  if (scale > 0) {
    // Match the orbital simulation's per-second cadence so the date tracks
    // the planet motion the visitor already sees.
    simTime += realDelta * 1000 * scale;
  }

  const simDate = new Date(simTime);
  const simEl = document.getElementById('sim-date');
  if (simEl) {
    const date = simDate.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit'
    });
    const time = simDate.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const paused = scale === 0 ? ' (paused)' : '';
    simEl.textContent = `${date} · ${time}${paused}`;
  }

  // Always show the real wall-clock time separately so it is never wrong.
  const live = new Date();
  const el = document.getElementById('current-date');
  if (el) {
    const liveDate = live.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit'
    });
    const liveTime = live.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });
    el.textContent = `${liveDate} · ${liveTime}`;
  }
}

export function updateCoordinates(camPos) {
  const ra = document.getElementById('coord-ra');
  const dec = document.getElementById('coord-dec');
  const dist = document.getElementById('coord-dist');
  if (ra) ra.textContent = `RA: ${(camPos.x * 0.1).toFixed(1)}°`;
  if (dec) dec.textContent = `Dec: ${(camPos.y * 0.1).toFixed(1)}°`;
  const d = camPos.length();
  if (dist) dist.textContent = `Dist: ${(d / 15).toFixed(1)} AU`;
}

export function updateZoomLevel(camDist) {
  const ind = document.getElementById('zoom-indicator');
  if (!ind) return;
  const minLog = Math.log(5), maxLog = Math.log(8000);
  const currentLog = Math.log(Math.max(5, camDist));
  const pct = 1 - (currentLog - minLog) / (maxLog - minLog);
  ind.style.height = Math.min(100, Math.max(0, pct * 100)) + '%';
}

export function updateCompass(camera) {
  const needle = document.getElementById('compass-needle');
  if (!needle) return;
  const angle = Math.atan2(camera.position.x, camera.position.z);
  needle.style.transform = `rotate(${angle}rad)`;
}

export function setupViewButtons(callbacks) {
  document.getElementById('btn-solar-system')?.addEventListener('click', () => callbacks?.solarSystem());
  document.getElementById('btn-galaxy')?.addEventListener('click', () => callbacks?.galaxy());
  document.getElementById('btn-reset')?.addEventListener('click', () => callbacks?.reset());
}
