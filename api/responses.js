const { pool } = require('./_db');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recent = new Map();

function clean(value, max) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendFeedbackEmail({ name, email, country, thoughts }) {
  const apiKey = process.env.SENDPULSE_API_KEY;
  if (!apiKey) throw new Error('SENDPULSE_API_KEY is not configured');

  const notificationAddress = 'feedbackteam@contact.solarisvr.com';
  const response = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: {
        subject: `New Solaris feedback from ${name}`,
        from: { name: 'Solaris Feedback', email: notificationAddress },
        to: [{ name: 'Solaris Feedback Team', email: notificationAddress }],
        reply_to: { name, email },
        html: `<h2>New Solaris feedback</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Country:</strong> ${escapeHtml(country)}</p><p><strong>Feedback:</strong></p><p>${escapeHtml(thoughts).replaceAll('\n', '<br>')}</p>`,
        text: `New Solaris feedback\n\nName: ${name}\nEmail: ${email}\nCountry: ${country}\n\nFeedback:\n${thoughts}`
      }
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendPulse returned ${response.status}: ${details.slice(0, 300)}`);
  }
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO visitor_responses (name, email, country, thoughts) VALUES ($1, $2, $3, $4)',
      [name, email, country, thoughts]
    );
    await sendFeedbackEmail({ name, email, country, thoughts });
    await client.query('COMMIT');
    recent.set(ip, now);
    res.status(201).json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[v0] Feedback submission failed:', error.message);
    res.status(500).json({ error: 'Your feedback could not be delivered. Please try again.' });
  } finally {
    client.release();
  }
};
