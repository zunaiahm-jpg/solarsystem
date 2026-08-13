// ─────────────────────────────────────────────────────────────────────────────
// vr.js — Immersive WebXR layer
//
// Everything needed to make a headset user feel like they are *standing inside*
// the solar system rather than looking at it through a window:
//
//   • A camera rig (dolly). In WebXR three.js overwrites camera.position with
//     the raw headset pose every frame, so the camera MUST be a child of a
//     group we control. Without this the user spawns at world origin — which
//     in this scene is dead centre of the Sun.
//   • A cinematic arrival glide so entering VR feels like flying into the zone.
//   • Thumbstick flight, snap-turn, and point-and-warp travel.
//   • A wrist-mounted readout, because every DOM element in the HUD is
//     invisible once the headset takes over the display.
//   • A comfort vignette that closes in while moving to suppress motion sickness.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const DEAD_ZONE = 0.18;
const SNAP_ANGLE = THREE.MathUtils.degToRad(30);
const BASE_SPEED = 7;        // metres / second at 1× (scene unit ≈ 1 metre)
const BOOST_MULTIPLIER = 6;  // squeeze the grip to travel between planets

// Where the user ends up, and where the arrival glide begins.
const SPAWN = new THREE.Vector3(0, 4.5, 27);
const ARRIVAL_FROM = new THREE.Vector3(0, 70, 520);
const ARRIVAL_DURATION = 4.5;

let renderer, scene, camera, controls;
let getTargets = () => [];
let onSelect = () => {};

let rig = null;
let presenting = false;
let vignette = null;
let wristPanel = null;
let wristCtx = null;
let wristTexture = null;

const controllers = [];
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

// Saved desktop camera state, restored when the headset session ends.
const savedCamera = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), target: new THREE.Vector3() };

// Travel animation state (arrival glide + point-and-warp).
let travelFrom = null;
let travelTo = null;
let travelT = 1;
let travelDuration = 1;

let snapArmed = true;
let hoveredName = null;
let selectedName = null;
let statusLine = 'Point at a world · trigger to inspect';
let lastMoveAmount = 0;
let surfaceMode = false;
let surfaceBody = null;
const SURFACE_CENTER = new THREE.Vector3(12000, 0, 12000);

export function setSurfaceMode(active, body = null) {
  surfaceMode = !!active;
  surfaceBody = body;
  statusLine = surfaceMode ? `${String(body || 'planet').toUpperCase()} surface · walk with stick · snap turn` : 'Point at a world · trigger to inspect';
  drawWristPanel();
}

export function isPresenting() {
  return presenting;
}

/** Move the whole rig — used so the "follow a planet" mode works in VR too. */
export function translateRig(delta) {
  if (rig) rig.position.add(delta);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export function setupVR(options) {
  renderer = options.renderer;
  scene = options.scene;
  camera = options.camera;
  controls = options.controls;
  getTargets = options.getTargets || getTargets;
  onSelect = options.onSelect || onSelect;

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  rig = new THREE.Group();
  rig.name = 'xr-rig';
  rig.position.copy(SPAWN);
  scene.add(rig);

  buildControllers();
  buildVignette();
  buildWristPanel();

  renderer.xr.addEventListener('sessionstart', handleSessionStart);
  renderer.xr.addEventListener('sessionend', handleSessionEnd);

  wireEnterButton();
}

// ─── Controllers ─────────────────────────────────────────────────────────────

function buildRay() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.65, depthTest: false })
  );
  line.name = 'ray';
  line.scale.z = 8;
  line.renderOrder = 900;
  return line;
}

function buildTip() {
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.9, depthTest: false })
  );
  tip.name = 'tip';
  tip.position.z = -8;
  tip.renderOrder = 901;
  return tip;
}

function buildGripMesh() {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.016, 0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0x8fb6d9 })
  );
  mesh.rotation.x = -Math.PI / 2.6;
  return mesh;
}

function buildControllers() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.userData.handedness = i === 0 ? 'left' : 'right';

    controller.addEventListener('connected', (event) => {
      controller.userData.handedness = event.data.handedness || controller.userData.handedness;
      controller.userData.gamepad = event.data.gamepad || null;
      controller.add(buildRay());
      controller.add(buildTip());
      controller.visible = true;
      if (controller.userData.handedness === 'left' && wristPanel && !wristPanel.parent) {
        controller.add(wristPanel);
      }
    });

    controller.addEventListener('disconnected', () => {
      controller.userData.gamepad = null;
      controller.visible = false;
    });

    controller.addEventListener('selectstart', () => handleTrigger(controller));
    controller.addEventListener('squeezestart', () => warpToSelection());

    rig.add(controller);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(buildGripMesh());
    rig.add(grip);

    controllers.push(controller);
  }
}

// ─── Comfort vignette ────────────────────────────────────────────────────────

function buildVignette() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.24, size / 2, size / 2, size * 0.52);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  vignette = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    })
  );
  vignette.position.z = -0.5;
  vignette.renderOrder = 999;
  vignette.frustumCulled = false;
  camera.add(vignette);
}

// ─── Wrist readout ───────────────────────────────────────────────────────────

function buildWristPanel() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  wristCtx = canvas.getContext('2d');
  wristTexture = new THREE.CanvasTexture(canvas);
  wristTexture.anisotropy = 4;

  wristPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.107),
    new THREE.MeshBasicMaterial({ map: wristTexture, transparent: true, depthTest: false })
  );
  wristPanel.position.set(0, 0.055, -0.045);
  wristPanel.rotation.x = -Math.PI / 3;
  wristPanel.renderOrder = 950;
  drawWristPanel();
}

function drawWristPanel() {
  if (!wristCtx) return;
  const ctx = wristCtx;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(5, 12, 32, 0.88)';
  roundRect(ctx, 4, 4, w - 8, h - 8, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 212, 255, 0.75)';
  ctx.font = '600 26px Rajdhani, sans-serif';
  ctx.fillText('SOLAR SYSTEM · VR', 30, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 48px "Exo 2", sans-serif';
  ctx.fillText(truncate(ctx, hoveredName || selectedName || 'Free flight', w - 60), 30, 118);

  ctx.fillStyle = 'rgba(190, 214, 240, 0.85)';
  ctx.font = '400 25px Rajdhani, sans-serif';
  wrapText(ctx, statusLine, 30, 168, w - 60, 32);

  ctx.fillStyle = 'rgba(140, 170, 200, 0.7)';
  ctx.font = '400 22px "Share Tech Mono", monospace';
  ctx.fillText('STICK fly · GRIP boost · SQUEEZE warp', 30, h - 34);

  wristTexture.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  let out = text;
  while (ctx.measureText(out).width > maxWidth && out.length > 3) out = out.slice(0, -1);
  return out === text ? out : out + '…';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

// ─── Session lifecycle ───────────────────────────────────────────────────────

function handleSessionStart() {
  presenting = true;

  // Stereo rendering across a 0.05 → 50000 depth range shimmers badly. Pull
  // the near plane forward for the headset only; nothing is that close to
  // your face out here anyway.
  savedCamera.near = camera.near;
  camera.near = 0.2;
  camera.updateProjectionMatrix();

  // Peripheral foveation buys headroom for a full 90 Hz refresh.
  if (typeof renderer.xr.setFoveation === 'function') renderer.xr.setFoveation(0.6);
  const session = renderer.xr.getSession?.();
  if (session && typeof session.updateTargetFrameRate === 'function' && session.supportedFrameRates) {
    const best = Math.max(...Array.from(session.supportedFrameRates).filter((r) => r <= 90));
    if (Number.isFinite(best)) session.updateTargetFrameRate(best).catch(() => {});
  }

  savedCamera.position.copy(camera.position);
  savedCamera.quaternion.copy(camera.quaternion);
  if (controls) {
    savedCamera.target.copy(controls.target);
    controls.enabled = false;
  }

  // Hand the camera to the rig. This is the critical step — without a parent
  // the headset pose resolves to world origin, i.e. inside the Sun.
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  rig.add(camera);

  rig.rotation.set(0, 0, 0);
  if (surfaceMode) {
    rig.position.copy(SURFACE_CENTER).add(new THREE.Vector3(0, 26, 34));
    startTravel(SURFACE_CENTER.clone().add(new THREE.Vector3(0, 1.7, 12)), 3.2);
  } else {
    rig.position.copy(ARRIVAL_FROM);
    startTravel(SPAWN, ARRIVAL_DURATION);
  }

  statusLine = surfaceMode ? `Descending to ${surfaceBody || 'planet'} surface…` : 'Approaching the solar system…';
  hoveredName = null;
  drawWristPanel();

  document.body.classList.add('xr-presenting');
}

function handleSessionEnd() {
  presenting = false;
  travelT = 1;

  rig.remove(camera);
  camera.position.copy(savedCamera.position);
  camera.quaternion.copy(savedCamera.quaternion);
  if (savedCamera.near) {
    camera.near = savedCamera.near;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld(true);
  if (controls) {
    controls.target.copy(savedCamera.target);
    controls.enabled = true;
    controls.update();
  }

  if (vignette) vignette.material.opacity = 0;
  document.body.classList.remove('xr-presenting');
}

// ─── Travel ──────────────────────────────────────────────────────────────────

function startTravel(destination, duration) {
  travelFrom = rig.position.clone();
  travelTo = destination.clone();
  travelDuration = duration;
  travelT = 0;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function warpToSelection() {
  const targets = getTargets();
  const match = targets.find((obj) => obj.userData && obj.userData.name === selectedName);
  if (!match) {
    statusLine = 'Nothing selected — point at a world and pull the trigger';
    drawWristPanel();
    return;
  }

  const worldPos = new THREE.Vector3();
  match.getWorldPosition(worldPos);

  const type = match.userData.objectType;
  const radius = match.userData.radius || match.userData.size || 2;
  const standOff = type === 'nebula'
    ? Math.max(match.userData.size * 0.9, 90)
    : type === 'star'
      ? Math.max(radius * 16, 40)
      : Math.max(radius * 5, 2.2);

  // Arrive slightly above the ecliptic, on the side we are already on, so the
  // approach never cuts through the body itself.
  const approach = rig.position.clone().sub(worldPos);
  if (approach.lengthSq() < 1e-4) approach.set(0, 0, 1);
  approach.normalize().multiplyScalar(standOff);
  approach.y = Math.abs(approach.y) + standOff * 0.25;

  const destination = worldPos.clone().add(approach);
  const distance = rig.position.distanceTo(destination);
  startTravel(destination, THREE.MathUtils.clamp(distance / 90, 1.6, 5));

  statusLine = `Warping to ${selectedName}`;
  drawWristPanel();
}

// ─── Input ───────────────────────────────────────────────────────────────────

function readStick(controller) {
  const pad = controller.userData.gamepad;
  if (!pad || !pad.axes) return { x: 0, y: 0 };
  // xr-standard maps the thumbstick to axes 2/3; older devices use 0/1.
  const x = pad.axes.length >= 4 ? pad.axes[2] : pad.axes[0] || 0;
  const y = pad.axes.length >= 4 ? pad.axes[3] : pad.axes[1] || 0;
  return {
    x: Math.abs(x) > DEAD_ZONE ? x : 0,
    y: Math.abs(y) > DEAD_ZONE ? y : 0
  };
}

function isSqueezed(controller) {
  const pad = controller.userData.gamepad;
  return !!(pad && pad.buttons && pad.buttons[1] && pad.buttons[1].pressed);
}

function controllerByHand(hand) {
  return controllers.find((c) => c.userData.handedness === hand) || null;
}

function handleTrigger(controller) {
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 6000;

  const hits = raycaster.intersectObjects(getTargets(), false);
  const hit = hits.find((h) => h.object.userData && h.object.userData.name);

  if (hit) {
    selectedName = hit.object.userData.name;
    statusLine = 'Squeeze the grip to fly there';
    onSelect(hit.object);
  } else {
    selectedName = null;
    statusLine = 'Point at a world · trigger to inspect';
  }
  drawWristPanel();
}

// ─── Per-frame update ────────────────────────────────────────────────────────

export function updateVR(delta) {
  if (!presenting || !rig) return;

  const step = Math.min(delta, 0.05);
  const previousPosition = rig.position.clone();

  if (travelT < 1) {
    updateTravel(step);
  } else {
    updateFlight(step);
    updateSnapTurn();
  }

  updatePointer();
  updateVignette(previousPosition, step);
}

function updateTravel(step) {
  travelT = Math.min(1, travelT + step / travelDuration);
  rig.position.lerpVectors(travelFrom, travelTo, easeInOutSine(travelT));
  if (travelT >= 1) {
    statusLine = selectedName
      ? `Arrived at ${selectedName}`
      : 'Point at a world · trigger to inspect';
    drawWristPanel();
  }
}

function updateFlight(step) {
  const left = controllerByHand('left') || controllers[0];
  const right = controllerByHand('right') || controllers[1];
  if (!left) return;

  const stick = readStick(left);
  if (!stick.x && !stick.y) return;

  const xrCamera = renderer.xr.getCamera();
  const orientation = new THREE.Quaternion();
  xrCamera.getWorldQuaternion(orientation);

  // Free flight in orbit; terrain-relative walking while landed.
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
  const strafe = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation);
  if (surfaceMode) {
    forward.y = 0;
    strafe.y = 0;
    forward.normalize();
    strafe.normalize();
  }

  const boost = (isSqueezed(left) || (right && isSqueezed(right))) ? BOOST_MULTIPLIER : 1;
  const speed = BASE_SPEED * (surfaceMode ? Math.min(boost, 1.8) : boost) * step;

  rig.position.addScaledVector(forward, -stick.y * speed);
  rig.position.addScaledVector(strafe, stick.x * speed);
  if (surfaceMode) {
    rig.position.y = Math.max(1.7, rig.position.y);
    rig.position.x = THREE.MathUtils.clamp(rig.position.x, SURFACE_CENTER.x - 112, SURFACE_CENTER.x + 112);
    rig.position.z = THREE.MathUtils.clamp(rig.position.z, SURFACE_CENTER.z - 112, SURFACE_CENTER.z + 112);
  }
}

function updateSnapTurn() {
  const right = controllerByHand('right') || controllers[1];
  if (!right) return;

  const stick = readStick(right);

  // Snap rather than smooth rotation — the single biggest comfort win in VR.
  if (Math.abs(stick.x) > 0.7) {
    if (snapArmed) {
      applySnapTurn(stick.x > 0 ? -SNAP_ANGLE : SNAP_ANGLE);
      snapArmed = false;
    }
  } else if (Math.abs(stick.x) < 0.4) {
    snapArmed = true;
  }

  if (stick.y && !surfaceMode) rig.position.y -= stick.y * BASE_SPEED * 0.016;
}

function applySnapTurn(angle) {
  // Rotate around the user's actual head, not the rig origin, so the world
  // does not swing away from under them.
  const head = new THREE.Vector3();
  renderer.xr.getCamera().getWorldPosition(head);

  const offset = rig.position.clone().sub(head).applyAxisAngle(UP, angle);
  rig.position.copy(head).add(offset);
  rig.rotation.y += angle;
}

function updatePointer() {
  const targets = getTargets();
  let name = null;

  for (const controller of controllers) {
    const ray = controller.getObjectByName('ray');
    const tip = controller.getObjectByName('tip');
    if (!ray) continue;

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.far = 6000;

    const hits = targets.length ? raycaster.intersectObjects(targets, false) : [];
    const hit = hits.find((h) => h.object.userData && h.object.userData.name);

    const length = hit ? Math.min(hit.distance, 60) : 8;
    ray.scale.z = length;
    if (tip) tip.position.z = -length;
    ray.material.opacity = hit ? 0.95 : 0.45;
    ray.material.color.setHex(hit ? 0x7fffd4 : 0x00d4ff);
    if (tip) tip.material.color.setHex(hit ? 0x7fffd4 : 0x00d4ff);

    if (hit && !name) name = hit.object.userData.name;
  }

  if (name !== hoveredName) {
    hoveredName = name;
    drawWristPanel();
  }
}

function updateVignette(previousPosition, step) {
  if (!vignette) return;
  const travelled = rig.position.distanceTo(previousPosition) / Math.max(step, 0.0001);
  lastMoveAmount = THREE.MathUtils.lerp(lastMoveAmount, travelled, 0.15);

  // Close the tunnel in proportion to speed; wide open when hovering still.
  const target = THREE.MathUtils.clamp(lastMoveAmount / 55, 0, 0.72);
  vignette.material.opacity = THREE.MathUtils.lerp(vignette.material.opacity, target, 0.1);
}

// ─── Enter-VR button ─────────────────────────────────────────────────────────

function notice(message) {
  let el = document.getElementById('vr-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vr-notice';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 6000);
}

function unavailableReason() {
  if (!window.isSecureContext) {
    return 'VR needs a secure connection. Open this page over HTTPS (the deployed vercel.app URL works).';
  }
  if (!navigator.xr) {
    return 'This browser has no WebXR. Open the page inside a headset browser (Quest, Vision Pro, Pico) or a PCVR-linked Chrome/Edge window.';
  }
  return 'No headset is reporting to this browser yet. Put the headset on, make sure Link/SteamVR is running, then tap the visor again.';
}

/** Ask the browser whether an immersive session is possible, right now. */
async function checkSupport() {
  if (!window.isSecureContext || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}

/**
 * Pick the best reference space the runtime actually grants. Requesting
 * 'local-floor' outright throws on runtimes without floor tracking, which is
 * one of the ways an otherwise healthy headset ends up showing an error.
 */
async function resolveReferenceSpace(session) {
  for (const type of ['local-floor', 'local', 'viewer']) {
    try {
      await session.requestReferenceSpace(type);
      renderer.xr.setReferenceSpaceType(type);
      return type;
    } catch {
      /* try the next one */
    }
  }
  return 'viewer';
}

function wireEnterButton() {
  const button = document.getElementById('btn-vr');
  if (!button) return;

  let session = null;
  let supported = false;

  const paint = () => {
    button.classList.toggle('vr-ready', supported);
    button.classList.toggle('vr-unsupported', !supported);
    button.title = supported
      ? 'Enter VR — step inside the solar system'
      : unavailableReason();
  };

  const refresh = async () => {
    supported = await checkSupport();
    paint();
  };

  refresh();

  // Headsets are frequently plugged in, woken, or Link-connected *after* the
  // page has loaded. Re-poll so the button lights up instead of staying stuck
  // on "not available".
  if (navigator.xr && typeof navigator.xr.addEventListener === 'function') {
    navigator.xr.addEventListener('devicechange', refresh);
  }
  window.addEventListener('focus', refresh);
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  button.addEventListener('click', () => {
    if (session) {
      session.end();
      return;
    }

    if (!window.isSecureContext || !navigator.xr) {
      notice(unavailableReason());
      return;
    }

    // Request the session *synchronously* inside the click. Awaiting anything
    // first (even isSessionSupported) burns the user activation on visionOS
    // and Safari, and the request is then rejected on a perfectly good
    // headset. We simply try, and explain if the runtime says no.
    button.classList.add('vr-connecting');
    navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
    })
      .then(async (xrSession) => {
        session = xrSession;
        supported = true;
        paint();
        session.addEventListener('end', () => {
          session = null;
          button.classList.remove('vr-active');
        });
        await resolveReferenceSpace(session);
        await renderer.xr.setSession(session);
        button.classList.add('vr-active');
        notice('Look around — stick to fly, grip to boost, trigger to inspect a world.');
      })
      .catch((error) => {
        session = null;
        const name = error?.name || '';
        if (name === 'NotSupportedError' || name === 'NotFoundError') {
          notice(unavailableReason());
        } else if (name === 'SecurityError' || name === 'InvalidStateError') {
          notice('The browser blocked the VR session. Tap the visor button directly (not via a script) and allow the immersive prompt.');
        } else {
          notice(`Could not start VR: ${error?.message || error}`);
        }
      })
      .finally(() => button.classList.remove('vr-connecting'));
  });
}
