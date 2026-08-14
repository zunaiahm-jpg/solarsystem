const crypto = require('crypto');

const COOKIE_NAME = 'space_admin';
const MAX_AGE = 60 * 60 * 8;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signature(expires) {
  return crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '')
    .update(`space-admin:${expires}`)
    .digest('base64url');
}

function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${expires}.${signature(expires)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure}`;
}

function isAdmin(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const [expires, supplied] = String(cookies[COOKIE_NAME] || '').split('.');
  if (!expires || !supplied || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(supplied, signature(expires));
}

module.exports = { createSessionCookie, isAdmin, safeEqual };
