const { pool } = require('./_db');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recent = new Map();

function clean(value, max) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const now = Date.now();
  if (now - (recent.get(ip) || 0) < 10_000) return res.status(429).json({ error: 'Please wait before submitting again.' });

  const { website, startedAt } = req.body || {};
  if (website || !Number.isFinite(Number(startedAt)) || now - Number(startedAt) < 1800) {
    return res.status(400).json({ error: 'Unable to accept this submission.' });
  }

  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 254).toLowerCase();
  const country = clean(req.body.country, 100);
  const thoughts = clean(req.body.thoughts, 2000);
  if (name.length < 2 || !emailPattern.test(email) || country.length < 2 || thoughts.length < 3) {
    return res.status(400).json({ error: 'Please complete every field with valid details.' });
  }

  try {
    await pool.query(
      'INSERT INTO visitor_responses (name, email, country, thoughts) VALUES ($1, $2, $3, $4)',
      [name, email, country, thoughts]
    );
    recent.set(ip, now);
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Your response could not be saved. Please try again.' });
  }
};
