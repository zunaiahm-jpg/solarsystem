const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('./_db');
const { ensureEducationSchema } = require('./_education-db');

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = 'solaris_teacher';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, max) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
}

function normalizeEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return emailPattern.test(value);
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

async function verifyPassword(password, stored) {
  const [saltValue, hashValue] = String(stored || '').split(':');
  if (!saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sessionCookie(token, maxAge = SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function createTeacherSession(client, res, teacherId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await client.query(
    'INSERT INTO teacher_sessions (id, teacher_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [crypto.randomUUID(), teacherId, hashToken(token), expiresAt]
  );
  res.setHeader('Set-Cookie', sessionCookie(token));
}

async function getTeacher(req) {
  await ensureEducationSchema();
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT teachers.id, teachers.email, teachers.school
       FROM teacher_sessions sessions
       JOIN teacher_accounts teachers ON teachers.id = sessions.teacher_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

async function requireTeacher(req, res) {
  const teacher = await getTeacher(req);
  if (!teacher) {
    res.status(401).json({ error: 'Please sign in with a teacher account.' });
    return null;
  }
  return teacher;
}

async function destroyTeacherSession(req, res) {
  await ensureEducationSchema();
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) await pool.query('DELETE FROM teacher_sessions WHERE token_hash = $1', [hashToken(token)]);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
}

function hasValidOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  try {
    return new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

module.exports = {
  cleanText,
  createTeacherSession,
  destroyTeacherSession,
  getTeacher,
  hasValidOrigin,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  requireTeacher,
  verifyPassword,
};
