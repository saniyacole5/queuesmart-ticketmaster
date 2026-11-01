/** Member 1: persistent credentials, profiles, and hashed sessions. */
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { publicUserRow } from '../db/mappers.js';
import { fail } from '../shared/errors.js';

// The caller may pass an existing transaction connection. We must not commit it.
function inTransaction(source, operation) {
  return typeof source.getConnection === 'function'
    ? withTransaction(operation, source)
    : operation(source);
}

// Return private credentials only to trusted backend code; never serialize this
// result directly to an HTTP response.
const privateUserSql = `
  SELECT c.id, c.email, c.role, c.password_salt AS salt,
         c.password_digest AS digest, p.name
  FROM user_credentials c
  JOIN user_profiles p ON p.user_id = c.id
`;

export async function findUserByEmail(email, connection = pool) {
  const [rows] = await connection.execute(
    `${privateUserSql} WHERE c.email = ? LIMIT 1`, [email],
  );
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

export async function createUserWithProfile(
  { name, email, salt, digest, role = 'user' }, connection = pool,
) {
  if (!['user', 'admin'].includes(role)) throw new TypeError('Invalid server-assigned role.');
  const canonicalEmail = email.trim().toLowerCase();
  return inTransaction(connection, async (tx) => {
    let inserted;
    try {
      [inserted] = await tx.execute(
        'INSERT INTO user_credentials (email, password_salt, password_digest, role) VALUES (?, ?, ?, ?)',
        [canonicalEmail, salt, digest, role],
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        fail(409, 'EMAIL_EXISTS', 'Email is already registered.');
      }
      throw error;
    }
    const userId = Number(inserted.insertId);
    await tx.execute(
      'INSERT INTO user_profiles (user_id, name) VALUES (?, ?)',
      [userId, name],
    );
    return publicUserRow({ id: userId, name, email: canonicalEmail, role });
  });
}

export async function getUserById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT c.id, c.email, c.role, p.name
     FROM user_credentials c
     JOIN user_profiles p ON p.user_id = c.id
     WHERE c.id = ? LIMIT 1`, [id],
  );
  return publicUserRow(rows[0]);
}

// Always convert UTC instants into an unambiguous MySQL UTC DATETIME(3).
// The pool config uses timezone 'Z' so these values are read as UTC too.
function mysqlUtc(instant) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid session expiration time.');
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

export async function saveSession({ tokenHash, userId, expiresAt }, connection = pool) {
  await connection.execute(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, userId, mysqlUtc(expiresAt)],
  );
}

export async function findSession(tokenHash, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT s.user_id, s.expires_at, c.email, c.role, p.name
     FROM auth_sessions s
     JOIN user_credentials c ON c.id = s.user_id
     JOIN user_profiles p ON p.user_id = c.id
     WHERE s.token_hash = ? LIMIT 1`, [tokenHash],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    userId: Number(row.user_id),
    expiresAt: new Date(row.expires_at).getTime(),
    user: publicUserRow({ id: row.user_id, name: row.name, email: row.email, role: row.role }),
  };
}

export async function deleteSession(tokenHash, connection = pool) {
  const [result] = await connection.execute(
    'DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash],
  );
  return result.affectedRows > 0;
}
