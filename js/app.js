import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Module specifiers are kept free of cache-busting query strings: a module
// imported under two different URLs is instantiated twice by the browser,
// which used to load and run data.js a second time on every page load.
import { setupVR, updateVR, isPresenting, setSurfaceMode } from './vr.js';
import { PlanetarySurfaces } from './planetarySurfaces.js';

import {
  createStarField, createFamousStars, createConstellations,
  updateStars, setStarsVisible, setConstellationsVisible, starObjects
} from './stars.js';
import {
  createSolarSystem, updateSolarSystem, updateOrbitResolution, solarSystemObjects,
  setPlanetsVisible, setOrbitsVisible,
  selectObject, deselectAll
} from './solarSystem.js';
import { createNebulae, updateNebulae, setNebulaeVisible, nebulaObjects } from './nebulae.js';
import { createLabels, updateLabels, setLabelsVisible } from './labels.js';
import {
  setupUI, showInfoPanel, closeInfoPanel, showTooltip, hideTooltip, setupViewButtons,
  highlightSidebarPlanet, clearSidebarHighlight, updateSurfaceStatus
} from './ui.js';
import { createLiveLayers, setLiveLayer, getIssMesh, updateLiveLayers, liveObjects } from './liveData.js';
import {
  TOURS, setupTours, startTour, nextStop, previousStop, toggleTourVoice, stopTour, isTourRunning
} from './tours.js';
import { LITE_MODE, setLitePreference } from './lite.js';

// ─── Renderer ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('space-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE_MODE, powerPreference: 'high-performance' });
const lowPowerDevice = navigator.deviceMemory && navigator.deviceMemory <= 4;
// Low-bandwidth mode also trims GPU work: fewer pixels and no bloom pass, so
// the lite texture set is matched by a lighter frame budget on old laptops.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE_MODE ? 1 : lowPowerDevice ? 1.25 : 2));
if (LITE_MODE) document.body.classList.add('lite-mode');
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000008);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
renderer.xr.enabled = true;

// ─── Scene & Camera ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 50000);
camera.position.set(0, 65, 200);

// ─── Controls ────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.08;
controls.maxDistance = 9000;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.55;
controls.target.set(0, 0, 0);

// ─── Post-processing Bloom + cinematic film grade ────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.85,  // strength: more dramatic glow for the Sun and bright atmospheres
  0.42,  // radius: smoother, wider halo
  0.62   // threshold: only the brightest sources bloom
);
if (!LITE_MODE) composer.addPass(bloomPass);

// No film-grain pass. Animated grain over a black sky is indistinguishable
// from television static, and it was the single largest source of the crawling
// speckle across the star field. Real space has no grain.
composer.addPass(new OutputPass());

// ─── Clock ────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

// ─── Raycasting ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let allClickable = [];

// ─── Build the scene ─────────────────────────────────────────────────────────
createStarField(scene, renderer);
createConstellations(scene);
createFamousStars(scene);
createSolarSystem(scene, renderer);
createNebulae(scene);

// Everything the raycaster can hit. Live layers add and remove markers at
// runtime (ISS, asteroids), so this list is rebuilt whenever they change.
let labelsBuilt = false;
function rebuildClickables() {
  allClickable = [...solarSystemObjects, ...starObjects, ...nebulaObjects, ...liveObjects];
  if (!labelsBuilt) {
    createLabels(scene, allClickable);
    labelsBuilt = true;
  }
}
requestAnimationFrame(rebuildClickables);

// Optional live layers (off by default) fed by /api/live.
createLiveLayers({
  scene,
  onObjectsChanged: rebuildClickables,
  onStatus: renderLiveStatus,
});

const surfaces = new PlanetarySurfaces({
  scene,
  camera,
  controls,
  renderer,
  onStateChange: state => {
    updateSurfaceStatus(state);
    setSurfaceMode(state.active, state.body);
    if (state.phase === 'surface') {
      followedMesh = null;
      followLastPosition = null;
    }
  }
});
updateSurfaceStatus({ quality: surfaces.quality, phase: 'orbit' });

// ─── Immersive VR ────────────────────────────────────────────────────────────
// The headset user is placed on a camera rig (see js/vr.js) so they arrive in
// open space near Earth's orbit instead of at world origin — which is the
// middle of the Sun.
setupVR({
  renderer,
  scene,
  camera,
  controls,
  getTargets: () => allClickable,
  onSelect: (mesh) => {
    selectObject(mesh);
    showInfoPanel(mesh);
  }
});

// ─── Selection & camera-follow state ─────────────────────────────────────────
let followedMesh = null; // camera orbits this mesh's world position each frame
let followLastPosition = null;

function selectMesh(mesh, { fly = false } = {}) {
  if (!mesh || !mesh.userData || !mesh.userData.name) return;
  selectObject(mesh);
  showInfoPanel(mesh);
  followedMesh = mesh;
  followLastPosition = new THREE.Vector3();
  mesh.getWorldPosition(followLastPosition);
  if (mesh.userData.objectType === 'planet' || mesh.userData.objectType === 'sun') {
    highlightSidebarPlanet(mesh.userData.id);
  } else {
    clearSidebarHighlight();
  }
  if (fly) {
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    const r = mesh.userData.radius || 2;
    const type = mesh.userData.objectType;
    const distance = type === 'nebula'
      ? Math.max(mesh.userData.size * 0.9, 80)
      : type === 'star'
        ? Math.max((mesh.userData.size || 3) * 18, 40)
        : Math.max(r * 4.4, 0.9);
    flyToWorldPos(wp, distance);
  }
}

function deselect() {
  deselectAll();
  closeInfoPanel();
  followedMesh = null;
  followLastPosition = null;
}

// ─── Fly-to animation ─────────────────────────────────────────────────────────
let flyFrom = null;
let flyDest = null;
let flyLook = null;
let flyT = 1;
const FLY_DURATION = 2.0;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function flyToWorldPos(dest, dist = 20) {
  flyFrom = camera.position.clone();
  flyDest = dest.clone().add(new THREE.Vector3(dist * 0.6, dist * 0.4, dist));
  flyLook = dest.clone();
  flyT = 0;
}

function flyToObjectId(objectId) {
  for (const obj of allClickable) {
    if (obj.userData.id === objectId || (obj.userData.name || '').toLowerCase() === String(objectId).toLowerCase()) {
      selectMesh(obj, { fly: true });
      return;
    }
  }
}

// ─��─ Mouse events ─────────────────────────────────────────────────────────────
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (!allClickable.length) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allClickable, false);

  if (hits.length > 0 && hits[0].object.userData.name) {
    canvas.style.cursor = 'pointer';
    showTooltip(hits[0].object.userData.name, e.clientX, e.clientY);
  } else {
    canvas.style.cursor = 'default';
    hideTooltip();
  }
});

window.addEventListener('click', (e) => {
  if (e.target !== canvas) return;
  if (!allClickable.length) return;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allClickable, false);
  if (hits.length > 0 && hits[0].object.userData.name) {
    selectMesh(hits[0].object);
  } else {
    deselect();
  }
});

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  updateOrbitResolution(window.innerWidth, window.innerHeight);
});

// ─── UI setup ─────────────────────────────────────────────────────────────────
setupUI({
  controls,
  layerCallbacks: {
    planets: setPlanetsVisible,
    orbits: setOrbitsVisible,
    stars: setStarsVisible,
    constellations: setConstellationsVisible,
    nebulae: setNebulaeVisible,
    labels: setLabelsVisible
  },
  flyToCallback: flyToObjectId,
  surfaceSupported: object => surfaces.supports(object),
  onLandSurface: object => surfaces.land(object),
  onReturnOrbit: () => surfaces.returnToOrbit(),
  onLoaded: applyDeepLinks
});

// Preset viewpoints. All three buttons do the same thing — deselect, then
// glide to a fixed camera position — so they share one implementation.
const SOLAR_SYSTEM_VIEW = new THREE.Vector3(0, 65, 200);
const WIDE_VIEW = new THREE.Vector3(200, 600, 1200);
const ORIGIN = new THREE.Vector3(0, 0, 0);

function goToView(position, { snapTarget = false } = {}) {
  deselect();
  flyFrom = camera.position.clone();
  flyDest = position.clone();
  flyLook = ORIGIN.clone();
  flyT = 0;
  if (snapTarget) controls.target.set(0, 0, 0);
}

setupViewButtons({
  solarSystem: () => goToView(SOLAR_SYSTEM_VIEW),
  galaxy: () => goToView(WIDE_VIEW),
  reset: () => goToView(SOLAR_SYSTEM_VIEW, { snapTarget: true })
});

// ─── Live data layers ────────────────────────────────────────────────────────
const LIVE_TOGGLES = { 'toggle-iss': 'iss', 'toggle-asteroids': 'asteroids', 'toggle-weather': 'weather' };

function setLiveToggle(layer, on) {
  const id = Object.keys(LIVE_TOGGLES).find(key => LIVE_TOGGLES[key] === layer);
  const box = id && document.getElementById(id);
  if (box) box.checked = on;
  setLiveLayer(layer, on);
}

Object.entries(LIVE_TOGGLES).forEach(([id, layer]) => {
  document.getElementById(id)?.addEventListener('change', event => setLiveLayer(layer, event.target.checked));
});

function renderLiveStatus(status) {
  const el = document.getElementById('live-status');
  if (!el) return;
  const parts = [];
  if (status.layers.iss) {
    parts.push(status.iss
      ? `<span class="live-dot"></span>ISS over <strong>${status.iss.lat.toFixed(1)}°, ${status.iss.lon.toFixed(1)}°</strong> · ${Math.round(status.iss.velocityKmh).toLocaleString()} km/h`
      : 'Connecting to ISS feed…');
  }
  if (status.layers.asteroids) {
    parts.push(status.asteroids
      ? `<strong>${status.asteroids.count}</strong> near-Earth asteroids passing in the next 3 days`
      : 'Loading NASA asteroid feed…');
  }
  if (status.layers.weather) {
    if (status.weather) {
      const kp = status.weather.kp === null ? '—' : status.weather.kp.toFixed(1);
      parts.push(`Sun: X-ray class <strong>${status.weather.xrayClass}</strong> · Kp <strong>${kp}</strong> (${status.weather.kpLabel || 'n/a'})`);
    } else {
      parts.push('Loading NOAA space weather…');
    }
  }
  el.innerHTML = parts.join('<br>');
}

// "Ride along": switch the ISS layer on, then follow the station as Earth
// turns beneath it. The camera-follow logic in the animation loop does the rest.
document.getElementById('btn-iss-ride')?.addEventListener('click', () => {
  setLiveToggle('iss', true);
  const iss = getIssMesh();
  if (!iss) return;
  rebuildClickables();
  selectMesh(iss, { fly: true });
});

// ─── Narrated guided tours ───────────────────────────────────────────────────
const tourSelect = document.getElementById('tour-select');
if (tourSelect) {
  TOURS.forEach(tour => {
    const option = document.createElement('option');
    option.value = tour.id;
    option.textContent = `${tour.title} · ${tour.grade}`;
    tourSelect.appendChild(option);
  });
}

const tourBar = document.getElementById('tour-bar');
const tourButton = document.getElementById('btn-tour');

function renderTourState(state) {
  if (!tourBar) return;
  if (!state.running) {
    tourBar.classList.add('hidden');
    if (tourButton) tourButton.textContent = 'Start narrated tour';
    return;
  }
  tourBar.classList.remove('hidden');
  if (tourButton) tourButton.textContent = 'Restart tour';
  document.getElementById('tour-title').textContent = state.tour.title;
  document.getElementById('tour-step').textContent = `Stop ${state.index + 1} of ${state.total}`;
  document.getElementById('tour-text').textContent = state.text;
  const voice = document.getElementById('tour-voice');
  if (voice) {
    voice.disabled = !state.speechSupported;
    voice.setAttribute('aria-pressed', String(state.voiceOn && state.speechSupported));
    voice.textContent = !state.speechSupported ? 'No voice' : state.voiceOn ? 'Voice on' : 'Voice off';
    voice.title = state.speechSupported ? 'Toggle spoken narration' : 'This browser has no speech synthesis; captions are shown instead';
  }
  const prev = document.getElementById('tour-prev');
  if (prev) prev.disabled = state.index === 0;
  const next = document.getElementById('tour-next');
  if (next) next.textContent = state.index >= state.total - 1 ? 'Finish' : 'Next';
}

setupTours({ flyToCallback: flyToObjectId, onStateChange: renderTourState });

tourButton?.addEventListener('click', () => {
  const id = tourSelect?.value || TOURS[0]?.id;
  if (id) startTour(id);
});
document.getElementById('tour-prev')?.addEventListener('click', previousStop);
document.getElementById('tour-next')?.addEventListener('click', nextStop);
document.getElementById('tour-voice')?.addEventListener('click', toggleTourVoice);
document.getElementById('tour-stop')?.addEventListener('click', stopTour);
window.addEventListener('keydown', event => {
  if (!isTourRunning() || event.target.matches('input, select, textarea')) return;
  if (event.key === 'ArrowRight') nextStop();
  else if (event.key === 'ArrowLeft') previousStop();
  else if (event.key === 'Escape') stopTour();
});
// Stop speaking if the tab is closed mid-sentence.
window.addEventListener('pagehide', stopTour);

// ─── Low-bandwidth mode ──────────────────────────────────────────────────────
const liteToggle = document.getElementById('toggle-lite');
if (liteToggle) {
  liteToggle.checked = LITE_MODE;
  liteToggle.title = LITE_MODE
    ? 'Using the ~5 MB texture set and a 4K sky. Untick to reload in full 8K.'
    : 'Reload with ~5 MB textures, a 4K sky and no bloom — for slow connections and old laptops.';
  liteToggle.addEventListener('change', () => setLitePreference(liteToggle.checked));
}

// ─── Deep links ──────────────────────────────────────────────────────────────
// explorer.html?focus=mars            fly to an object once the scene starts
// explorer.html?tour=inner-planets    start a narrated tour
// explorer.html?layers=iss,weather    switch live layers on
// explorer.html?ride=iss              ride along with the ISS
// explorer.html?lite=1                low-bandwidth mode (handled in lite.js)
function applyDeepLinks() {
  const params = new URLSearchParams(window.location.search);
  const layers = (params.get('layers') || '').split(',').map(s => s.trim()).filter(Boolean);
  layers.forEach(layer => {
    if (Object.values(LIVE_TOGGLES).includes(layer)) setLiveToggle(layer, true);
  });

  const tourId = params.get('tour');
  const focus = params.get('focus');
  const ride = params.get('ride');

  // Give the fade-out a moment so the first fly-in is visible.
  setTimeout(() => {
    if (tourId && TOURS.some(tour => tour.id === tourId)) {
      if (tourSelect) tourSelect.value = tourId;
      startTour(tourId);
    } else if (ride === 'iss') {
      document.getElementById('btn-iss-ride')?.click();
    } else if (focus) {
      flyToObjectId(focus);
    }
  }, 400);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
// Using setAnimationLoop ensures both desktop and WebXR VR headsets share
// the same per-frame logic. Post-processing (bloom/film) runs on desktop;
// in VR the renderer draws stereo directly for maximum performance.
function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  const timeScale = window._spaceMapTimeScale ?? 1;
  const inVR = isPresenting();

  // Fly animation (desktop only — in VR the rig owns camera movement)
  if (!inVR && flyT < 1 && flyFrom && flyDest) {
    flyT = Math.min(1, flyT + delta / FLY_DURATION);
    const t = easeInOutCubic(flyT);
    camera.position.lerpVectors(flyFrom, flyDest, t);
    if (flyLook) controls.target.lerp(flyLook, t * 0.4);
  }

  // Update systems. Orbital motion pauses while the visitor is standing on a world.
  updateSolarSystem(elapsed, surfaces.isActive() ? 0 : timeScale);
  surfaces.update(delta);
  updateStars(elapsed);
  updateNebulae(elapsed);
  updateLiveLayers(elapsed);
  updateLabels(camera);

  // Camera follows the selected object as it orbits (once fly-in has settled)
  if (!inVR && !surfaces.isActive() && followedMesh && flyT >= 1) {
    const wp = new THREE.Vector3();
    followedMesh.getWorldPosition(wp);
    if (followLastPosition) {
      const movement = wp.clone().sub(followLastPosition);
      camera.position.add(movement);
    }
    controls.target.copy(wp);
    followLastPosition = wp;
  }

  // Camera-like automatic exposure
  let targetExposure = 1.05;
  if (followedMesh?.userData.objectType === 'sun') {
    targetExposure = 0.72;
  } else if (followedMesh?.userData.objectType === 'planet') {
    const solarDistance = followedMesh.userData.distance || 15;
    targetExposure = THREE.MathUtils.clamp(1.05 + Math.log10(Math.max(1, solarDistance / 15)) * 0.34, 1.05, 1.65);
  }
  renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, targetExposure, 0.035);

  if (inVR) {
    // Thumbstick flight, snap-turn, pointer, comfort vignette and wrist HUD.
    updateVR(delta);
    renderer.render(scene, camera);
    return;
  }

  controls.update();
  composer.render();
}

renderer.setAnimationLoop(animate);
