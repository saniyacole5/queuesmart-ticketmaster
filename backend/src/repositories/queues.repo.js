/** A4 MEMBER 3 — concurrent queue lifecycle and ordering.
 * Existing module contract: backend/src/modules/queues.js.
 * Query active rows WHERE status='waiting'; terminal rows remain stored.
 * Lock relevant rows / use withTransaction for atomic mutations.
 * The generated active_user_id unique index is the final duplicate-join guard.
 * NOTE: This module is intentionally not wired into app.js yet.
 */
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { queueEntryRow } from '../db/mappers.js';
export { pool, withTransaction, queueEntryRow };

export async function listActiveEntriesByService(serviceId, connection = pool) {
  // TODO Member 3: join queue_entries, queues, user_profiles and services.
  // ORDER BY priority tier first, then order_seq ASC, id ASC.
  void serviceId; void connection;
  throw new Error('A4_MEMBER_3_TODO: listActiveEntriesByService');
}
export async function joinQueue({ userId, serviceId }, connection = pool) {
  // TODO Member 3: lock service/queue, verify open, allocate unique order_seq.
  // INSERT waiting row + history + notifications in ONE transaction.
  // Handle unique active_user_id collision as 409 ALREADY_QUEUED.
  void userId; void serviceId; void connection;
  throw new Error('A4_MEMBER_3_TODO: joinQueue');
}
export async function finishEntry({ entryId, outcome, actingUserId, isAdmin }, connection = pool) {
  // TODO Member 3: ownership/role checks and atomic terminal status update.
  // Map outcomes: Served => served; Left Queue => left; Removed => removed.
  // Update history + emit terminal notification in same transaction.
  void entryId; void outcome; void actingUserId; void isAdmin; void connection;
  throw new Error('A4_MEMBER_3_TODO: finishEntry');
}
export async function adjustEntry({ entryId, priority, direction }, connection = pool) {
  // TODO Member 3: implement admin priority/move in serializable sequence.
  // Moving may swap order_seq only within same priority tier/service.
  void entryId; void priority; void direction; void connection;
  throw new Error('A4_MEMBER_3_TODO: adjustEntry');
}
