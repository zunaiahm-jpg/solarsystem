const { pool } = require('./_db');
const { isAdmin } = require('./_admin-auth');

function csvCell(value) {
  const safe = String(value ?? '').replace(/"/g, '""');
  return `"${safe}"`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  const search = String(req.query.search || '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 25;
  const values = search ? [`%${search}%`, limit, (page - 1) * limit] : [limit, (page - 1) * limit];
  const where = search ? 'WHERE name ILIKE $1 OR email ILIKE $1 OR country ILIKE $1 OR thoughts ILIKE $1' : '';
  const limitIndex = search ? 2 : 1;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, country, thoughts, created_at FROM visitor_responses ${where} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      values
    );
    if (req.query.format === 'csv') {
      const header = ['ID', 'Name', 'Email', 'Country', 'Thoughts', 'Created at'];
      const csv = [header, ...rows.map(row => [row.id, row.name, row.email, row.country, row.thoughts, row.created_at])]
        .map(line => line.map(csvCell).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="space-responses.csv"');
      return res.status(200).send(csv);
    }
    return res.status(200).json({ rows, page, hasMore: rows.length === limit });
  } catch (error) {
    return res.status(500).json({ error: 'Responses could not be loaded.' });
  }
};
