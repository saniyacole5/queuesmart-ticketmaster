import { createApp } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT || 3001);
const minutes = Number(process.env.SESSION_TTL_MINUTES || 60);
const authStorage = process.env.AUTH_STORAGE || 'memory';
if (!Number.isInteger(port) || port < 1 || port > 65535 ||
    !Number.isFinite(minutes) || minutes <= 0 ||
    !['memory', 'mysql'].includes(authStorage)) {
  throw new Error('Invalid PORT, SESSION_TTL_MINUTES or AUTH_STORAGE.');
}

try {
  // Fail fast if SQL auth is selected but database cannot be reached.
  if (authStorage === 'mysql') {
    const [[row]] = await pool.query('SELECT DATABASE() AS database_name');
    if (row.database_name !== 'queuesmart_db') {
      throw new Error(`Expected queuesmart_db, got ${row.database_name}`);
    }
    console.log('[Auth] MySQL connection verified: queuesmart_db');
  }
  const { app } = createApp({ ttl: minutes * 60000, authStorage });
  app.listen(port, '127.0.0.1', () => {
    console.log(`QueueSmart API: http://127.0.0.1:${port}/api/health`);
    console.log(`[Auth] ${authStorage === 'mysql' ? 'MySQL (persistent)' : 'in-memory'}`);
    console.log('[Other modules] in-memory until team integration');
  });
} catch (error) {
  console.error('[Startup] Failed:', error.code || error.name, error.message);
  await pool.end();
  process.exitCode = 1;
}
