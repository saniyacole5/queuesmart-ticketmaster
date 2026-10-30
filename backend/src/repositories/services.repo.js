/** A4 MEMBER 2 — SQL services plus their queue metadata.
 * Existing module contract: backend/src/modules/services.js.
 * API field is expectedDuration but SQL column is expected_duration.
 * Use a transaction to create/update services and queues consistently.
 * NOTE: These exports are intentionally not wired into app.js yet.
 */
// MEMBER 2: MySQL services and their linked queue metadata.
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { serviceRow } from '../db/mappers.js';
import { fail } from "../shared/errors.js";

export { pool, withTransaction, serviceRow };

// Count only active participants. Completed entries stay in the database.
const serviceSelect = `
  SELECT s.*,
    (
      SELECT COUNT(*)
      FROM queues q
      JOIN queue_entries e ON e.queue_id = q.id
      WHERE q.service_id = s.id
        AND e.status = 'waiting'
    ) AS queue_length
  FROM services s
`;

function mapService(row) {
  return {
    ...serviceRow(row),
    queueLength: Number(row.queue_length ?? 0),
  };
}

// A supplies connection must already belong to the caller's transaction.
// Otherwise, acquire a connection and manage the transaction here.
function runTransaction(source, operation) {
  if (typeof source.getConnection === "function") {
    return withTransaction(operation, source);
  }
  return operation(source);
}

// Apply this only to writes to the services table.
async function writeService(connection, sql, values) {
  try {
    return await connection.execute(sql, values);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      fail(
        409,
        "SERVICE_NAME_CONFLICT",
        "A service with this name already exists.",
      );
    }

    throw error;
  }
}

export async function listServices(connection = pool) {
  const [rows] = await connection.execute(
    `${serviceSelect} ORDER BY s.id`,
  );

  return rows.map(mapService);
}

export async function createService(fields, connection = pool) {
  return runTransaction(connection, async (transaction) => {
    const isOpen = fields.isOpen ?? true;

    const [result] = await writeService(
      transaction,
      'INSERT INTO services (name, description, expected_duration, priority, is_open) VALUES (?, ?, ?, ?, ?)',
      [
        fields.name.trim(), 
        fields.description, 
        fields.expectedDuration, 
        fields.priority, isOpen
      ],
    );

    const serviceId = result.insertId;

    await transaction.execute(
      'INSERT INTO queues (service_id, status) VALUES (?, ?)',
      [serviceId, isOpen ? 'open' : 'closed']
    );

    return getServiceById(serviceId, transaction);
  });
}

// Column names come only from this fixed mapping, never from user input.
const columns = {
  name: "name",
  description: "description",
  expectedDuration: "expected_duration",
  priority: "priority",
  isOpen: "is_open",
};

export async function updateService(id, patch, connection = pool) {
  const keys = Object.keys(patch);

  if (
    keys.length === 0 ||
    keys.some((key) => !Object.hasOwn(columns, key))
  ) {
    fail(400, "VALIDATION_ERROR", "Provide valid service fields.");
  }
  return runTransaction(connection, async (transaction) => {
    const [services] = await transaction.execute(
      "SELECT id FROM services WHERE id = ? FOR UPDATE",
      [id],
    );
    if(!services.length) {
      fail(404, "SERVICE_NOT_FOUND", "Service not found.");
    }
    const assignments = keys
      .map((key) => `${columns[key]} = ?`)
      .join(", ");
    
    const values = keys.map((key) =>
      key === "name" ? patch[key].trim() : patch[key],
    );

    await writeService(
      transaction,
      `UPDATE services SET ${assignments} WHERE id = ?`,
      [...values, id]
    );

    if (Object.hasOwn(patch, "isOpen")) {
      const [queues] = await transaction.execute(
        "SELECT id FROM queues WHERE service_id = ? FOR UPDATE",
        [id],
      );

      if (queues.length !== 1) {
        throw new Error("service is missing its linked queue.");
      }

      await transaction.execute(
        "UPDATE queues SET status = ? WHERE service_id =?",
        [patch.isOpen ? "open" : "closed", id],
      );
    }

    return getServiceById(id, transaction);
  });
}
export async function getServiceById(id, connection = pool) {
  const [rows] = await connection.execute(
    `${serviceSelect} WHERE s.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    fail(404, "SERVICE_NOT_FOUND", "Service not found.");
  }
  return mapService(rows[0]);
}
