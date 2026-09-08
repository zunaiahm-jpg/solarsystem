// Vercel's Hobby plan caps a deployment at 12 Serverless Functions, and this
// project has more than 12 distinct API routes. Every education/mission
// route handler lives, unchanged, under the underscore-prefixed api/_edu/
// folder (which Vercel excludes from automatic Function generation) and is
// dispatched from this single dynamic-path function via vercel.json rewrites
// (/api/<name> -> /api/education/<name>), so none of the original request
// URLs change. A path-based destination keeps each request's own query
// string (e.g. ?classId=...) intact. ?route=<name> is also accepted as a
// fallback for manual/debug calls.
const routes = {
  'teacher-register': require('../_edu/teacher-register'),
  'teacher-login': require('../_edu/teacher-login'),
  'teacher-session': require('../_edu/teacher-session'),
  'teacher-logout': require('../_edu/teacher-logout'),
  'education-classes': require('../_edu/education-classes'),
  'education-students': require('../_edu/education-students'),
  'join-class': require('../_edu/join-class'),
  'mission-attempts': require('../_edu/mission-attempts'),
  'class-results': require('../_edu/class-results'),
};

module.exports = async function handler(req, res) {
  let route = '';
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const match = pathname.match(/^\/api\/education\/([^/?#]+)/);
    if (match) route = decodeURIComponent(match[1]);
  } catch { /* fall back to the query parameter below */ }
  if (!route) {
    try { route = new URL(req.url || '/', 'http://localhost').searchParams.get('route') || ''; }
    catch { route = ''; }
  }
  const target = routes[route];
  if (!target) return res.status(404).json({ error: 'Not found' });
  return target(req, res);
};
