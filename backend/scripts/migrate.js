import { pool } from '../src/db/pool.js';
import { statementsFromFile } from './sql-runner.js';
const statements = statementsFromFile(new URL('../sql/001_schema.sql', import.meta.url));
try {
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(`Executed ${statements.length} schema statements in queuesmart_db.`);
  console.log('Reminder: CREATE TABLE IF NOT EXISTS is for fresh setup, not schema upgrades.');
} catch (error) {
  console.error('Schema creation failed:', error.code || error.name, error.message);
  console.error('You may need a schema-administrator account for CREATE privileges.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
