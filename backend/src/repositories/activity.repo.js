/** A4 MEMBER 4 — notification and history persistence.
 * Existing contracts: modules/notifications.js, modules/history.js,
 * docs/API.md. Coordinate inserts with Member 3's transaction helper.
 * UNIQUE(entry_id,event) prevents duplicate almost-ready notifications.
 * NOTE: This module is intentionally not wired into app.js yet.
 */
import { pool } from '../db/pool.js';
import { historyRow, notificationRow } from '../db/mappers.js';
export { pool, historyRow, notificationRow };

export async function createHistoryForJoin({ entryId, userId, serviceId, serviceName, joinedAt }, connection = pool) {
  // TODO Member 4: one history row per participation, outcome 'Waiting'.
  void entryId; void userId; void serviceId; void serviceName; void joinedAt; void connection;
  throw new Error('A4_MEMBER_4_TODO: createHistoryForJoin');
}
export async function completeHistory({ entryId, outcome, endedAt }, connection = pool) {
  // TODO Member 4: reject/handle already-terminal transitions consistently.
  void entryId; void outcome; void endedAt; void connection;
  throw new Error('A4_MEMBER_4_TODO: completeHistory');
}
export async function listHistoryForUser(userId, connection = pool) {
  // TODO Member 4: WHERE user_id = authenticated user; never trust request userId.
  void userId; void connection;
  throw new Error('A4_MEMBER_4_TODO: listHistoryForUser');
}
export async function emitNotification({ userId, entryId, event, message }, connection = pool) {
  // TODO Member 4: INSERT once on (entry_id,event), return existing if duplicate.
  void userId; void entryId; void event; void message; void connection;
  throw new Error('A4_MEMBER_4_TODO: emitNotification');
}
export async function listNotificationsForUser(userId, connection = pool) {
  // TODO Member 4: WHERE user_id = authenticated user, newest first.
  void userId; void connection;
  throw new Error('A4_MEMBER_4_TODO: listNotificationsForUser');
}
export async function markNotificationRead({ id, userId }, connection = pool) {
  // TODO Member 4: ownership-filtered UPDATE/SELECT, 404 for non-owned IDs.
  void id; void userId; void connection;
  throw new Error('A4_MEMBER_4_TODO: markNotificationRead');
}
