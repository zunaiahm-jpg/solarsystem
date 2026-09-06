const { destroyTeacherSession, hasValidOrigin } = require('./_teacher-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
  try {
    await destroyTeacherSession(req, res);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[education] Teacher logout failed:', error.message);
    return res.status(500).json({ error: 'Sign out could not be completed.' });
  }
};
