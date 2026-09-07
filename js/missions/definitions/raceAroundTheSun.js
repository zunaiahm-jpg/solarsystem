// "Race Around the Sun" — the first flagship mission (Section 3 of the
// education brief). Every number here is real data already used by the
// existing 3D engine (js/data.js OBJECT_METRICS); this module adds no new
// planetary facts, it only reuses them for a predict/observe/conclude loop.
import { OBJECT_METRICS } from '../../data.js';
import { DATA_LABEL } from '../schema.js';
import { combineScores } from '../scoring.js';

const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

function realOrbitalPeriods() {
  return PLANET_IDS
    .map((id) => ({ id, yearDays: OBJECT_METRICS[id].yearDays }))
    .sort((a, b) => a.yearDays - b.yearDays);
}

export const raceAroundTheSun = {
  id: 'race-around-the-sun',
  title: 'Race Around the Sun',
  description: 'Predict which planets circle the Sun fastest and slowest, then check your prediction against each planet\u2019s real orbital period.',
  ageRange: '8\u201313',
  difficulty: 'beginner',
  estimatedMinutes: 10,
  objectives: [
    'Explain that a planet\u2019s distance from the Sun affects how long its orbit takes.',
    'Compare the real orbital periods of the eight planets.',
    'Distinguish a personal prediction from measured, real data.',
  ],
  instructions: [
    'Predict which planet orbits the Sun fastest, and which is slowest.',
    'Watch the solar system run at a fast time speed to see the planets move.',
    'Compare your prediction with each planet\u2019s real orbital period.',
    'Write one or two sentences explaining what you noticed.',
  ],
  simulation: {
    focusObjectId: null,
    timeSpeed: 20,
    orbitsVisible: true,
    labelsVisible: true,
  },
  prediction: {
    labelKind: DATA_LABEL.HYPOTHETICAL,
    prompt: 'Which planet do you think completes one full orbit fastest? Which do you think is slowest?',
    fields: [
      { id: 'fastest', label: 'Fastest planet', type: 'select', options: PLANET_IDS },
      { id: 'slowest', label: 'Slowest planet', type: 'select', options: PLANET_IDS },
    ],
  },
  observation: {
    labelKind: DATA_LABEL.REAL,
    prompt: 'Here is each planet\u2019s real orbital period, from the same NASA-sourced data already used by Solaris.',
    getData: realOrbitalPeriods,
  },
  conclusion: {
    prompt: 'In one or two sentences, explain why some planets take longer to orbit the Sun than others.',
    minLength: 15,
  },
  scoring: {
    maxScore: 100,
    rubric: [
      { component: 'prediction', points: 60, description: 'Correctly identifying the fastest and slowest orbiting planets (30 points each).' },
      { component: 'conclusion', points: 40, description: 'Providing a written explanation of at least 15 characters.' },
    ],
    evaluate(prediction, conclusionText) {
      const data = realOrbitalPeriods();
      const actualFastest = data[0].id;
      const actualSlowest = data[data.length - 1].id;
      const components = [
        { label: 'Fastest planet prediction', earned: prediction?.fastest === actualFastest ? 30 : 0, possible: 30 },
        { label: 'Slowest planet prediction', earned: prediction?.slowest === actualSlowest ? 30 : 0, possible: 30 },
        { label: 'Written explanation', earned: String(conclusionText || '').trim().length >= 15 ? 40 : 0, possible: 40 },
      ];
      return { ...combineScores(components), actualFastest, actualSlowest };
    },
  },
  teacherNotes: 'Students commonly assume a planet\u2019s size determines its orbital speed. The real driver is distance from the Sun (a simplified view of Kepler\u2019s third law) \u2014 watch for that misconception in the written explanation.',
  answerKey: {
    fastest: 'mercury',
    slowest: 'neptune',
    explanationHint: 'Planets farther from the Sun travel more slowly and cover a much longer path, so their orbital period is far longer.',
  },
};
