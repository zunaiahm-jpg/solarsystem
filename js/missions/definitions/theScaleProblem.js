// "The Scale Problem" \u2014 a guided investigation into the real relative
// sizes and distances of the planets, contrasted with how compressed most
// illustrations (including Solaris's own stylized 3D scene) have to be to
// stay comfortable to explore. Every number reuses the real data already in
// js/data.js OBJECT_METRICS; nothing is duplicated or invented here.
import { OBJECT_METRICS } from '../../data.js';
import { DATA_LABEL } from '../schema.js';
import { combineScores } from '../scoring.js';

const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const EARTH_DIAMETER_KM = OBJECT_METRICS.earth.diameterKm;
const JUPITER_TO_EARTH_RATIO = OBJECT_METRICS.jupiter.diameterKm / EARTH_DIAMETER_KM;

function realSizesAndDistances() {
  return PLANET_IDS
    .map((id) => ({ id, diameterKm: OBJECT_METRICS[id].diameterKm, distanceKm: OBJECT_METRICS[id].distanceKm }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function closestInSizeToEarth() {
  return PLANET_IDS
    .filter((id) => id !== 'earth')
    .map((id) => ({ id, diff: Math.abs(OBJECT_METRICS[id].diameterKm - EARTH_DIAMETER_KM) }))
    .sort((a, b) => a.diff - b.diff)[0].id;
}

export const theScaleProblem = {
  id: 'the-scale-problem',
  title: 'The Scale Problem',
  description: 'Predict how the planets really compare in size and distance, then see how far off most illustrations \u2014 including 3D scenes like this one \u2014 have to bend reality to stay viewable.',
  ageRange: '9\u201314',
  difficulty: 'intermediate',
  estimatedMinutes: 12,
  objectives: [
    'Compare the real diameters and distances of the eight planets.',
    'Estimate a size ratio between two real-world objects.',
    'Explain why 3D and illustrated solar system models cannot show true scale at the same time as being explorable.',
  ],
  instructions: [
    'Predict which planet is closest to Earth in size, and estimate how many Earths could fit side-by-side across Jupiter.',
    'Look around the 3D scene and notice how close together the planets appear.',
    'Compare your prediction with each planet\u2019s real diameter and real distance from the Sun.',
    'Write one or two sentences about why illustrations usually distort scale.',
  ],
  simulation: {
    focusObjectId: null,
    timeSpeed: 1,
    orbitsVisible: true,
    labelsVisible: true,
  },
  prediction: {
    labelKind: DATA_LABEL.HYPOTHETICAL,
    prompt: 'Which planet (besides Earth) do you think is closest to Earth in size? About how many Earths could fit side-by-side across Jupiter?',
    fields: [
      { id: 'closestSize', label: 'Closest in size to Earth', type: 'select', options: PLANET_IDS.filter((id) => id !== 'earth') },
      { id: 'jupiterEarths', label: 'Earths across Jupiter (a number)', type: 'number', min: 1, max: 50 },
    ],
  },
  observation: {
    labelKind: DATA_LABEL.REAL,
    prompt: 'Here are the real diameters and distances from the Sun, from the same NASA-sourced data already used by Solaris \u2014 notice how different these ratios are from what a comfortable 3D view can show at once.',
    getData: realSizesAndDistances,
    columns: [
      { key: 'id', label: 'Planet' },
      { key: 'diameterKm', label: 'Diameter', format: (value) => `${Math.round(value).toLocaleString()} km` },
      { key: 'distanceKm', label: 'Distance from Sun', format: (value) => `${Math.round(value).toLocaleString()} km` },
    ],
  },
  conclusion: {
    prompt: 'In one or two sentences, explain why illustrations (including this 3D scene) usually cannot show the real sizes and distances of the planets at the same time.',
    minLength: 15,
  },
  scoring: {
    maxScore: 100,
    rubric: [
      { component: 'prediction', points: 60, description: 'Identifying the planet closest in size to Earth (30 points) and estimating the Jupiter-to-Earth size ratio within a reasonable range (30 points).' },
      { component: 'conclusion', points: 40, description: 'Providing a written explanation of at least 15 characters.' },
    ],
    evaluate(prediction, conclusionText) {
      const actualClosest = closestInSizeToEarth();
      const jupiterGuess = Number(prediction?.jupiterEarths);
      const jupiterWithinRange = Number.isFinite(jupiterGuess) && jupiterGuess >= 8 && jupiterGuess <= 14;
      const components = [
        { label: 'Closest-in-size planet prediction', earned: prediction?.closestSize === actualClosest ? 30 : 0, possible: 30 },
        { label: 'Jupiter-to-Earth size estimate', earned: jupiterWithinRange ? 30 : 0, possible: 30 },
        { label: 'Written explanation', earned: String(conclusionText || '').trim().length >= 15 ? 40 : 0, possible: 40 },
      ];
      return { ...combineScores(components), actualClosest, actualJupiterRatio: Math.round(JUPITER_TO_EARTH_RATIO * 10) / 10 };
    },
  },
  teacherNotes: 'Most students underestimate how empty space is and overestimate how similar planet sizes are, because illustrations compress both. Jupiter\u2019s real diameter is about 11 Earths across; the accepted range here (8\u201314) allows for reasonable estimation rather than exact recall.',
  answerKey: {
    closestSize: 'venus',
    jupiterEarthsApprox: Math.round(JUPITER_TO_EARTH_RATIO * 10) / 10,
    explanationHint: 'Showing real distances would push most planets off-screen; showing real sizes would make most planets nearly invisible dots. Illustrations trade accuracy for visibility.',
  },
};
