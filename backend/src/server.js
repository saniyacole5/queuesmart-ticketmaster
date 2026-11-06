import { createApp } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT || 3001);
const minutes = Number(process.env.SESSION_TTL_MINUTES || 60);
const authStorage = process.env.AUTH_STORAGE || 'memory';
const servicesStorage = process.env.SERVICES_STORAGE || 'memory';
const queueStorage = process.env.QUEUE_STORAGE || 'memory';
if (!Number.isInteger(port) || port < 1 || port > 65535 ||
    !Number.isFinite(minutes) || minutes <= 0 ||
    !['memory', 'mysql'].includes(authStorage) ||
    !['memory', 'mysql'].includes(servicesStorage) ||
    !['memory', 'mysql'].includes(queueStorage)
) {
  throw new Error(
    'Invalid PORT, SESSION_TTL_MINUTES, AUTH_STORAGE, SERVICES_STORAGE or QUEUE_STORAGE.',
  );
}

if (servicesStorage === 'mysql' && authStorage !== 'mysql') {
  throw new Error('SQL services require AUTH_STORAGE=mysql.');
}

if (queueStorage === 'mysql' && servicesStorage !== 'mysql') {
  throw new Error('SQL queues require SERVICES_STORAGE=mysql.');
}

try {
  // Fail fast if SQL auth is selected but database cannot be reached.
  if (authStorage === 'mysql' || servicesStorage === 'mysql' || queueStorage === 'mysql') {
    const [[row]] = await pool.query('SELECT DATABASE() AS database_name');
    if (row.database_name !== 'queuesmart_db') {
      throw new Error(`Expected queuesmart_db, got ${row.database_name}`);
    }
    console.log('[Database] MySQL connection verified: queuesmart_db');
  }
  const { app } = createApp({ ttl: minutes * 60000, authStorage, servicesStorage, queueStorage, });
  app.listen(port, '127.0.0.1', () => {
    console.log(`QueueSmart API: http://127.0.0.1:${port}/api/health`);
    console.log(`[Auth] ${authStorage === 'mysql' ? 'MySQL (persistent)' : 'in-memory'}`);
    console.log(`[Services] ${servicesStorage === 'mysql' ? 'MySQL (persistent)' : 'in-memory'}`);
    console.log(`[Queue] ${queueStorage === 'mysql' ? 'MySQL (persistent)' : 'in-memory'}`);
    console.log(queueStorage === 'mysql'
      ? '[Activity] Notifications and history disabled until Member 4 integration'
      : servicesStorage === 'mysql'
        ? '[Queue/activity] Disabled during service-only SQL testing'
        : '[Queue/activity] In-memory until team integration');
  });
} catch (error) {
  console.error('[Startup] Failed:', error.code || error.name, error.message);
  await pool.end();
  process.exitCode = 1;
}
