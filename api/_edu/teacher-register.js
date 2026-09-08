const crypto = require('crypto');
const { pool } = require('../_db');
const { ensureEducationSchema } = require('../_education-db');
const { consumeRateLimit } = require('../_rate-limit');
const {
  cleanText,
  createTeacherSession,
  hasValidOrigin,
  hashPassword,
  isValidEmail,
  normalizeEmail,
} = require('../_teacher-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
  const retryAfter = await consumeRateLimit(req, 'teacher-register', 5, 15 * 60 * 1000);
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many account attempts. Please try again later.' });
  }

  const email = normalizeEmail(req.body?.email);
  const school = cleanText(req.body?.school, 160);
  const password = String(req.body?.password || '');
  if (!isValidEmail(email) || school.length < 2) {
    return res.status(400).json({ error: 'Enter a valid email address and school name.' });
  }
  if (password.length < 10 || password.length > 200) {
    return res.status(400).json({ error: 'Use a password between 10 and 200 characters.' });
  }

  const passwordHash = await hashPassword(password);
  await ensureEducationSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const teacherId = crypto.randomUUID();
    await client.query(
      'INSERT INTO teacher_accounts (id, email, school, password_hash) VALUES ($1, $2, $3, $4)',
      [teacherId, email, school, passwordHash]
    );
    await createTeacherSession(client, res, teacherId);
    await client.query('COMMIT');
    return res.status(201).json({ teacher: { id: teacherId, email, school } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'A teacher account already uses this email.' });
    console.error('[education] Teacher registration failed:', error.message);
    return res.status(500).json({ error: 'The teacher account could not be created.' });
  } finally {
    client.release();
  }
};
