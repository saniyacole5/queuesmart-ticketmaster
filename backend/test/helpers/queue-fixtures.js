// MEMBER 3: fixtures for queue integration tests.
//
// These tests share the team's Aiven database, and concurrency cannot be
// tested inside a single rolled-back transaction, because two connections
// cannot see each other's uncommitted rows. So the tests really commit, and
// safety comes from ownership instead: every row created here is recorded,
// and cleanup() deletes ONLY recorded IDs, in foreign-key order. Nothing is
// ever deleted by wildcard, by timestamp, or by "everything in the table".
import { randomUUID } from "node:crypto";

export function createFixtures(pool) {
  const prefix = `QS-M3-${randomUUID()}`;
  const userIds = [];
  const serviceIds = [];
  // Incremented synchronously, so concurrent makeService() calls cannot
  // derive the same name from a not-yet-updated serviceIds.length.
  let serviceCount = 0;

  async function makeUser(label, role = "user") {
    // These tests call repository functions directly and never authenticate,
    // so the credential columns only need to satisfy their CHAR() widths.
    const [result] = await pool.execute(
      `INSERT INTO user_credentials (email, password_salt, password_digest, role)
       VALUES (?, ?, ?, ?)`,
      [
        `${prefix}-${label}@example.test`.toLowerCase(),
        "0".repeat(32),
        "0".repeat(128),
        role,
      ],
    );

    const id = Number(result.insertId);
    userIds.push(id);

    await pool.execute(
      "INSERT INTO user_profiles (user_id, name) VALUES (?, ?)",
      [id, `${prefix} ${label}`],
    );

    return { id, name: `${prefix} ${label}`, role };
  }

  async function makeService({ isOpen = true, expectedDuration = 5 } = {}) {
    const name = `${prefix}-svc-${++serviceCount}`;

    const [result] = await pool.execute(
      `INSERT INTO services (name, description, expected_duration, priority, is_open)
       VALUES (?, ?, ?, ?, ?)`,
      [name, "Member 3 queue fixture", expectedDuration, "medium", isOpen],
    );

    const id = Number(result.insertId);
    serviceIds.push(id);

    await pool.execute(
      "INSERT INTO queues (service_id, status) VALUES (?, ?)",
      [id, isOpen ? "open" : "closed"],
    );

    return { id, name, expectedDuration, isOpen };
  }

  // Deletes in FK order. Entry-derived rows are reached through the queues of
  // services we created and through the users we created -- both sets are ours.
  async function cleanup() {
    const scope = [];
    if (serviceIds.length) {
      scope.push({
        entries: "queue_id IN (SELECT id FROM queues WHERE service_id IN (?))",
        values: [serviceIds],
      });
    }
    if (userIds.length) {
      scope.push({ entries: "user_id IN (?)", values: [userIds] });
    }

    for (const { entries, values } of scope) {
      await pool.query(
        `DELETE FROM notifications WHERE entry_id IN (SELECT id FROM queue_entries WHERE ${entries})`,
        values,
      );
      await pool.query(
        `DELETE FROM history WHERE id IN (SELECT id FROM (SELECT id FROM queue_entries WHERE ${entries}) AS owned)`,
        values,
      );
      await pool.query(`DELETE FROM queue_entries WHERE ${entries}`, values);
    }

    if (serviceIds.length) {
      await pool.query("DELETE FROM queues WHERE service_id IN (?)", [serviceIds]);
      await pool.query("DELETE FROM services WHERE id IN (?)", [serviceIds]);
    }
    if (userIds.length) {
      await pool.query("DELETE FROM notifications WHERE user_id IN (?)", [userIds]);
      await pool.query("DELETE FROM user_profiles WHERE user_id IN (?)", [userIds]);
      await pool.query("DELETE FROM user_credentials WHERE id IN (?)", [userIds]);
    }
  }

  return { prefix, makeUser, makeService, cleanup };
}
