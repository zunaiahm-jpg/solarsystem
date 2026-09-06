const crypto = require('crypto');
const { pool } = require('./_db');
const { cleanText, hasValidOrigin, requireTeacher } = require('./_teacher-auth');

const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeJoinCode() {
  return Array.from(crypto.randomBytes(6), (value) => JOIN_ALPHABET[value % JOIN_ALPHABET.length]).join('');
}

module.exports = async function handler(req, res) {
  try {
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;

    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT classes.id, classes.name, classes.join_code, classes.created_at,
                COUNT(students.id)::INTEGER AS student_count
           FROM education_classes classes
           LEFT JOIN student_profiles students ON students.class_id = classes.id
          WHERE classes.teacher_id = $1
          GROUP BY classes.id
          ORDER BY classes.created_at DESC`,
        [teacher.id]
      );
      return res.status(200).json({ classes: rows });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!hasValidOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
    const name = cleanText(req.body?.name, 120);
    if (name.length < 2) return res.status(400).json({ error: 'Enter a class name.' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const classId = crypto.randomUUID();
        const joinCode = makeJoinCode();
        const { rows } = await pool.query(
          `INSERT INTO education_classes (id, teacher_id, name, join_code)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, join_code, created_at`,
          [classId, teacher.id, name, joinCode]
        );
        return res.status(201).json({ class: { ...rows[0], student_count: 0 } });
      } catch (error) {
        if (error.code !== '23505' || attempt === 2) throw error;
      }
    }
  } catch (error) {
    console.error('[education] Class request failed:', error.message);
    return res.status(500).json({ error: 'The class request could not be completed.' });
  }
};
