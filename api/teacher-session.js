const { getTeacher } = require('./_teacher-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const teacher = await getTeacher(req);
    if (!teacher) return res.status(401).json({ error: 'Not signed in.' });
    return res.status(200).json({ teacher });
  } catch (error) {
    console.error('[education] Session lookup failed:', error.message);
    return res.status(500).json({ error: 'The session could not be checked.' });
  }
};
