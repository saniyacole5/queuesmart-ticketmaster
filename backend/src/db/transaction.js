import { pool } from './pool.js';

// Reuse the SAME connection for every SQL statement in a transaction.
// Await the callback; commit only after all operations succeed.
export async function withTransaction(operation, connectionPool = pool) {
  const connection = await connectionPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    throw error;
  } finally {
    connection.release();
  }
}
