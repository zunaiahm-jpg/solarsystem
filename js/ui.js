import { OBJECT_MEDIA, OBJECT_METRICS, EARTH_METRICS, SEARCHABLE_OBJECTS } from './data.js';
import { loadLatestNews, renderNewsFeed } from './news.js';
import * as THREE from 'three';

let controls;
let onFlyTo = null;
let selectedObject = null;
let timeScale = 1;
let onLandSurface = null;
let onReturnOrbit = null;
let surfaceSupported = () => false;

// ---- Setup ----
export function setupUI(opts) {
  controls = opts.controls;
  onFlyTo = opts.flyToCallback;
  onLandSurface = opts.onLandSurface;
  onReturnOrbit = opts.onReturnOrbit;
  surfaceSupported = opts.surfaceSupported || surfaceSupported;

  setupSearch();
  setupLayerToggles(opts.layerCallbacks);
  setupTimeControl();
  setupInfoPanel();
  setupBottomBar();
  setupCameraSelect(opts.flyToCallback);
  setupCornerControls();
  setupSettingsPanel();
  setupSurfaceControls();
  startLoadingSequence(opts.onLoaded);
  loadLatestNews().then(() => renderNewsFeed(3));
}

// ---- Camera drop-down (jaksic-style object selector) ----
// Builds the planet/moon option list and keeps it in sync with 3D selection.
// Exported names kept for app.js compatibility.
function setupCameraSelect(flyToCallback) {
  const select = document.getElementById('camera-select');
  if (!select) return;

  const addOption = (value, label) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  };

  addOption('', 'Overview');
  SEARCHABLE_OBJECTS
    .filter(o => o.category === 'solar-system')
    .forEach(o => {
      addOption(o.id, o.name);
      SEARCHABLE_OBJECTS
        .filter(m => m.category === 'moon' && m.parentId === o.id)
        .forEach(m => addOption(m.id, `\u00a0\u00a0${m.name}`));
    });

  select.addEventListener('change', () => {
    if (!select.value) {
      document.getElementById('btn-solar-system')?.click();
      return;
    }
    if (flyToCallback) flyToCallback(select.value);
  });
}

export function highlightSidebarPlanet(id) {
  const select = document.getElementById('camera-select');
  if (!select) return;
  const key = String(id || '').toLowerCase();
  const has = Array.from(select.options).some(o => o.value.toLowerCase() === key);
  select.value = has ? (Array.from(select.options).find(o => o.value.toLowerCase() === key)?.value || '') : '';
}

export function clearSidebarHighlight() {
  const select = document.getElementById('camera-select');
  if (select) select.value = '';
}

// ---- Corner icons: fullscreen toggle + About modal ----
function setupCornerControls() {
  const fsBtn = document.getElementById('fullscreen-btn');
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };
  fsBtn?.addEventListener('click', toggleFullscreen);
  fsBtn?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleFullscreen(); });

  const modal = document.getElementById('about-modal');
  const openModal = () => { if (modal) modal.hidden = false; };
  const closeModal = () => { if (modal) modal.hidden = true; };
  const helpBtn = document.getElementById('help-btn');
  helpBtn?.addEventListener('click', openModal);
  helpBtn?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal();
    }
  });
  document.getElementById('btn-about')?.addEventListener('click', openModal);
  document.getElementById('about-close')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ---- Settings panel collapse + Info toggle + Pause ----
function setupSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  const bodyToggle = document.getElementById('settings-toggle');
  const controlsToggle = document.getElementById('controls-toggle');
  const controlsRail = document.getElementById('controls-rail');

  const setClosed = (closed) => {
    panel?.classList.toggle('body-closed', closed);
    document.body.classList.toggle('controls-closed', closed);
    bodyToggle?.setAttribute('aria-expanded', String(!closed));
    controlsToggle?.setAttribute('aria-expanded', String(!closed));
    controlsRail?.setAttribute('aria-expanded', String(!closed));
  };
  bodyToggle?.addEventListener('click', () => setClosed(!panel?.classList.contains('body-closed')));
  controlsToggle?.addEventListener('click', () => setClosed(true));
  controlsRail?.addEventListener('click', () => setClosed(false));

  // Info checkbox toggles the bottom-left stats table
  const infoToggle = document.getElementById('toggle-info');
  infoToggle?.addEventListener('change', () => {
    const stats = document.getElementById('obj-stats');
    if (!stats) return;
    stats.style.display = infoToggle.checked && selectedObject ? 'block' : 'none';
  });

  // Pause checkbox drives the simulation clock without moving the slider
  const pauseToggle = document.getElementById('toggle-pause');
  let resumeScale = 1;
  pauseToggle?.addEventListener('change', () => {
    const slider = document.getElementById('time-speed');
    const label = document.getElementById('speed-label');
    if (pauseToggle.checked) {
      resumeScale = parseFloat(slider?.value || '1') || resumeScale;
      window._spaceMapTimeScale = 0;
      if (label) label.textContent = 'Paused';
    } else {
      window._spaceMapTimeScale = resumeScale;
      if (slider) slider.value = String(resumeScale);
      if (label) label.textContent = resumeScale + '×';
    }
  });
}

// ---- Splash: jaksic-style Start button with integrated load progress ----
// The button fills like the reference site's .progress pill: the % streams
// into the label while textures load, then the visitor clicks to step in.
function startLoadingSequence(onLoaded) {
  const bar = document.getElementById('loader-progress');
  const text = document.getElementById('loader-text');
  const screen = document.getElementById('loading-screen');
  const startBtn = document.getElementById('start-btn');
  const startLabel = document.getElementById('start-label');
  const startedAt = performance.now();
  let textureProgress = 0;
  let ready = false;
  let entered = false;
  let wantsEnter = false;

  // The loader line keeps its gently fading "Experience in VR" invitation,
  // so we only stream the numeric progress into the Start pill here.
  const setProgress = (value) => {
    const pct = Math.min(100, Math.round(value * 100));
    if (bar) bar.style.width = `${pct}%`;
    if (startLabel && !ready) startLabel.textContent = pct > 2 ? `Start ${pct}%` : 'Start';
  };

  const enter = () => {
    if (entered) return;
    entered = true;
    document.body.classList.add('app-started');
    if (!screen) return;
    screen.classList.add('fade-out');
    setTimeout(() => {
      screen.style.display = 'none';
      if (onLoaded) onLoaded();
    }, 800);
  };

  const markReady = (message = 'Visual systems online — press Start') => {
    if (ready) return;
    ready = true;
    setProgress(1, message);
    if (startLabel) startLabel.textContent = 'Start';
    startBtn?.classList.add('ready');
    if (wantsEnter) enter();
  };

  startBtn?.addEventListener('click', event => {
    event.preventDefault();
    if (ready) enter();
    else {
      wantsEnter = true;
    }
  });

  window.addEventListener('space-texture-progress', event => {
    const { loaded, total } = event.detail;
    textureProgress = total ? loaded / total : 0;
    setProgress(0.12 + textureProgress * 0.82, `Streaming cinematic imagery ${loaded}/${total}…`);
  });

  const maybeReady = () => {
    if (window._spaceTexturesReady && window._spaceSkyReady) markReady();
  };
  window.addEventListener('space-textures-ready', maybeReady, { once: true });
  window.addEventListener('space-sky-ready', () => {
    setProgress(0.97, 'Photographic human-eye sky ready…');
    maybeReady();
  }, { once: true });
  setProgress(0.08, 'Initializing orbital renderer…');

  // Do not trap the visitor if an external live-data provider is temporarily slow.
  const watchdog = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    if ((window._spaceTexturesReady && window._spaceSkyReady) || elapsed > 30000) {
      clearInterval(watchdog);
      markReady();
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
      if (event.isComposing || event.keyCode === 229) return;
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

// ---- Time speed ----
function setupTimeControl() {
  const slider = document.getElementById('time-speed');
  const label = document.getElementById('speed-label');
  if (!slider) return;
  slider.addEventListener('input', () => {
    timeScale = parseFloat(slider.value);
    if (label) label.textContent = timeScale === 0 ? 'Paused' : timeScale + '×';
    window._spaceMapTimeScale = timeScale;
    // Moving the slider by hand releases the Pause checkbox.
    const pauseToggle = document.getElementById('toggle-pause');
    if (pauseToggle && pauseToggle.checked && timeScale > 0) pauseToggle.checked = false;
  });
  window._spaceMapTimeScale = 1;
}

// ---- Surface exploration ----
function setupSurfaceControls() {
  document.getElementById('btn-land')?.addEventListener('click', () => {
    if (selectedObject && onLandSurface) onLandSurface(selectedObject);
  });
  document.getElementById('btn-return-orbit')?.addEventListener('click', () => onReturnOrbit?.());
}

export function updateSurfaceStatus(state = {}) {
  const section = document.getElementById('surface-explorer');
  if (!section) return;
  const active = !!state.active;
  const progressWrap = document.getElementById('surface-progress-wrap');
  const land = document.getElementById('btn-land');
  const back = document.getElementById('btn-return-orbit');
  section.classList.toggle('is-active', active);
  if (land) land.hidden = active;
  if (back) back.hidden = !active;
  if (progressWrap) progressWrap.hidden = !active && !state.message;
  const quality = document.getElementById('surface-quality');
  const source = document.getElementById('surface-source');
  const badge = document.getElementById('surface-availability');
  const message = document.getElementById('surface-message');
  const bar = document.getElementById('surface-progress');
  if (quality && state.quality) quality.textContent = state.quality;
  if (source && state.source) source.textContent = state.source;
  if (message && state.message) message.textContent = state.message;
  if (bar) bar.style.width = `${Math.round((state.progress || 0) * 100)}%`;
  if (badge) badge.textContent = state.phase === 'surface' ? 'LANDED' : state.phase === 'orbit' ? 'READY' : String(state.phase || 'READY').toUpperCase();
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
  fillObjectStats(data);

  document.getElementById('info-icon').textContent = data.emoji || '⭐';
  document.getElementById('info-name').textContent = data.name || 'Unknown';
  document.getElementById('info-type').textContent = data.type || '';
  document.getElementById('info-description').textContent = data.description || '';

  const surfaceSection = document.getElementById('surface-explorer');
  if (surfaceSection) {
    const supported = surfaceSupported(obj);
    surfaceSection.classList.toggle('hidden', !supported);
    if (supported) {
      const summary = document.getElementById('surface-summary');
      if (summary) summary.textContent = `Descend to ${data.name} with adaptive high-resolution terrain and WebXR-ready navigation.`;
    }
  }

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
  document.getElementById('obj-actions')?.classList.remove('hidden');
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
  document.getElementById('obj-actions')?.classList.add('hidden');
  clearInfoMedia();
  selectedObject = null;
  clearSidebarHighlight();
  document.getElementById('latest-developments')?.classList.add('hidden');
  const stats = document.getElementById('obj-stats');
  if (stats) stats.style.display = 'none';
}

// ---- Bottom-left stats table (jaksic style: absolute + Earth-relative) ----
const sig = (value, digits) => {
  const rounded = Number(value.toPrecision(digits));
  return String(rounded);
};

const formatDistance = km => {
  if (km >= 1e9) return `${sig(km / 1e9, 3)}B km`;
  if (km >= 1e6) return `${sig(km / 1e6, 3)}M km`;
  return `${sig(km / 1e3, 3)}K km`;
};
const formatDiameter = km => `${sig(km / 1e3, km >= 1e5 ? 3 : 2)}K km`;
const formatMass = earths => {
  if (earths >= 10) return `${Math.round(earths)} M⊕`;
  if (earths >= 1) return `${earths.toFixed(1)} M⊕`;
  return `${sig(earths, 2)} M⊕`;
};
const formatYear = days => days >= 1000 ? `${sig(days / 1000, 2)}K days` : `${sig(days, 3)} days`;
const formatDay = hours => hours >= 1000 ? `${sig(hours / 1000, 2)}K hours` : `${sig(hours, 3)} hours`;

// Relative readout: "5.2x" for big ratios, "41%" below that (jaksic convention).
const formatRelative = (value, base) => {
  if (!base) return '';
  const ratio = value / base;
  if (ratio >= 2) return `${sig(ratio, 2)}x`;
  return `${Math.round(ratio * 100)}%`;
};

function setStatRow(id, absText, relText) {
  const row = document.getElementById(`row-${id}`);
  if (!row) return;
  if (absText == null) { row.style.display = 'none'; return; }
  row.style.display = '';
  const abs = document.getElementById(`v-${id}`);
  const rel = document.getElementById(`r-${id}`);
  if (abs) abs.textContent = absText;
  if (rel) rel.textContent = relText || '';
}

function fillObjectStats(data) {
  const wrap = document.getElementById('obj-stats');
  if (!wrap) return;
  const metrics = OBJECT_METRICS[String(data.id || data.name || '').toLowerCase()];
  const infoEnabled = document.getElementById('toggle-info')?.checked ?? true;
  if (!metrics || !infoEnabled) {
    wrap.style.display = 'none';
    return;
  }
  const nameEl = document.getElementById('stat-name');
  if (nameEl) nameEl.textContent = data.name || '';

  setStatRow('distance',
    metrics.distanceKm == null ? null : formatDistance(metrics.distanceKm),
    metrics.distanceKm == null ? null : formatRelative(metrics.distanceKm, EARTH_METRICS.distanceKm));
  setStatRow('diameter',
    metrics.diameterKm == null ? null : formatDiameter(metrics.diameterKm),
    metrics.diameterKm == null ? null : formatRelative(metrics.diameterKm, EARTH_METRICS.diameterKm));
  setStatRow('mass',
    metrics.massEarths == null ? null : formatMass(metrics.massEarths),
    metrics.massEarths == null ? null : formatRelative(metrics.massEarths, EARTH_METRICS.massEarths));
  setStatRow('year',
    metrics.yearDays == null ? null : formatYear(metrics.yearDays),
    metrics.yearDays == null ? null : formatRelative(metrics.yearDays, EARTH_METRICS.yearDays));
  setStatRow('day',
    metrics.dayHours == null ? null : formatDay(metrics.dayHours),
    metrics.dayHours == null ? null : formatRelative(metrics.dayHours, EARTH_METRICS.dayHours));
  setStatRow('moons', metrics.moons == null ? null : String(metrics.moons), '');

  wrap.style.display = 'block';
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
    el.textContent = `LIVE ${liveDate} · ${liveTime}`;
  }
}

export function setupViewButtons(callbacks) {
  document.getElementById('btn-solar-system')?.addEventListener('click', () => callbacks?.solarSystem());
  document.getElementById('btn-galaxy')?.addEventListener('click', () => callbacks?.galaxy());
  document.getElementById('btn-reset')?.addEventListener('click', () => callbacks?.reset());
}
