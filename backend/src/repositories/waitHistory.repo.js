// Member work area - Required smart feature.
import { pool } from '../db/pool.js';
import { historyRow } from '../db/mappers.js';

// At most 20 consecutive intervals from 21 recent served records.
// Pass the existing queue transaction connection when reading during a mutation.
export async function listRecentServed(serviceId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT *
     FROM history
     WHERE service_id = ? AND outcome = 'Served' AND ended_at IS NOT NULL
     ORDER BY ended_at DESC, id DESC
     LIMIT 21`,
    [serviceId],
  );

  return rows.map(historyRow);
}
