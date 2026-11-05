// MEMBER 3: real MySQL queue lifecycle, ordering and concurrency.
//
// Unlike the services DB tests, these commit for real -- concurrency cannot be
// observed inside one rolled-back transaction. See test/helpers/queue-fixtures.js
// for the ownership-based cleanup that keeps teammates' rows untouched.
import test from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.QUEUESMART_DB_TESTS === "1";

test(
  "A4 queues: real MySQL lifecycle operations",
  { skip: enabled ? false : "Requires disposable local/CI MySQL and QUEUESMART_DB_TESTS=1." },
  async (t) => {
    // Same guard as Member 1's a4-auth-db.test.js: these tests commit and then
    // delete, so they must never touch the shared Aiven database.
    if (!["127.0.0.1", "localhost", "::1"].includes(process.env.DB_HOST)) {
      throw new Error(
        "Refusing Member 3 write tests against a nonlocal database. Use disposable local/CI MySQL.",
      );
    }
    if (process.env.DB_NAME !== "queuesmart_db") {
      throw new Error("Set DB_NAME=queuesmart_db on the disposable test instance.");
    }

    // Import only when explicitly enabled, so ordinary tests do not
    // initialize a database connection or read a certificate.
    const { pool } = await import("../src/db/pool.js");
    const { createFixtures } = await import("./helpers/queue-fixtures.js");
    const { listActiveEntriesByService, findActiveEntryForUser, joinQueue } =
      await import("../src/repositories/queues.repo.js");

    const fixtures = createFixtures(pool);

    t.after(async () => {
      try {
        await fixtures.cleanup();
      } finally {
        await pool.end();
      }
    });

    await t.test("empty queue reads as an empty list", async () => {
      const service = await fixtures.makeService({ isOpen: true });

      assert.deepEqual(await listActiveEntriesByService(service.id), []);
    });

    await t.test("a user with no entry reads as null", async () => {
      const user = await fixtures.makeUser("idle");

      assert.equal(await findActiveEntryForUser(user.id), null);
    });

    await t.test("joining stores a waiting row, history snapshot and notification", async () => {
      const service = await fixtures.makeService({ isOpen: true, expectedDuration: 5 });
      const user = await fixtures.makeUser("joiner");

      const entry = await joinQueue({ userId: user.id, serviceId: service.id });

      assert.equal(entry.position, 1);
      assert.equal(entry.estimatedWait, 0);
      assert.equal(entry.status, "Almost Ready");
      assert.equal(entry.serviceName, service.name);
      assert.equal(entry.priority, "standard");

      const [[row]] = await pool.query(
        "SELECT status, user_id FROM queue_entries WHERE id = ?",
        [entry.id],
      );
      assert.equal(row.status, "waiting");
      assert.equal(Number(row.user_id), user.id);

      const [[history]] = await pool.query(
        "SELECT outcome, service_name, ended_at FROM history WHERE id = ?",
        [entry.id],
      );
      assert.equal(history.outcome, "Waiting");
      assert.equal(history.service_name, service.name);
      assert.equal(history.ended_at, null);

      const [events] = await pool.query(
        "SELECT event FROM notifications WHERE entry_id = ? ORDER BY event",
        [entry.id],
      );
      assert.deepEqual(events.map((e) => e.event), ["almost-ready", "joined"]);
    });

    await t.test("two simultaneous joins by one user yield exactly one waiting row", async () => {
      const [first, second] = await Promise.all([
        fixtures.makeService({ isOpen: true }),
        fixtures.makeService({ isOpen: true }),
      ]);
      const user = await fixtures.makeUser("racer");

      const results = await Promise.allSettled([
        joinQueue({ userId: user.id, serviceId: first.id }),
        joinQueue({ userId: user.id, serviceId: second.id }),
      ]);

      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason.status, 409);
      assert.equal(rejected[0].reason.code, "ALREADY_QUEUED");

      const [[row]] = await pool.query(
        "SELECT COUNT(*) c FROM queue_entries WHERE user_id = ? AND status = 'waiting'",
        [user.id],
      );
      assert.equal(Number(row.c), 1);
    });

    await t.test("three users queue in arrival order", async () => {
      const service = await fixtures.makeService({ isOpen: true, expectedDuration: 5 });
      const users = [];
      for (const label of ["first", "second", "third"]) {
        const user = await fixtures.makeUser(`fifo-${label}`);
        users.push(user);
        await joinQueue({ userId: user.id, serviceId: service.id });
      }

      const ordered = await listActiveEntriesByService(service.id);

      assert.deepEqual(ordered.map((e) => e.userId), users.map((u) => u.id));
      assert.deepEqual(ordered.map((e) => e.position), [1, 2, 3]);
      assert.deepEqual(ordered.map((e) => e.estimatedWait), [0, 5, 10]);
      assert.deepEqual(
        ordered.map((e) => e.status),
        ["Almost Ready", "Almost Ready", "Waiting"],
      );
    });

    await t.test("joining a closed service is refused", async () => {
      const service = await fixtures.makeService({ isOpen: false });
      const user = await fixtures.makeUser("closed-out");

      await assert.rejects(
        () => joinQueue({ userId: user.id, serviceId: service.id }),
        (error) => error.status === 409 && error.code === "QUEUE_CLOSED",
      );

      assert.deepEqual(await listActiveEntriesByService(service.id), []);
      assert.equal(await findActiveEntryForUser(user.id), null);
    });

    // Review Focus 1
    await t.test("joining a service that does not exist returns 404", async () => {
      const user = await fixtures.makeUser("lost");

      await assert.rejects(
        // Zero is not an ID this application's AUTO_INCREMENT generates.
        () => joinQueue({ userId: user.id, serviceId: 0 }),
        (error) => error.status === 404 && error.code === "SERVICE_NOT_FOUND",
      );
    });

    // Review Focus 4
    await t.test("renaming a service keeps the history snapshot but updates the live view", async () => {
      const service = await fixtures.makeService({ isOpen: true });
      const user = await fixtures.makeUser("renamed");
      const entry = await joinQueue({ userId: user.id, serviceId: service.id });

      const renamed = `${service.name}-renamed`;
      await pool.execute("UPDATE services SET name = ? WHERE id = ?", [
        renamed,
        service.id,
      ]);

      const [[history]] = await pool.query(
        "SELECT service_name FROM history WHERE id = ?",
        [entry.id],
      );
      assert.equal(history.service_name, service.name);

      const [live] = await listActiveEntriesByService(service.id);
      assert.equal(live.serviceName, renamed);
    });

    await t.test("queue order survives a backend restart", async () => {
      const service = await fixtures.makeService({ isOpen: true });
      for (const label of ["a", "b", "c"]) {
        const user = await fixtures.makeUser(`restart-${label}`);
        await joinQueue({ userId: user.id, serviceId: service.id });
      }

      const before = await listActiveEntriesByService(service.id);

      // Simulate a restart: a brand new pool and module instance, sharing no
      // in-process state with the ones that wrote the rows.
      const stamp = Date.now();
      const { pool: freshPool } = await import(`../src/db/pool.js?restart=${stamp}`);
      const fresh = await import(`../src/repositories/queues.repo.js?restart=${stamp}`);

      try {
        const after = await fresh.listActiveEntriesByService(service.id, freshPool);
        assert.deepEqual(
          after.map((e) => [e.id, e.position]),
          before.map((e) => [e.id, e.position]),
        );
      } finally {
        await freshPool.end();
      }
    });
  },
);
