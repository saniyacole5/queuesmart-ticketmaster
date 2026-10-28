/** A4 MEMBER 2 — SQL services plus their queue metadata.
 * Existing module contract: backend/src/modules/services.js.
 * API field is expectedDuration but SQL column is expected_duration.
 * Use a transaction to create/update services and queues consistently.
 * NOTE: These exports are intentionally not wired into app.js yet.
 */
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { serviceRow } from '../db/mappers.js';
export { pool, withTransaction, serviceRow };

export async function listServices(connection = pool) {
  // TODO Member 2: SELECT from services, return serviceRow objects.
  void connection;
  throw new Error('A4_MEMBER_2_TODO: listServices');
}
export async function createService(fields, connection = pool) {
  // TODO Member 2: create services row AND one queues row transactionally.
  // API validation stays in modules/services.js. Name conflict -> 409.
  void fields; void connection;
  throw new Error('A4_MEMBER_2_TODO: createService');
}
export async function updateService(id, patch, connection = pool) {
  // TODO Member 2: patch validated fields and queue open/closed status.
  // Preserve isOpen and queue status consistency under transaction.
  void id; void patch; void connection;
  throw new Error('A4_MEMBER_2_TODO: updateService');
}
export async function getServiceById(id, connection = pool) {
  // TODO Member 2: service 404 when not present.
  void id; void connection;
  throw new Error('A4_MEMBER_2_TODO: getServiceById');
}
