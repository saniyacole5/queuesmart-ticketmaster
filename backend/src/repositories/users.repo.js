/** A4 MEMBER 1 — complete persistence for auth, profile and sessions.
 * Existing module contract: backend/src/modules/auth.js and docs/API.md.
 * Use the caller's transaction connection for multi-table writes.
 * Passwords remain asynchronously scrypt-derived in auth.js.
 * Store only SHA-256 hashes of random session bearer tokens in auth_sessions.
 * NOTE: This module is intentionally NOT wired into app.js yet.
 */
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { publicUserRow } from '../db/mappers.js';

export { pool, withTransaction, publicUserRow };

export async function findUserByEmail(email, connection = pool) {
  // TODO Member 1: SELECT credentials joined to user_profiles by canonical email.
  // Return stored salted digest/salt internally; never expose either in API.
  void email; void connection;
  throw new Error('A4_MEMBER_1_TODO: findUserByEmail');
}
export async function createUserWithProfile({ name, email, salt, digest, role = 'user' }, connection = pool) {
  // TODO Member 1: INSERT credentials + profile in ONE transaction.
  // MySQL UNIQUE(email) resolves concurrent duplicate registrations.
  // Map ER_DUP_ENTRY to existing HTTP 409 EMAIL_EXISTS.
  void name; void email; void salt; void digest; void role; void connection;
  throw new Error('A4_MEMBER_1_TODO: createUserWithProfile');
}
export async function getUserById(id, connection = pool) {
  // TODO Member 1: lookup user/profile after validating persisted session.
  void id; void connection;
  throw new Error('A4_MEMBER_1_TODO: getUserById');
}
export async function saveSession({ tokenHash, userId, expiresAt }, connection = pool) {
  // TODO Member 1: INSERT token_hash and expiry; do not store raw token.
  void tokenHash; void userId; void expiresAt; void connection;
  throw new Error('A4_MEMBER_1_TODO: saveSession');
}
export async function findSession(tokenHash, connection = pool) {
  // TODO Member 1: lookup session, enforce expiry; keep role from DB.
  void tokenHash; void connection;
  throw new Error('A4_MEMBER_1_TODO: findSession');
}
export async function deleteSession(tokenHash, connection = pool) {
  // TODO Member 1: DELETE the current authenticated token hash.
  void tokenHash; void connection;
  throw new Error('A4_MEMBER_1_TODO: deleteSession');
}
