const crypto = require('crypto');
const { pool } = require('../_db');
const { ensureEducationSchema } = require('../_education-db');
const { consumeRateLimit } = require('../_rate-limit');
const { cleanText, hasValidOrigin } = require('../_teacher-auth');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_JSON_LENGTH = 4000;

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

// A mission attempt always carries the student's prediction and computed
// result, so both are required objects here (not just size-bounded) —
// `null`/`undefined`/non-object input is rejected rather than silently
// stored as NULL.
function readRequiredJson(value) {
  if (value === null || value === undefined || typeof value !== 'object') return { ok: false };
  if (JSON.stringify(value).length > MAX_JSON_LENGTH) return { ok: false };
  return { ok: true, value };
}

async function handleGet(req, res) {
  const studentId = new URL(req.url || '/', 'http://localhost').searchParams.get('studentId') || '';
  if (!isUuid(studentId)) return res.status(400).json({ error: 'A valid studentId is required.' });

  // See join-class.js: a shared classroom network can generate many
  // legitimate requests in a burst, so pair a generous address ceiling with
  // a tighter per-student bucket instead of relying on IP alone.
  const addressRetryAfter = await consumeRateLimit(req, 'mission-attempts-read-address', 200, 15 * 60 * 1000);
  if (addressRetryAfter) {
    res.setHeader('Retry-After', String(addressRetryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  const studentRetryAfter = await consumeRateLimit(req, 'mission-attempts-read-student', 40, 15 * 60 * 1000, studentId);
  if (studentRetryAfter) {
    res.setHeader('Retry-After', String(studentRetryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { rows } = await pool.query(
    `SELECT mission_id, prediction, result, explanation, score, max_score, created_at
       FROM mission_attempts WHERE student_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [studentId]
  );
  return res.status(200).json({ attempts: rows });
}

async function handlePost(req, res) {
  if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });

  const studentId = String(req.body?.studentId || '');
  const missionId = cleanText(req.body?.missionId, 80);
  const explanation = cleanText(req.body?.explanation, 2000);
  const score = Number(req.body?.score);
  const maxScore = Number(req.body?.maxScore);
  const prediction = readRequiredJson(req.body?.prediction);
  const result = readRequiredJson(req.body?.result);

  if (!isUuid(studentId) || missionId.length < 1) {
    return res.status(400).json({ error: 'A valid studentId and missionId are required.' });
  }
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || score < 0 || maxScore <= 0 || score > maxScore || maxScore > 1000) {
    return res.status(400).json({ error: 'Score values are invalid.' });
  }
  if (!prediction.ok || !result.ok) {
    return res.status(400).json({ error: 'A valid prediction and result object is required.' });
  }

  // Same two-tier reasoning as the GET handler and join-class.js: a generous
  // address ceiling bounds abuse across many students, while a tighter
  // per-student bucket stops one id from being spammed with attempts.
  const addressRetryAfter = await consumeRateLimit(req, 'mission-attempts-write-address', 300, 15 * 60 * 1000);
  if (addressRetryAfter) {
    res.setHeader('Retry-After', String(addressRetryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }
  const studentRetryAfter = await consumeRateLimit(req, 'mission-attempts-write-student', 20, 15 * 60 * 1000, studentId);
  if (studentRetryAfter) {
    res.setHeader('Retry-After', String(studentRetryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  await ensureEducationSchema();
  const { rows } = await pool.query('SELECT id FROM student_profiles WHERE id = $1', [studentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Student profile not found.' });

  const attemptId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO mission_attempts (id, student_id, mission_id, prediction, result, explanation, score, max_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [attemptId, studentId, missionId, prediction.value, result.value, explanation, Math.round(score), Math.round(maxScore)]
  );
  return res.status(201).json({ id: attemptId });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[education] Mission attempt request failed:', error.message);
    return res.status(500).json({ error: 'The mission attempt request could not be completed.' });
  }
};
