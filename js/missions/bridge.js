// Drives the EXISTING Solaris controls (camera select, time-speed slider,
// orbit/label toggles) that already live in explorer.html and are wired up
// in js/ui.js / js/app.js. This module never touches the 3D engine, its
// rendering, or its orbital math — it only reads/writes the same DOM
// elements a visitor could operate by hand, dispatching the same events
// those controls already listen for.

function fireEvent(el, type) {
  if (el) el.dispatchEvent(new Event(type, { bubbles: true }));
}

function setCheckbox(id, checked) {
  const el = document.getElementById(id);
  if (!el || el.checked === Boolean(checked)) return;
  el.checked = Boolean(checked);
  fireEvent(el, 'change');
}

/** Flies the camera to an object already known to #camera-select. */
export function flyToObject(objectId) {
  const select = document.getElementById('camera-select');
  if (!select) return false;
  const hasOption = Array.from(select.options).some((option) => option.value === objectId);
  if (!hasOption) return false;
  select.value = objectId;
  fireEvent(select, 'change');
  return true;
}

export function resetToSolarSystemView() {
  document.getElementById('btn-solar-system')?.click();
}

export function setTimeSpeed(value) {
  const slider = document.getElementById('time-speed');
  if (!slider) return;
  const max = Number(slider.max) || 20;
  const min = Number(slider.min) || 0;
  const clamped = Math.min(max, Math.max(min, Number(value)));
  slider.value = String(clamped);
  fireEvent(slider, 'input');
}

export function setOrbitsVisible(visible) {
  setCheckbox('toggle-orbits', visible);
}

export function setLabelsVisible(visible) {
  setCheckbox('toggle-labels', visible);
}

/** Applies a mission's `simulation` config using only existing controls. */
export function applySimulationConfig(config = {}) {
  if (config.focusObjectId) flyToObject(config.focusObjectId);
  else resetToSolarSystemView();
  if (typeof config.orbitsVisible === 'boolean') setOrbitsVisible(config.orbitsVisible);
  if (typeof config.labelsVisible === 'boolean') setLabelsVisible(config.labelsVisible);
  if (typeof config.timeSpeed === 'number') setTimeSpeed(config.timeSpeed);
}

/** Captures the current control state so a mission can restore it on exit. */
export function captureSimulationState() {
  return {
    cameraValue: document.getElementById('camera-select')?.value ?? '',
    timeSpeed: Number(document.getElementById('time-speed')?.value ?? 1),
    orbitsVisible: Boolean(document.getElementById('toggle-orbits')?.checked),
    labelsVisible: Boolean(document.getElementById('toggle-labels')?.checked),
  };
}

/** Returns the visitor to the same spot they were in before the mission. */
export function restoreSimulationState(state) {
  if (!state) return;
  setTimeSpeed(state.timeSpeed);
  setOrbitsVisible(state.orbitsVisible);
  setLabelsVisible(state.labelsVisible);
  if (state.cameraValue) flyToObject(state.cameraValue);
  else resetToSolarSystemView();
}
