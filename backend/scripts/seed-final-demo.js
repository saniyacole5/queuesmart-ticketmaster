// Member work area - Integration and persistence.
// Explicitly run with demo:seed. All fixture writes commit together.
import { pool } from "../src/db/pool.js";
import { withTransaction } from "../src/db/transaction.js";
import { hashPassword } from "../src/modules/authSql.js";
import { createUserWithProfile, findUserByEmail } from "../src/repositories/users.repo.js";
import { createService } from "../src/repositories/services.repo.js";
import { joinQueue, recordJoinActivity } from "../src/repositories/queues.repo.js";
import { completeHistory, emitNotification } from "../src/repositories/activity.repo.js";

try {
  const prefix = process.env.DEMO_PREFIX || "final-demo";
  const password = process.env.DEMO_USER_PASSWORD;
  if (!/^[a-z0-9-]{1,32}$/.test(prefix)) throw new Error("Use 1-32 lowercase letters, digits, or hyphens for DEMO_PREFIX.");
  if (!password || password.length < 8 || password.length > 128) {
    throw new Error("Set DEMO_USER_PASSWORD to 8-128 characters in backend/.env.");
  }
  const [[database]] = await pool.query("SELECT DATABASE() AS name");
  if (database.name !== "queuesmart_db") throw new Error("Select queuesmart_db before preparing the demo.");

  const result = await withTransaction(async connection => {
    const serviceName = `Final Demo ${prefix}`;
    const [existing] = await connection.execute("SELECT id FROM services WHERE name = ?", [serviceName]);
    if (existing.length) {
      return { serviceId: Number(existing[0].id), created: false };
    }

    const service = await createService({
      name: serviceName,
      description: "Final assignment demonstration data",
      expectedDuration: 5,
      priority: "medium",
      isOpen: true,
    }, connection);

    const users = [];
    for (let index = 1; index <= 7; index++) {
      const email = `${prefix}-customer-${index}@example.test`;
      const existingUser = await findUserByEmail(email, connection);
      if (existingUser) throw new Error(`Demo email already exists: ${email}. Choose another DEMO_PREFIX.`);
      const credentials = await hashPassword(password);
      users.push(await createUserWithProfile({
        name: `Demo Customer ${index}`,
        email,
        ...credentials,
        role: "user",
      }, connection));
    }

    const [[queue]] = await connection.execute("SELECT id FROM queues WHERE service_id = ?", [service.id]);
    const now = Date.now();
    const joinedAt = new Date(now - 35 * 60000);

    // Four historical serves, three minutes apart. All four joined before
    // the first serve, so every interval represents a service with a backlog.
    for (let index = 0; index < 4; index++) {
      const endedAt = new Date(now - (20 - index * 3) * 60000);
      const [entry] = await connection.execute(
        "INSERT INTO queue_entries (queue_id, user_id, order_seq, joined_at) VALUES (?, ?, ?, ?)",
        [queue.id, users[index].id, index + 1, joinedAt],
      );
      const entryId = Number(entry.insertId);
      await recordJoinActivity(connection, {
        entryId, userId: users[index].id, serviceId: service.id,
        serviceName: service.name, joinedAt,
      });
      await connection.execute(
        "UPDATE queue_entries SET status = 'served', ended_at = ? WHERE id = ?",
        [endedAt, entryId],
      );
      await completeHistory({ entryId, outcome: "Served", endedAt }, connection);
      await emitNotification({
        entryId, userId: users[index].id, event: "Served",
        message: `Queue participation in ${service.name}: Served.`,
      }, connection);
    }

    for (const user of users.slice(4, 6)) {
      await joinQueue({ userId: user.id, serviceId: service.id }, connection);
    }
    return { serviceId: service.id, created: true };
  });

  console.log(JSON.stringify({
    ...result,
    serviceName: `Final Demo ${prefix}`,
    customerEmail: `${prefix}-customer-7@example.test`,
    nextStep: result.created
      ? "Sign in with this customer and join the demo service through React."
      : "Existing demo data was reused. Use a new DEMO_PREFIX for a fresh rehearsal.",
  }, null, 2));
  // TODO(INTEGRATION-2) Rehearse the fixture twice, verify idempotency and
  // adjust the service data together with the smart-feature member.
} catch (error) {
  console.error("Final demo setup failed.", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
