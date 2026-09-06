const crypto = require('crypto');
const { pool } = require('./_db');
const { cleanText, hasValidOrigin, requireTeacher } = require('./_teacher-auth');

function requestedClassId(req) {
  if (req.body?.classId) return String(req.body.classId);
  return new URL(req.url || '/', 'http://localhost').searchParams.get('classId') || '';
}

module.exports = async function handler(req, res) {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    if (req.method === 'POST' && !hasValidOrigin(req)) {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }

    const classId = requestedClassId(req);
    const ownedClass = await pool.query(
      'SELECT id FROM education_classes WHERE id = $1 AND teacher_id = $2',
      [classId, teacher.id]
    ).catch((error) => error.code === '22P02' ? { rows: [] } : Promise.reject(error));
    if (!ownedClass.rows[0]) return res.status(404).json({ error: 'Class not found.' });

    if (req.method === 'GET') {
      const { rows } = await pool.query(
        'SELECT id, display_name, created_at FROM student_profiles WHERE class_id = $1 ORDER BY display_name',
        [classId]
      );
      return res.status(200).json({ students: rows });
    }

    const displayName = cleanText(req.body?.displayName, 80);
    if (displayName.length < 1) return res.status(400).json({ error: 'Enter a student display name.' });
    const { rows } = await pool.query(
      `INSERT INTO student_profiles (id, class_id, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, display_name, created_at`,
      [crypto.randomUUID(), classId, displayName]
    );
    return res.status(201).json({ student: rows[0] });
  } catch (error) {
    console.error('[education] Student profile request failed:', error.message);
    return res.status(500).json({ error: 'The student profile request could not be completed.' });
  }
};
