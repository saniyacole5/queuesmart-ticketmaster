/** Explicit one-time administrator creation; run from backend/ with its .env.
 * Set temporary BOOTSTRAP_ADMIN_* variables in your private .env and remove
 * them immediately after running. Never put these secrets in GitHub.
 */
import { pool } from '../src/db/pool.js';
import { withTransaction } from '../src/db/transaction.js';
import { hashPassword } from '../src/modules/authSql.js';
import { createUserWithProfile } from '../src/repositories/users.repo.js';
import * as v from '../src/shared/validation.js';

try {
  const email = v.email({ email: process.env.BOOTSTRAP_ADMIN_EMAIL });
  const name = v.text({ name: process.env.BOOTSTRAP_ADMIN_NAME }, 'name', 1, 100);
  const password = v.text(
    { password: process.env.BOOTSTRAP_ADMIN_PASSWORD }, 'password', 8, 128, false,
  );
  const { salt, digest } = await hashPassword(password);
  const result = await withTransaction(async (connection) => {
    // This one-time script is intended to run by a single team coordinator.
    // Do not run concurrent bootstrap processes.
    const [admins] = await connection.execute(
      "SELECT id FROM user_credentials WHERE role = 'admin' LIMIT 1 FOR UPDATE",
    );
    if (admins.length) throw new Error('An administrator already exists. No changes made.');
    return createUserWithProfile({ name, email, salt, digest, role: 'admin' }, connection);
  });
  console.log(`Created initial administrator: ${result.email} (ID ${result.id}).`);
} catch (error) {
  console.error('Admin bootstrap failed:', error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
