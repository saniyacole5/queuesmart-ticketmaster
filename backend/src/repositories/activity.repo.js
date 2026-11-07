// MEMBER 4: durable participation history and notification events.
// Queue mutations must pass their transaction connection to every write here.
import { pool } from '../db/pool.js';
import { historyRow, notificationRow } from '../db/mappers.js';
import { fail } from '../shared/errors.js';
import { choice, integer, text } from '../shared/validation.js';

const FINAL_OUTCOMES = ['Served', 'Left Queue', 'Removed'];
const EVENTS = ['joined', 'almost-ready', ...FINAL_OUTCOMES];

const positiveId = (value, key) =>
  integer({ [key]: value }, key, 1, Number.MAX_SAFE_INTEGER);

function timestamp(value, key) {
  if (
    !(typeof value === 'string' || value instanceof Date) ||
    !Number.isFinite(new Date(value).getTime())
  ) {
    fail(400, 'VALIDATION_ERROR', 'Invalid timestamp.', {
      [key]: 'Use a valid date/time.',
    });
  }

  return new Date(value);
}

export async function createHistoryForJoin(
  { entryId, userId, serviceId, serviceName, joinedAt },
  connection = pool,
) {
  positiveId(entryId, 'entryId');
  positiveId(userId, 'userId');
  positiveId(serviceId, 'serviceId');

  const name = text({ serviceName }, 'serviceName', 1, 100);
  const joined = timestamp(joinedAt, 'joinedAt');

  try {
    // Confirm the entry belongs to this user and service.
    const [result] = await connection.execute(
      `INSERT INTO history
         (id, user_id, service_id, service_name, joined_at)
       SELECT e.id, e.user_id, q.service_id, ?, ?
       FROM queue_entries e
       JOIN queues q ON q.id = e.queue_id
       WHERE e.id = ?
         AND e.user_id = ?
         AND q.service_id = ?
         AND e.status = 'waiting'`,
      [name, joined, entryId, userId, serviceId],
    );

    if (!result.affectedRows) {
      fail(
        404,
        'ENTRY_NOT_FOUND',
        'Matching active queue entry not found.',
      );
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      fail(
        409,
        'HISTORY_EXISTS',
        'History already exists for this queue participation.',
      );
    }

    throw error;
  }

  const [rows] = await connection.execute(
    'SELECT * FROM history WHERE id = ?',
    [entryId],
  );

  return historyRow(rows[0]);
}

export async function completeHistory(
  { entryId, outcome, endedAt },
  connection = pool,
) {
  positiveId(entryId, 'entryId');
  choice({ outcome }, 'outcome', FINAL_OUTCOMES);

  const ended = timestamp(endedAt, 'endedAt');

  // Only an unfinished record can receive a final outcome.
  await connection.execute(
    `UPDATE history
     SET outcome = ?, ended_at = ?
     WHERE id = ?
       AND outcome = 'Waiting'
       AND joined_at <= ?`,
    [outcome, ended, entryId, ended],
  );

  // Read the current result when competing transactions finish an entry.
  const [rows] = await connection.execute(
    'SELECT * FROM history WHERE id = ? FOR UPDATE',
    [entryId],
  );

  if (!rows.length) {
    fail(
      404,
      'HISTORY_NOT_FOUND',
      'Queue participation history not found.',
    );
  }

  const record = historyRow(rows[0]);

  if (record.outcome === 'Waiting') {
    fail(
      400,
      'VALIDATION_ERROR',
      'Completion cannot precede joining.',
      { endedAt: 'Must be on or after joinedAt.' },
    );
  }

  if (record.outcome !== outcome) {
    fail(
      409,
      'HISTORY_ALREADY_FINISHED',
      'This queue participation already has a final outcome.',
    );
  }

  // Repeating the same outcome preserves the original completion time.
  return record;
}

export async function listHistoryForUser(
  userId,
  connection = pool,
) {
  positiveId(userId, 'userId');

  const [rows] = await connection.execute(
    `SELECT *
     FROM history
     WHERE user_id = ?
     ORDER BY joined_at DESC, id DESC`,
    [userId],
  );

  return rows.map(historyRow);
}

export async function emitNotification(
  { userId, entryId, event, message },
  connection = pool,
) {
  positiveId(userId, 'userId');
  positiveId(entryId, 'entryId');
  choice({ event }, 'event', EVENTS);

  const content = text({ message }, 'message', 1, 500);

  // The unique (entry_id, event) index prevents duplicate notifications.
  // A retry preserves the original message, timestamp, and read status.
  await connection.execute(
    `INSERT INTO notifications
       (user_id, entry_id, event, message, created_at)
     SELECT e.user_id, e.id, ?, ?, UTC_TIMESTAMP(3)
     FROM queue_entries e
     WHERE e.id = ? AND e.user_id = ?
     ON DUPLICATE KEY UPDATE id = notifications.id`,
    [event, content, entryId, userId],
  );

  const [rows] = await connection.execute(
    `SELECT *
     FROM notifications
     WHERE entry_id = ? AND event = ? AND user_id = ?`,
    [entryId, event, userId],
  );

  if (!rows.length) {
    fail(
      404,
      'ENTRY_NOT_FOUND',
      'Matching queue participation not found.',
    );
  }

  return notificationRow(rows[0]);
}

export async function listNotificationsForUser(
  userId,
  connection = pool,
) {
  positiveId(userId, 'userId');

  const [rows] = await connection.execute(
    `SELECT *
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );

  return rows.map(notificationRow);
}

export async function markNotificationRead(
  { id, userId },
  connection = pool,
) {
  positiveId(id, 'id');
  positiveId(userId, 'userId');

  await connection.execute(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  const [rows] = await connection.execute(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
    [id, userId],
  );

  if (!rows.length) {
    fail(
      404,
      'NOTIFICATION_NOT_FOUND',
      'Notification not found.',
    );
  }

  return notificationRow(rows[0]);
}