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
import { decorateEntries, ALMOST_READY_LIMIT } from '../modules/queueView.js';
import { fail } from '../shared/errors.js';
export { pool, withTransaction, queueEntryRow };

// A supplied connection already belongs to the caller's transaction.
// Otherwise, acquire a connection and manage the transaction here.
// Same convention as services.repo.js.
function runTransaction(source, operation) {
  if (typeof source.getConnection === 'function') {
    return withTransaction(operation, source);
  }
  return operation(source);
}

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
// --- Member 4 swap seam -----------------------------------------------------
// History and notification rows belong to Member 4's activity.repo.js, but
// they must be written inside this transaction: a queue change that committed
// without its history would be unrecoverable. These two helpers hold all of
// that SQL so Member 4 can replace their bodies with activity.repo.js calls
// without touching the queue logic around them.

export async function recordJoinActivity(
  connection,
  { entryId, userId, serviceId, serviceName, joinedAt },
) {
  await connection.execute(
    `INSERT INTO history (id, user_id, service_id, service_name, joined_at, outcome)
     VALUES (?, ?, ?, ?, ?, 'Waiting')`,
    [entryId, userId, serviceId, serviceName, joinedAt],
  );

  await emitNotification(connection, {
    userId,
    entryId,
    event: 'joined',
    message: `You joined ${serviceName}.`,
  });
}

// UNIQUE (entry_id, event) makes this idempotent: re-entering the threshold
// after a reorder cannot produce a second almost-ready for the same entry.
export async function emitNotification(connection, { userId, entryId, event, message }) {
  await connection.execute(
    `INSERT INTO notifications (user_id, entry_id, event, message, type)
     VALUES (?, ?, ?, ?, 'info')
     ON DUPLICATE KEY UPDATE id = id`,
    [userId, entryId, event, message],
  );
}

export async function emitAlmostReady(connection, ordered, serviceName) {
  for (const entry of ordered.slice(0, ALMOST_READY_LIMIT)) {
    await emitNotification(connection, {
      userId: entry.userId,
      entryId: entry.id,
      event: 'almost-ready',
      message: `You are close to being served in ${serviceName}.`,
    });
  }
}
// --- end Member 4 swap seam -------------------------------------------------

// Locks the service's queue row and returns it with the service metadata.
// Every mutation starts here, so lock order is always queues -> queue_entries
// and transactions cannot deadlock against each other.
async function lockQueueForService(connection, serviceId) {
  const [rows] = await connection.execute(
    `SELECT q.id AS queue_id, q.status, s.id AS service_id, s.name,
            s.expected_duration
     FROM queues q
     JOIN services s ON s.id = q.service_id
     WHERE q.service_id = ?
     FOR UPDATE`,
    [serviceId],
  );

  if (rows.length === 0) fail(404, 'SERVICE_NOT_FOUND', 'Service not found.');

  return rows[0];
}

export async function joinQueue({ userId, serviceId }, connection = pool) {
  return runTransaction(connection, async (transaction) => {
    const queue = await lockQueueForService(transaction, serviceId);

    if (queue.status === 'closed') {
      fail(409, 'QUEUE_CLOSED', 'This queue is closed.');
    }

    // Safe under the queue lock above: no other join to this service can be
    // between this read and the insert.
    const [[next]] = await transaction.execute(
      'SELECT COALESCE(MAX(order_seq), 0) + 1 AS order_seq FROM queue_entries WHERE queue_id = ?',
      [queue.queue_id],
    );

    let entryId;
    try {
      const [result] = await transaction.execute(
        'INSERT INTO queue_entries (queue_id, user_id, order_seq) VALUES (?, ?, ?)',
        [queue.queue_id, userId, next.order_seq],
      );
      entryId = Number(result.insertId);
    } catch (error) {
      // uq_queue_entries_active_user. The queue lock cannot catch a user
      // joining two different services at once -- this index can.
      if (error.code === 'ER_DUP_ENTRY') {
        fail(409, 'ALREADY_QUEUED', 'Leave your active queue first.');
      }
      throw error;
    }

    const [[stored]] = await transaction.execute(
      'SELECT joined_at FROM queue_entries WHERE id = ?',
      [entryId],
    );

    await recordJoinActivity(transaction, {
      entryId,
      userId,
      serviceId: queue.service_id,
      serviceName: queue.name,
      joinedAt: stored.joined_at,
    });

    const ordered = await listActiveEntriesByService(serviceId, transaction);
    await emitAlmostReady(transaction, ordered, queue.name);

    return ordered.find((entry) => entry.id === entryId);
  });
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
