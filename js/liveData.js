import * as THREE from 'three';
import { getPlanetByName, getSunMesh } from './solarSystem.js';

// Live data layers — ISS, near-Earth asteroids and space weather — fed by
// /api/live (see api/live.js). Everything here is optional and off by default
// so the base explorer stays exactly as fast as before.
//
// Scale note: the explorer compresses distances (Earth radius 0.4 units, Moon
// at 1.1 units). The ISS orbits at ~420 km, which would be invisible at true
// scale, so it is drawn at a readable altitude. Asteroid miss distances are
// compressed logarithmically and every marker shows its real numbers in the
// info panel.

const ISS_ALTITUDE_FACTOR = 1.16;
const ISS_POLL_MS = 5000;
const WEATHER_POLL_MS = 10 * 60 * 1000;

export const liveObjects = [];

let scene = null;
let onObjectsChanged = () => {};
let onStatus = () => {};

let issMesh = null;
let issTrail = null;
let issTimer = null;
let issData = null;

let asteroidGroup = null;
let asteroidData = null;

let weatherHalo = null;
let weatherTimer = null;
let weatherData = null;

const layerState = { iss: false, asteroids: false, weather: false };

// ─── Textures ────────────────────────────────────────────────────────────────
function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let glowTexture = null;
function glow() {
  if (!glowTexture) glowTexture = makeGlowTexture();
  return glowTexture;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function latLonToLocal(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

async function fetchFeed(feed) {
  const res = await fetch(`/api/live?feed=${feed}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`live ${feed} ${res.status}`);
  return res.json();
}

function hashToUnit(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

function formatKm(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} million km`;
  return `${Math.round(value).toLocaleString()} km`;
}

function publishStatus() {
  onStatus({ iss: issData, asteroids: asteroidData, weather: weatherData, layers: { ...layerState } });
}

function refreshClickables() {
  liveObjects.length = 0;
  if (issMesh && layerState.iss) liveObjects.push(issMesh);
  if (asteroidGroup && layerState.asteroids) liveObjects.push(...asteroidGroup.children);
  onObjectsChanged();
}

// ─── ISS ─────────────────────────────────────────────────────────────────────
function ensureIss() {
  if (issMesh) return issMesh;
  const earth = getPlanetByName('earth');
  if (!earth) return null;

  const material = new THREE.SpriteMaterial({
    map: glow(),
    color: 0xdff4ff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  issMesh = new THREE.Sprite(material);
  issMesh.scale.setScalar(0.06);
  issMesh.userData = {
    id: 'iss',
    name: 'International Space Station',
    type: 'Crewed orbital station · live',
    objectType: 'satellite',
    radius: 0.05,
    emoji: '🛰️',
    description: 'The ISS circles Earth every ~92 minutes at roughly 28,000 km/h. This marker is fed by a live public tracking feed; altitude is exaggerated so the station is visible at the explorer\'s compressed scale.',
    stats: { 'Status': 'Waiting for live feed…' },
  };

  // A faint ground-track ring so the station's orbit reads at a glance.
  const ringGeometry = new THREE.RingGeometry(
    earth.data.radius * ISS_ALTITUDE_FACTOR - 0.002,
    earth.data.radius * ISS_ALTITUDE_FACTOR + 0.002,
    128
  );
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x9ed7ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  issTrail = new THREE.Mesh(ringGeometry, ringMaterial);
  issTrail.rotation.x = Math.PI / 2 - THREE.MathUtils.degToRad(51.6);

  earth.mesh.add(issTrail);
  earth.mesh.add(issMesh);
  return issMesh;
}

function applyIss(data) {
  issData = data;
  const earth = getPlanetByName('earth');
  if (!earth || !issMesh) return;
  issMesh.position.copy(latLonToLocal(data.lat, data.lon, earth.data.radius * ISS_ALTITUDE_FACTOR));
  issMesh.userData.stats = {
    'Latitude': `${data.lat.toFixed(2)}°`,
    'Longitude': `${data.lon.toFixed(2)}°`,
    'Altitude': `${Math.round(data.altitudeKm)} km`,
    'Speed': `${Math.round(data.velocityKmh).toLocaleString()} km/h`,
    'Over': data.visibility === 'daylight' ? 'Daylit side of Earth' : 'Night side of Earth',
    'Updated': new Date(data.ts).toLocaleTimeString(),
    'Source': 'wheretheiss.at (public feed)',
  };
  publishStatus();
}

async function pollIss() {
  try {
    applyIss(await fetchFeed('iss'));
  } catch (error) {
    console.warn('ISS feed unavailable', error);
  }
}

function setIssEnabled(on) {
  layerState.iss = on;
  if (on) {
    if (!ensureIss()) return;
    issMesh.visible = true;
    if (issTrail) issTrail.visible = true;
    pollIss();
    clearInterval(issTimer);
    issTimer = setInterval(pollIss, ISS_POLL_MS);
  } else {
    clearInterval(issTimer);
    issTimer = null;
    if (issMesh) issMesh.visible = false;
    if (issTrail) issTrail.visible = false;
  }
  refreshClickables();
  publishStatus();
}

// ─── Near-Earth asteroids ────────────────────────────────────────────────────
function buildAsteroids(data) {
  if (asteroidGroup) {
    scene.remove(asteroidGroup);
    asteroidGroup.traverse(child => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  }
  asteroidGroup = new THREE.Group();
  asteroidGroup.name = 'live-asteroids';

  const geometry = new THREE.DodecahedronGeometry(0.03, 0);
  data.objects.forEach(neo => {
    const material = new THREE.MeshStandardMaterial({
      color: neo.hazardous ? 0xff9a4a : 0xc9ccd2,
      emissive: neo.hazardous ? 0x7a3400 : 0x2a2c31,
      roughness: 0.9,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const u = hashToUnit(neo.id);
    const v = hashToUnit(neo.id + 'b');
    const theta = u * Math.PI * 2;
    const y = (v - 0.5) * 1.2;
    const distance = 0.75 + Math.log1p(Math.max(0, neo.missDistanceLunar || 0)) * 0.55;
    mesh.userData = {
      id: `neo-${neo.id}`,
      name: neo.name,
      type: neo.hazardous ? 'Potentially hazardous asteroid · live' : 'Near-Earth asteroid · live',
      objectType: 'asteroid',
      radius: 0.03,
      emoji: '☄️',
      description: `Closest approach to Earth ${neo.approachTime} UTC at about ${neo.missDistanceLunar.toFixed(1)} lunar distances. Position in the explorer is schematic; the miss distance below is the real figure from NASA/JPL.`,
      stats: {
        'Miss distance': `${formatKm(neo.missDistanceKm)} (${neo.missDistanceLunar.toFixed(1)} LD)`,
        'Relative speed': `${neo.velocityKms.toFixed(1)} km/s`,
        'Estimated size': `${Math.round(neo.diameterMinM)}–${Math.round(neo.diameterMaxM)} m`,
        'Closest approach': `${neo.approachTime} UTC`,
        'Hazard flag': neo.hazardous ? 'Potentially hazardous (PHA)' : 'Not hazardous',
        'Source': 'NASA NeoWs / JPL SBDB',
      },
      liveOffset: new THREE.Vector3(Math.cos(theta) * distance, y, Math.sin(theta) * distance),
    };
    asteroidGroup.add(mesh);
  });
  scene.add(asteroidGroup);
}

async function loadAsteroids() {
  try {
    asteroidData = await fetchFeed('asteroids');
    buildAsteroids(asteroidData);
    asteroidGroup.visible = layerState.asteroids;
    refreshClickables();
    publishStatus();
  } catch (error) {
    console.warn('Asteroid feed unavailable', error);
  }
}

function setAsteroidsEnabled(on) {
  layerState.asteroids = on;
  if (on && !asteroidGroup) loadAsteroids();
  if (asteroidGroup) asteroidGroup.visible = on;
  refreshClickables();
  publishStatus();
}

// ─── Space weather ───────────────────────────────────────────────────────────
function ensureWeatherHalo() {
  if (weatherHalo) return weatherHalo;
  const sun = getSunMesh();
  if (!sun) return null;
  const material = new THREE.SpriteMaterial({
    map: glow(),
    color: 0xffb347,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  weatherHalo = new THREE.Sprite(material);
  weatherHalo.scale.setScalar((sun.userData.radius || 2.5) * 5.5);
  sun.add(weatherHalo);
  return weatherHalo;
}

function applyWeather(data) {
  weatherData = data;
  const sun = getSunMesh();
  if (!sun) return;

  // Flare class drives the halo: A/B ≈ nothing, C faint, M visible, X bright.
  const letter = String(data.xrayClass || 'A')[0];
  const opacityByClass = { A: 0.02, B: 0.05, C: 0.12, M: 0.28, X: 0.5 };
  const colorByClass = { A: 0xffd28a, B: 0xffc36a, C: 0xffb347, M: 0xff8c3a, X: 0xff5a2a };
  if (weatherHalo) {
    weatherHalo.material.opacity = layerState.weather ? (opacityByClass[letter] ?? 0.05) : 0;
    weatherHalo.material.color.setHex(colorByClass[letter] ?? 0xffb347);
    const kpBoost = 1 + Math.max(0, (data.kp ?? 0) - 3) * 0.12;
    weatherHalo.scale.setScalar((sun.userData.radius || 2.5) * 5.5 * kpBoost);
  }

  sun.userData.stats = {
    ...sun.userData.stats,
    'Live X-ray flux (GOES)': data.xrayClass ? `Class ${data.xrayClass}` : '—',
    'Live Kp index': data.kp === null ? '—' : `${data.kp.toFixed(1)} · ${data.kpLabel}`,
    'Live solar wind': data.windSpeedKms ? `${Math.round(data.windSpeedKms)} km/s · ${data.windDensity?.toFixed(1)} p/cm³` : '—',
    'Space weather source': 'NOAA SWPC',
  };
  publishStatus();
}

async function pollWeather() {
  try {
    applyWeather(await fetchFeed('weather'));
  } catch (error) {
    console.warn('Space weather feed unavailable', error);
  }
}

function setWeatherEnabled(on) {
  layerState.weather = on;
  if (on) {
    ensureWeatherHalo();
    pollWeather();
    clearInterval(weatherTimer);
    weatherTimer = setInterval(pollWeather, WEATHER_POLL_MS);
  } else {
    clearInterval(weatherTimer);
    weatherTimer = null;
    if (weatherHalo) weatherHalo.material.opacity = 0;
  }
  publishStatus();
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function createLiveLayers(options) {
  scene = options.scene;
  onObjectsChanged = options.onObjectsChanged || onObjectsChanged;
  onStatus = options.onStatus || onStatus;
}

export function setLiveLayer(name, on) {
  if (name === 'iss') setIssEnabled(on);
  else if (name === 'asteroids') setAsteroidsEnabled(on);
  else if (name === 'weather') setWeatherEnabled(on);
}

export function getIssMesh() {
  return ensureIss();
}

export function updateLiveLayers(elapsed) {
  if (asteroidGroup && asteroidGroup.visible) {
    const earth = getPlanetByName('earth');
    if (earth) {
      const earthPos = new THREE.Vector3();
      earth.mesh.getWorldPosition(earthPos);
      asteroidGroup.children.forEach((mesh, index) => {
        mesh.position.copy(earthPos).add(mesh.userData.liveOffset);
        mesh.rotation.y = elapsed * 0.4 + index;
        mesh.rotation.x = elapsed * 0.25;
      });
    }
  }
  if (issMesh && issMesh.visible) {
    const pulse = 1 + Math.sin(elapsed * 4) * 0.12;
    issMesh.scale.setScalar(0.06 * pulse);
  }
}
