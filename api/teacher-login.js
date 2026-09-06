const { pool } = require('./_db');
const { ensureEducationSchema } = require('./_education-db');
const { consumeRateLimit } = require('./_rate-limit');
const {
  createTeacherSession,
  hasValidOrigin,
  normalizeEmail,
  verifyPassword,
} = require('./_teacher-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  // A coarse per-address ceiling bounds total scrypt CPU (and rate-limit
  // table writes) one client can trigger across many accounts. It is
  // checked first and short-circuits before the per-account limiter, so an
  // attacker who has already hit it cannot keep inserting new limiter rows
  // by submitting further distinct, attacker-controlled email addresses.
  // The tighter per-account limit stops brute-forcing a single teacher's
  // password. Neither limiter is cleared on success, so a valid credential
  // can't be used to keep resetting either budget and sustain unbounded
  // computation.
  const addressRetryAfter = await consumeRateLimit(req, 'teacher-login-address', 30, 15 * 60 * 1000);
  if (addressRetryAfter) {
    res.setHeader('Retry-After', String(addressRetryAfter));
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  }
  const accountRetryAfter = await consumeRateLimit(req, 'teacher-login-account', 10, 15 * 60 * 1000, email);
  if (accountRetryAfter) {
    res.setHeader('Retry-After', String(accountRetryAfter));
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  }

  await ensureEducationSchema();
  const { rows } = await pool.query(
    'SELECT id, email, school, password_hash FROM teacher_accounts WHERE email = $1',
    [email]
  );
  const teacher = rows[0];
  if (!teacher || !(await verifyPassword(password, teacher.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM teacher_sessions WHERE expires_at <= NOW()');
    await createTeacherSession(client, res, teacher.id);
    await client.query('COMMIT');
    return res.status(200).json({ teacher: { id: teacher.id, email: teacher.email, school: teacher.school } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[education] Teacher login failed:', error.message);
    return res.status(500).json({ error: 'Sign in is temporarily unavailable.' });
  } finally {
    client.release();
  }
};
