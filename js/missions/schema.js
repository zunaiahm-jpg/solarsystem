// Generic, data-driven mission schema shared by every mission (Section 3 of
// the education roadmap brief). New missions are authored as plain objects
// matching this shape; nothing here duplicates the 3D engine's own data or
// rendering — `simulation` only carries the values the bridge (see bridge.js)
// feeds into the *existing* Solaris controls.

export const DATA_LABEL = Object.freeze({
  REAL: 'real',
  MODEL: 'model',
  HYPOTHETICAL: 'hypothetical',
});

export const DATA_LABEL_TEXT = Object.freeze({
  [DATA_LABEL.REAL]: 'Real data',
  [DATA_LABEL.MODEL]: 'Educational model',
  [DATA_LABEL.HYPOTHETICAL]: 'Hypothetical',
});

const REQUIRED_STRING_FIELDS = ['id', 'title', 'description', 'ageRange', 'difficulty'];
const KNOWN_STEPS = ['intro', 'predict', 'simulate', 'observe', 'conclude', 'score'];
const REQUIRED_STEPS = ['intro', 'predict', 'observe', 'conclude', 'score'];

/**
 * @typedef {Object} MissionSimulationConfig
 * @property {string|null} focusObjectId - id understood by #camera-select, or null for overview.
 * @property {number} timeSpeed - 0-20, matches the existing time-speed slider range.
 * @property {boolean} orbitsVisible
 * @property {boolean} labelsVisible
 */

/**
 * Validates a mission definition object against the shared schema.
 * Returns an array of human-readable error strings; an empty array means valid.
 * @param {object} mission
 * @returns {string[]}
 */
export function validateMission(mission) {
  const errors = [];
  if (!mission || typeof mission !== 'object') return ['Mission must be an object.'];

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof mission[field] !== 'string' || mission[field].trim().length === 0) {
      errors.push(`Mission is missing a non-empty "${field}" string.`);
    }
  }
  if (!Number.isFinite(mission.estimatedMinutes) || mission.estimatedMinutes <= 0) {
    errors.push('Mission is missing a positive "estimatedMinutes" number.');
  }
  if (!Array.isArray(mission.objectives) || mission.objectives.length === 0) {
    errors.push('Mission must include at least one learning objective.');
  }
  if (!Array.isArray(mission.instructions) || mission.instructions.length === 0) {
    errors.push('Mission must include at least one instruction step.');
  }
  if (!mission.simulation || typeof mission.simulation !== 'object') {
    errors.push('Mission must include a "simulation" configuration object.');
  }
  if (!mission.prediction || typeof mission.prediction !== 'object') {
    errors.push('Mission must include a "prediction" step definition.');
  } else if (!Object.values(DATA_LABEL).includes(mission.prediction.labelKind)) {
    errors.push('Mission prediction step must declare a valid "labelKind".');
  }
  if (!mission.observation || typeof mission.observation !== 'object') {
    errors.push('Mission must include an "observation" step definition.');
  } else if (!Object.values(DATA_LABEL).includes(mission.observation.labelKind)) {
    errors.push('Mission observation step must declare a valid "labelKind".');
  } else if (typeof mission.observation.getData !== 'function') {
    errors.push('Mission observation step must provide a "getData" function.');
  } else if (mission.observation.presentation !== 'clues' && (!Array.isArray(mission.observation.columns) || mission.observation.columns.length === 0)) {
    errors.push('Mission observation step must declare a non-empty "columns" array for its data table, unless using the "clues" presentation.');
  }
  if (mission.stepOrder !== undefined) {
    if (!Array.isArray(mission.stepOrder) || mission.stepOrder.some((step) => !KNOWN_STEPS.includes(step))) {
      errors.push('Mission "stepOrder", if provided, must be an array using only known step names.');
    } else if (REQUIRED_STEPS.some((step) => !mission.stepOrder.includes(step))) {
      errors.push('Mission "stepOrder" must include intro, predict, observe, conclude, and score.');
    }
  }
  if (!mission.conclusion || typeof mission.conclusion !== 'object') {
    errors.push('Mission must include a "conclusion" step definition.');
  }
  if (!mission.scoring || typeof mission.scoring.maxScore !== 'number') {
    errors.push('Mission must include a "scoring" object with a numeric "maxScore".');
  } else if (typeof mission.scoring.evaluate !== 'function') {
    errors.push('Mission scoring must provide an "evaluate" function.');
  }
  return errors;
}

export function isValidMission(mission) {
  return validateMission(mission).length === 0;
}
