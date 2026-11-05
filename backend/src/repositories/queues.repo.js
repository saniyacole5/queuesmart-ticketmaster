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
import { decorateEntries } from '../modules/queueView.js';
export { pool, withTransaction, queueEntryRow };

// The one ordering rule every read shares. `priority` is ENUM('standard',
// 'priority') and MySQL orders enums by declaration index, so DESC puts the
// priority tier first. Covered by idx_entries_queue_order.
const ACTIVE_ENTRY_SELECT = `
  SELECT e.id, e.user_id, q.service_id, p.name, e.joined_at, e.priority,
         e.order_seq, s.name AS service_name, s.expected_duration
  FROM queue_entries e
  JOIN queues q ON q.id = e.queue_id
  JOIN services s ON s.id = q.service_id
  JOIN user_profiles p ON p.user_id = e.user_id
  WHERE q.service_id = ? AND e.status = 'waiting'
  ORDER BY e.priority DESC, e.order_seq ASC, e.id ASC
`;

// Service name and duration ride along on every row, so an empty queue needs
// no second query -- it simply has nothing to decorate.
function mapOrdered(rows) {
  if (rows.length === 0) return [];

  return decorateEntries(rows.map(queueEntryRow), {
    name: rows[0].service_name,
    expectedDuration: Number(rows[0].expected_duration),
  });
}

export async function listActiveEntriesByService(serviceId, connection = pool) {
  const [rows] = await connection.execute(ACTIVE_ENTRY_SELECT, [serviceId]);

  return mapOrdered(rows);
}

// A user holds at most one active entry (uq_queue_entries_active_user), but
// position only means something within its service -- so resolve the service
// first, then take this user's decorated row from that ordered queue.
export async function findActiveEntryForUser(userId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT q.service_id
     FROM queue_entries e
     JOIN queues q ON q.id = e.queue_id
     WHERE e.user_id = ? AND e.status = 'waiting'`,
    [userId],
  );

  if (rows.length === 0) return null;

  const ordered = await listActiveEntriesByService(rows[0].service_id, connection);

  return ordered.find((entry) => entry.userId === Number(userId)) ?? null;
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
