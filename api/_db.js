const { Pool } = require('pg');

const globalForDb = globalThis;
const pool = globalForDb.__spaceResponsePool || new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.__spaceResponsePool = pool;

module.exports = { pool };
