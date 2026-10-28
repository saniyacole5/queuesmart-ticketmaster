// Small, pure conversions from MySQL's snake_case columns into A3 API shapes.
// Do not send password_salt, password_digest or token_hash to the frontend.
const iso = (date) => date == null ? null : new Date(date).toISOString();

export function publicUserRow(row) {
  if (!row) return null;
  return { id: Number(row.id), name: row.name, email: row.email, role: row.role };
}
export function serviceRow(row) {
  if (!row) return null;
  return { id: Number(row.id), name: row.name, description: row.description,
    expectedDuration: Number(row.expected_duration), priority: row.priority,
    isOpen: Boolean(row.is_open) };
}
export function queueEntryRow(row) {
  if (!row) return null;
  return { id: Number(row.id), userId: Number(row.user_id),
    serviceId: Number(row.service_id), name: row.name,
    joinedAt: iso(row.joined_at), priority: row.priority, order: Number(row.order_seq) };
}
export function historyRow(row) {
  if (!row) return null;
  return { id: Number(row.id), userId: Number(row.user_id),
    serviceId: Number(row.service_id), serviceName: row.service_name,
    joinedAt: iso(row.joined_at), date: iso(row.joined_at),
    endedAt: iso(row.ended_at), outcome: row.outcome };
}
export function notificationRow(row) {
  if (!row) return null;
  return { id: Number(row.id), userId: Number(row.user_id),
    entryId: Number(row.entry_id), event: row.event, message: row.message,
    type: row.type, read: Boolean(row.is_read), createdAt: iso(row.created_at) };
}
