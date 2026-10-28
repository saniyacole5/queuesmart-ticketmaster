import { pool } from '../src/db/pool.js';

const EXPECTED_TABLES = ['user_credentials', 'user_profiles', 'auth_sessions',
  'services', 'queues', 'queue_entries', 'history', 'notifications'];
try {
  const [[info]] = await pool.query(
    'SELECT DATABASE() AS database_name, CURRENT_USER() AS account, VERSION() AS version',
  );
  if (info.database_name !== 'queuesmart_db') {
    throw new Error(`Connected to ${info.database_name ?? '(none)'}, expected queuesmart_db`);
  }
  const [rows] = await pool.query(
    'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
  );
  const actual = new Set(rows.map((row) => row.name));
  const missing = EXPECTED_TABLES.filter((name) => !actual.has(name));
  console.log({ database: info.database_name, mysqlAccount: info.account,
    mysqlVersion: info.version, tableCount: rows.length, missingTables: missing });
  if (missing.length) {
    console.log('Create tables using backend/sql/001_schema.sql before the A4 demo.');
  } else {
    console.log('Database reachable and all A4 scaffold tables are present.');
  }
} catch (error) {
  console.error('Database check failed:', error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
