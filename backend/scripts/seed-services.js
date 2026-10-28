import { pool } from '../src/db/pool.js';
import { statementsFromFile } from './sql-runner.js';
if (process.env.DB_NAME !== 'queuesmart_db') {
  console.error('Refusing to seed a database other than queuesmart_db.');
  process.exit(1);
}
const statements = statementsFromFile(new URL('../sql/002_demo_services.sql', import.meta.url));
try {
  for (const statement of statements) await pool.query(statement);
  console.log('Optional demo services inserted (existing names left unchanged).');
} catch (error) {
  console.error('Demo seed failed:', error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
