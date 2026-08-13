import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { setupVR, updateVR, isPresenting } from './vr.js?v=astronaut-8';

import {
  createStarField, createFamousStars, createConstellations,
  updateStars, setStarsVisible, setConstellationsVisible, starObjects,
  getSkyStatus
} from './stars.js?v=astronaut-8';
import {
  createSolarSystem, updateSolarSystem, updateOrbitResolution, solarSystemObjects,
  setPlanetsVisible, setOrbitsVisible,
  selectObject, deselectAll
} from './solarSystem.js?v=astronaut-8';
import { createNebulae, updateNebulae, setNebulaeVisible, nebulaObjects } from './nebulae.js?v=astronaut-8';
import { createLabels, updateLabels, setLabelsVisible } from './labels.js?v=astronaut-8';
import {
  setupUI, showInfoPanel, closeInfoPanel, showTooltip, hideTooltip,
  updateCoordinates, updateZoomLevel, updateCompass, setupViewButtons,
  highlightSidebarPlanet, clearSidebarHighlight
} from './ui.js?v=astronaut-8';

// ─── Renderer ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('space-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const lowPowerDevice = navigator.deviceMemory && navigator.deviceMemory <= 4;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPowerDevice ? 1.25 : 2));
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
composer.addPass(bloomPass);

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

requestAnimationFrame(() => {
  allClickable = [...solarSystemObjects, ...starObjects, ...nebulaObjects];
  createLabels(scene, allClickable);
});

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
  // Feeds the in-VR diagnostics overlay the live sky-plate tier, so a headset
  // user can confirm the 8K plate actually loaded without leaving the session.
  getSkyStatus,
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

// ─── Mouse events ─────────────────────────────────────────────────────────────
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
  camera,
  controls,
  scene,
  layerCallbacks: {
    planets: setPlanetsVisible,
    orbits: setOrbitsVisible,
    stars: setStarsVisible,
    constellations: setConstellationsVisible,
    nebulae: setNebulaeVisible,
    labels: setLabelsVisible
  },
  flyToCallback: flyToObjectId,
  sidebarSelectCallback: null, // sidebar already flies via flyToCallback
  selectCallback: (mesh) => selectMesh(mesh),
  onLoaded: () => { /* scene already built */ }
});

setupViewButtons({
  solarSystem: () => {
    deselect();
    flyFrom = camera.position.clone();
    flyDest = new THREE.Vector3(0, 65, 200);
    flyLook = new THREE.Vector3(0, 0, 0);
    flyT = 0;
  },
  galaxy: () => {
    deselect();
    flyFrom = camera.position.clone();
    flyDest = new THREE.Vector3(200, 600, 1200);
    flyLook = new THREE.Vector3(0, 0, 0);
    flyT = 0;
  },
  reset: () => {
    deselect();
    flyFrom = camera.position.clone();
    flyDest = new THREE.Vector3(0, 65, 200);
    flyLook = new THREE.Vector3(0, 0, 0);
    flyT = 0;
    controls.target.set(0, 0, 0);
  }
});

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

  // Update systems
  updateSolarSystem(elapsed, timeScale);
  updateStars(elapsed);
  updateNebulae(elapsed);
  updateLabels(camera);

  // Camera follows the selected object as it orbits (once fly-in has settled)
  if (!inVR && followedMesh && flyT >= 1) {
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

  // Update UI elements
  updateCoordinates(camera.position);
  updateZoomLevel(camera.position.distanceTo(controls.target));
  updateCompass(camera);

  controls.update();
  composer.render();
}

renderer.setAnimationLoop(animate);
