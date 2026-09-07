const { pool } = require('./_db');
const { ensureEducationSchema } = require('./_education-db');
const { consumeRateLimit } = require('./_rate-limit');
const { hasValidOrigin } = require('./_teacher-auth');

const JOIN_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function cleanJoinCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Lets a student join a class using the code their teacher shares (e.g. on a
// classroom screen), without requiring a student email or teacher sign-in.
// Trust model matches the class of "join code" classroom tools: knowing the
// unguessable code plus picking a name already set up by the teacher is
// sufficient to take a mission, mirroring how the class itself is presented.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });

  // A shared school network can send many legitimate join attempts (a whole
  // class joining, or several classes on one NAT address) in a short window,
  // so — like teacher-login.js — a single IP-only bucket would 429 real
  // students. A generous address ceiling still bounds abuse across many
  // *different* codes from one address; a separate per-code bucket bounds
  // repeated guesses against one specific code without capping unrelated
  // classes sharing that address.
  const addressRetryAfter = await consumeRateLimit(req, 'join-class-address', 120, 15 * 60 * 1000);
  if (addressRetryAfter) {
    res.setHeader('Retry-After', String(addressRetryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  const joinCode = cleanJoinCode(req.body?.joinCode);
  if (!JOIN_CODE_PATTERN.test(joinCode)) {
    return res.status(400).json({ error: 'Enter the 6-character class code from your teacher.' });
  }

  const codeRetryAfter = await consumeRateLimit(req, 'join-class-code', 60, 15 * 60 * 1000, joinCode);
  if (codeRetryAfter) {
    res.setHeader('Retry-After', String(codeRetryAfter));
    return res.status(429).json({ error: 'Too many attempts for this class code. Please try again later.' });
  }

  try {
    await ensureEducationSchema();
    const { rows: classRows } = await pool.query(
      'SELECT id, name FROM education_classes WHERE join_code = $1',
      [joinCode]
    );
    const classroom = classRows[0];
    if (!classroom) return res.status(404).json({ error: 'No class was found with that code.' });

    const { rows: students } = await pool.query(
      'SELECT id, display_name FROM student_profiles WHERE class_id = $1 ORDER BY display_name',
      [classroom.id]
    );
    return res.status(200).json({ classId: classroom.id, className: classroom.name, students });
  } catch (error) {
    console.error('[education] Join class lookup failed:', error.message);
    return res.status(500).json({ error: 'The class could not be found right now.' });
  }
};
