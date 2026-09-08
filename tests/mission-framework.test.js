const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function importModule(relativePath) {
  return import(pathToFileURL(path.join(__dirname, relativePath)).href);
}

test('a mission missing required fields fails validation with useful messages', async () => {
  const { validateMission } = await importModule('../js/missions/schema.js');
  const errors = validateMission({ id: 'x' });
  assert.ok(errors.length > 0);
  assert.ok(errors.some((message) => message.includes('title')));
});

test('the shipped Race Around the Sun mission satisfies the generic schema', async () => {
  const { validateMission } = await importModule('../js/missions/schema.js');
  const { raceAroundTheSun } = await importModule('../js/missions/definitions/raceAroundTheSun.js');
  assert.deepEqual(validateMission(raceAroundTheSun), []);
});

test('Race Around the Sun observation data is sourced from the engine\'s own real metrics', async () => {
  const { raceAroundTheSun } = await importModule('../js/missions/definitions/raceAroundTheSun.js');
  const { OBJECT_METRICS } = await importModule('../js/data.js');
  const rows = raceAroundTheSun.observation.getData();
  assert.equal(rows.length, 8);
  for (const row of rows) assert.equal(row.yearDays, OBJECT_METRICS[row.id].yearDays);
  // Sorted fastest (Mercury) to slowest (Neptune), matching real orbital periods.
  assert.equal(rows[0].id, 'mercury');
  assert.equal(rows[rows.length - 1].id, 'neptune');
});

test('scoring rewards a fully correct prediction and explanation with the max score', async () => {
  const { raceAroundTheSun } = await importModule('../js/missions/definitions/raceAroundTheSun.js');
  const result = raceAroundTheSun.scoring.evaluate(
    { fastest: 'mercury', slowest: 'neptune' },
    'Planets farther from the Sun travel a longer, slower path.'
  );
  assert.equal(result.earned, 100);
  assert.equal(result.possible, 100);
  assert.equal(result.percentage, 100);
});

test('scoring gives partial credit for a partially correct attempt', async () => {
  const { raceAroundTheSun } = await importModule('../js/missions/definitions/raceAroundTheSun.js');
  const result = raceAroundTheSun.scoring.evaluate({ fastest: 'venus', slowest: 'neptune' }, 'too short');
  assert.equal(result.earned, 30);
  assert.equal(result.possible, 100);
});

test('combineScores aggregates component scores consistently', async () => {
  const { combineScores } = await importModule('../js/missions/scoring.js');
  const result = combineScores([
    { label: 'a', earned: 10, possible: 20 },
    { label: 'b', earned: -5, possible: 10 },
  ]);
  assert.equal(result.earned, 10);
  assert.equal(result.possible, 30);
  assert.equal(result.percentage, 33);
});

test('The Scale Problem mission satisfies the generic schema and reuses real metrics', async () => {
  const { validateMission } = await importModule('../js/missions/schema.js');
  const { theScaleProblem } = await importModule('../js/missions/definitions/theScaleProblem.js');
  const { OBJECT_METRICS } = await importModule('../js/data.js');
  assert.deepEqual(validateMission(theScaleProblem), []);
  const rows = theScaleProblem.observation.getData();
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.equal(row.diameterKm, OBJECT_METRICS[row.id].diameterKm);
    assert.equal(row.distanceKm, OBJECT_METRICS[row.id].distanceKm);
  }
});

test('The Scale Problem scoring accepts a reasonable Jupiter-to-Earth estimate and the real closest-sized planet', async () => {
  const { theScaleProblem } = await importModule('../js/missions/definitions/theScaleProblem.js');
  const goodResult = theScaleProblem.scoring.evaluate(
    { closestSize: 'venus', jupiterEarths: 11 },
    'Illustrations cannot show real size and real distance at once.'
  );
  assert.equal(goodResult.earned, 100);
  const poorResult = theScaleProblem.scoring.evaluate({ closestSize: 'mars', jupiterEarths: 2 }, 'x');
  assert.equal(poorResult.earned, 0);
});

test('Solar System Detective satisfies the generic schema with a clue-first step order', async () => {
  const { validateMission } = await importModule('../js/missions/schema.js');
  const { solarSystemDetective } = await importModule('../js/missions/definitions/solarSystemDetective.js');
  assert.deepEqual(validateMission(solarSystemDetective), []);
  assert.deepEqual(solarSystemDetective.stepOrder, ['intro', 'observe', 'predict', 'conclude', 'score']);
});

test('Solar System Detective clues always name a real planet and score against that same planet', async () => {
  const { solarSystemDetective } = await importModule('../js/missions/definitions/solarSystemDetective.js');
  const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const observationData = solarSystemDetective.observation.getData();
    assert.ok(PLANET_IDS.includes(observationData.answerId));
    assert.ok(observationData.clues.length >= 4);
  }
  const observationData = { answerId: 'saturn', clues: [] };
  const correct = solarSystemDetective.scoring.evaluate({ guess: 'saturn' }, 'The rings and moon count gave it away.', observationData);
  const incorrect = solarSystemDetective.scoring.evaluate({ guess: 'mercury' }, 'The rings and moon count gave it away.', observationData);
  assert.equal(correct.earned, 100);
  assert.equal(incorrect.earned, 40);
});
