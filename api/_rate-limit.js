const crypto = require('crypto');
const { pool } = require('./_db');
const { ensureEducationSchema } = require('./_education-db');

function clientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((value) => value.trim()).filter(Boolean);
  return forwarded.at(-1) || req.socket?.remoteAddress || 'unknown';
}

function rateLimitKey(req, scope, extra = '') {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET || process.env.DATABASE_URL || 'local-development';
  return crypto.createHmac('sha256', secret).update(`${scope}:${clientAddress(req)}:${extra}`).digest('hex');
}

async function consumeRateLimit(req, scope, limit, windowMs, extra = '') {
  await ensureEducationSchema();
  await pool.query('DELETE FROM education_auth_limits WHERE reset_at <= NOW()');
  const { rows } = await pool.query(
    `INSERT INTO education_auth_limits (key_hash, attempts, reset_at)
     VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond'))
     ON CONFLICT (key_hash) DO UPDATE SET
       attempts = CASE
         WHEN education_auth_limits.reset_at <= NOW() THEN 1
         ELSE education_auth_limits.attempts + 1
       END,
       reset_at = CASE
         WHEN education_auth_limits.reset_at <= NOW() THEN NOW() + ($2 * INTERVAL '1 millisecond')
         ELSE education_auth_limits.reset_at
       END
     RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - NOW()))))::INTEGER AS retry_after`,
    [rateLimitKey(req, scope, extra), windowMs]
  );
  return rows[0].attempts > limit ? rows[0].retry_after : 0;
}

module.exports = { consumeRateLimit, rateLimitKey };
