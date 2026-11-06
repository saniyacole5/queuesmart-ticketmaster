import { createApp } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT || 3001);
const minutes = Number(process.env.SESSION_TTL_MINUTES || 60);

const authStorage = process.env.AUTH_STORAGE || 'memory';
const servicesStorage = process.env.SERVICES_STORAGE || 'memory';
const activityStorage = process.env.ACTIVITY_STORAGE || 'memory';

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isFinite(minutes) ||
  minutes <= 0 ||
  !['memory', 'mysql'].includes(authStorage) ||
  !['memory', 'mysql'].includes(servicesStorage) ||
  !['memory', 'mysql'].includes(activityStorage)
) {
  throw new Error(
    'Invalid PORT, SESSION_TTL_MINUTES, AUTH_STORAGE, SERVICES_STORAGE or ACTIVITY_STORAGE.',
  );
}

if (servicesStorage === 'mysql' && authStorage !== 'mysql') {
  throw new Error('SQL services require AUTH_STORAGE=mysql.');
}

try {
  // Verify the database connection before starting SQL-backed features.
  if (authStorage === 'mysql' || servicesStorage === 'mysql') {
    const [[row]] = await pool.query(
      'SELECT DATABASE() AS database_name',
    );

    if (row.database_name !== 'queuesmart_db') {
      throw new Error(
        `Expected queuesmart_db, got ${row.database_name}`,
      );
    }

    console.log(
      '[Database] MySQL connection verified: queuesmart_db',
    );
  }

  const { app } = createApp({
    ttl: minutes * 60000,
    authStorage,
    servicesStorage,
    activityStorage,
  });

  app.listen(port, '127.0.0.1', () => {
    console.log(
      `QueueSmart API: http://127.0.0.1:${port}/api/health`,
    );

    console.log(
      `[Auth] ${
        authStorage === 'mysql'
          ? 'MySQL (persistent)'
          : 'in-memory'
      }`,
    );

    console.log(
      `[Services] ${
        servicesStorage === 'mysql'
          ? 'MySQL (persistent)'
          : 'in-memory'
      }`,
    );

    console.log(
      `[Activity] ${
        activityStorage === 'mysql'
          ? 'MySQL (persistent)'
          : 'in-memory'
      }`,
    );

    console.log(
      servicesStorage === 'mysql'
        ? '[Queue] Disabled pending Member 3 SQL integration'
        : '[Queue] In-memory',
    );
  });
} catch (error) {
  console.error(
    '[Startup] Failed:',
    error.code || error.name,
    error.message,
  );

  await pool.end();
  process.exitCode = 1;
}