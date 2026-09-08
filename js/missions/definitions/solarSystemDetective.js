// "Solar System Detective" \u2014 a clue-based "which planet am I?" mission.
// Every clue is built from real data already in js/data.js (OBJECT_METRICS
// and PLANETS_DATA); the mystery planet is chosen fresh each time the
// mission is opened and carried forward as this mission-open's own
// observation data, so nothing needs shared/mutable module state.
import { OBJECT_METRICS, PLANETS_DATA } from '../../data.js';
import { DATA_LABEL } from '../schema.js';
import { combineScores } from '../scoring.js';

const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

function moonsClue(moons) {
  if (moons === 0) return 'I have no known moons.';
  if (moons === 1) return 'I have exactly one known moon.';
  return `I have ${moons} known moons.`;
}

function buildClues(id) {
  const metrics = OBJECT_METRICS[id];
  const planet = PLANETS_DATA.find((entry) => entry.id === id);
  return [
    `I am about ${Math.round(metrics.diameterKm).toLocaleString()} km across.`,
    `I am about ${(metrics.distanceKm / 1e6).toFixed(1)} million km from the Sun.`,
    `I take about ${Math.round(metrics.yearDays).toLocaleString()} Earth days to complete one orbit.`,
    moonsClue(metrics.moons),
    `${planet.description.split('. ')[0]}.`,
  ];
}

function pickMysteryPlanet() {
  const id = PLANET_IDS[Math.floor(Math.random() * PLANET_IDS.length)];
  return { clues: buildClues(id), answerId: id };
}

export const solarSystemDetective = {
  id: 'solar-system-detective',
  title: 'Solar System Detective',
  description: 'Read real clues about a mystery planet, then use reasoning \u2014 not a first guess \u2014 to figure out which one it is.',
  ageRange: '8\u201313',
  difficulty: 'beginner',
  estimatedMinutes: 8,
  objectives: [
    'Use real planetary facts as evidence to identify an unknown planet.',
    'Practice reasoning from clues rather than guessing first.',
    'Distinguish a real, sourced clue from your own deduction.',
  ],
  instructions: [
    'Read five real clues about a mystery planet.',
    'Guess which planet you think it is.',
    'Explain which clue helped you decide the most.',
  ],
  stepOrder: ['intro', 'observe', 'predict', 'conclude', 'score'],
  simulation: {
    focusObjectId: null,
    timeSpeed: 1,
    orbitsVisible: true,
    labelsVisible: false,
  },
  observation: {
    labelKind: DATA_LABEL.REAL,
    prompt: 'Here are five real clues about a mystery planet, from the same NASA-sourced data already used by Solaris.',
    presentation: 'clues',
    getData: pickMysteryPlanet,
  },
  prediction: {
    labelKind: DATA_LABEL.HYPOTHETICAL,
    prompt: 'Which planet do you think matches these clues?',
    fields: [
      { id: 'guess', label: 'My guess', type: 'select', options: PLANET_IDS },
    ],
  },
  conclusion: {
    prompt: 'In one or two sentences, explain which clue helped you decide the most.',
    minLength: 15,
  },
  scoring: {
    maxScore: 100,
    rubric: [
      { component: 'prediction', points: 60, description: 'Correctly identifying the mystery planet from its real clues.' },
      { component: 'conclusion', points: 40, description: 'Explaining which clue was most useful, in at least 15 characters.' },
    ],
    evaluate(prediction, conclusionText, observationData) {
      const actualPlanet = observationData?.answerId;
      const components = [
        { label: 'Mystery planet identified correctly', earned: prediction?.guess === actualPlanet ? 60 : 0, possible: 60 },
        { label: 'Written explanation', earned: String(conclusionText || '').trim().length >= 15 ? 40 : 0, possible: 40 },
      ];
      return { ...combineScores(components), actualPlanet };
    },
  },
  teacherNotes: 'This beginner tier uses five straightforward clues per planet. Intermediate/advanced tiers (fewer, less obvious clues, or narrowing among similar planets) are a natural follow-up once the framework supports per-mission difficulty variants.',
  answerKey: {
    note: 'The mystery planet is chosen at random each time the mission opens; there is no single fixed answer to record.',
  },
};
