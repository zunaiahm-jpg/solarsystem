const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanText,
  hasValidOrigin,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} = require('../api/_teacher-auth');
const fs = require('node:fs');
const path = require('node:path');
const { rateLimitKey } = require('../api/_rate-limit');

test('passwords are salted and verified without storing plaintext', async () => {
  const first = await hashPassword('a-long-test-password');
  const second = await hashPassword('a-long-test-password');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('a-long-test-password', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
});

test('teacher fields are normalized and bounded', () => {
  assert.equal(normalizeEmail('  TEACHER@Example.COM  '), 'teacher@example.com');
  assert.equal(isValidEmail('teacher@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(cleanText('<School>', 160), 'School');
});

test('mutating requests accept only the current origin when supplied', () => {
  assert.equal(hasValidOrigin({ headers: { host: 'localhost:3000', origin: 'http://localhost:3000' } }), true);
  assert.equal(hasValidOrigin({ headers: { host: 'solarisvr.com', origin: 'https://attacker.example' } }), false);
  assert.equal(hasValidOrigin({ headers: { host: 'solarisvr.com' } }), true);
});

test('rate-limit keys do not store raw client addresses', () => {
  const req = { headers: { 'x-forwarded-for': '192.0.2.10' } };
  const key = rateLimitKey(req, 'test-login');
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key.includes('192.0.2.10'), false);
  assert.notEqual(key, rateLimitKey(req, 'test-register'));
});

test('per-account login keys differ so one shared address can serve many teachers', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.5' } };
  const first = rateLimitKey(req, 'teacher-login-account', 'teacher-one@example.invalid');
  const second = rateLimitKey(req, 'teacher-login-account', 'teacher-two@example.invalid');
  const addressOnly = rateLimitKey(req, 'teacher-login-address');
  assert.notEqual(first, second);
  assert.notEqual(first, addressOnly);
});

test('teacher-login.js never resets the attempt budget on success', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', '_edu', 'teacher-login.js'), 'utf8');
  assert.equal(/clearRateLimit/.test(source), false);
});

test('teacher-login.js stops after the address ceiling before checking the account limiter', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', '_edu', 'teacher-login.js'), 'utf8');
  const addressIndex = source.indexOf("'teacher-login-address'");
  const addressReturnIndex = source.indexOf('return res.status(429)', addressIndex);
  const accountIndex = source.indexOf("'teacher-login-account'");
  assert.ok(addressIndex > -1 && accountIndex > -1, 'expected both limiter calls to be present');
  assert.ok(addressReturnIndex > -1 && addressReturnIndex < accountIndex, 'expected the address limiter to short-circuit before the account limiter runs');
});
