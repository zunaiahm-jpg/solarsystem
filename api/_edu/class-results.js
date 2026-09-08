const { pool } = require('../_db');
const { requireTeacher } = require('../_teacher-auth');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const teacher = await requireTeacher(req, res);
    if (!teacher) return;

    const classId = new URL(req.url || '/', 'http://localhost').searchParams.get('classId') || '';
    const ownedClass = await pool.query(
      'SELECT id, name FROM education_classes WHERE id = $1 AND teacher_id = $2',
      [classId, teacher.id]
    ).catch((error) => (error.code === '22P02' ? { rows: [] } : Promise.reject(error)));
    if (!ownedClass.rows[0]) return res.status(404).json({ error: 'Class not found.' });

    const { rows } = await pool.query(
      `SELECT students.id AS student_id, students.display_name,
              attempts.mission_id, attempts.score, attempts.max_score, attempts.created_at
         FROM student_profiles students
         LEFT JOIN mission_attempts attempts ON attempts.student_id = students.id
        WHERE students.class_id = $1
        ORDER BY students.display_name, attempts.created_at DESC`,
      [classId]
    );

    const byStudent = new Map();
    for (const row of rows) {
      if (!byStudent.has(row.student_id)) {
        byStudent.set(row.student_id, { id: row.student_id, displayName: row.display_name, attempts: [] });
      }
      // Cap the per-student history so one prolific student can't bloat the
      // class payload (rows arrive newest-first per student, matching the
      // mission-attempts GET endpoint's LIMIT 50 spirit).
      const student = byStudent.get(row.student_id);
      if (student.attempts.length < 10 && row.mission_id) {
        student.attempts.push({
          missionId: row.mission_id,
          score: row.score,
          maxScore: row.max_score,
          createdAt: row.created_at,
        });
      }
    }

    return res.status(200).json({ className: ownedClass.rows[0].name, students: Array.from(byStudent.values()) });
  } catch (error) {
    console.error('[education] Class results request failed:', error.message);
    return res.status(500).json({ error: 'Class results could not be loaded.' });
  }
};
