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
    const {
      listActiveEntriesByService,
      findActiveEntryForUser,
      joinQueue,
      finishEntry,
      serveNext,
      adjustEntry,
    } = await import("../src/repositories/queues.repo.js");

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

      // Simulate a restart: a brand new pool, sharing no connection or cached
      // state with the one that wrote these rows. The repository itself holds
      // no in-process state, so a fresh pool is what the claim rests on.
      const { pool: freshPool } = await import(`../src/db/pool.js?restart=${Date.now()}`);

      try {
        const after = await listActiveEntriesByService(service.id, freshPool);
        assert.deepEqual(
          after.map((e) => [e.id, e.position]),
          before.map((e) => [e.id, e.position]),
        );
      } finally {
        await freshPool.end();
      }
    });

    // --- Task 4: leave, serve, remove ---------------------------------------

    // Builds a service with `count` users already queued, newest last.
    async function queued(label, count, options = {}) {
      const service = await fixtures.makeService({ isOpen: true, ...options });
      const entries = [];
      for (let i = 0; i < count; i += 1) {
        const user = await fixtures.makeUser(`${label}-${i}`);
        entries.push({
          user,
          entry: await joinQueue({ userId: user.id, serviceId: service.id }),
        });
      }
      return { service, entries };
    }

    await t.test("leaving soft-finishes the row and frees the user to rejoin", async () => {
      const { service, entries } = await queued("leave", 1);
      const { user, entry } = entries[0];

      const result = await finishEntry({
        entryId: entry.id,
        outcome: "Left Queue",
        actingUserId: user.id,
      });
      assert.equal(result.outcome, "Left Queue");

      const [[row]] = await pool.query(
        "SELECT status, ended_at, active_user_id FROM queue_entries WHERE id = ?",
        [entry.id],
      );
      assert.equal(row.status, "left");
      assert.notEqual(row.ended_at, null);
      // The generated column releases the user for a new participation.
      assert.equal(row.active_user_id, null);

      const [[history]] = await pool.query(
        "SELECT outcome, ended_at FROM history WHERE id = ?",
        [entry.id],
      );
      assert.equal(history.outcome, "Left Queue");
      assert.notEqual(history.ended_at, null);

      const [[terminal]] = await pool.query(
        "SELECT COUNT(*) c FROM notifications WHERE entry_id = ? AND event = 'Left Queue'",
        [entry.id],
      );
      assert.equal(Number(terminal.c), 1);

      // Rejoining is now permitted and starts a new participation.
      const rejoined = await joinQueue({ userId: user.id, serviceId: service.id });
      assert.notEqual(rejoined.id, entry.id);
    });

    await t.test("a user cannot leave another user's entry", async () => {
      const { entries } = await queued("ownership", 2);
      const victim = entries[0];
      const attacker = entries[1];

      await assert.rejects(
        () =>
          finishEntry({
            entryId: victim.entry.id,
            outcome: "Left Queue",
            actingUserId: attacker.user.id,
          }),
        (error) => error.status === 403 && error.code === "FORBIDDEN",
      );

      const [[row]] = await pool.query(
        "SELECT status FROM queue_entries WHERE id = ?",
        [victim.entry.id],
      );
      assert.equal(row.status, "waiting");
    });

    await t.test("serve finishes the first ordered entry and promotes the rest", async () => {
      const { service, entries } = await queued("serve", 3);

      const served = await serveNext({ serviceId: service.id });
      assert.equal(served.outcome, "Served");
      assert.equal(served.id, entries[0].entry.id);

      const remaining = await listActiveEntriesByService(service.id);
      assert.deepEqual(
        remaining.map((e) => [e.id, e.position]),
        [
          [entries[1].entry.id, 1],
          [entries[2].entry.id, 2],
        ],
      );

      const [[row]] = await pool.query(
        "SELECT status FROM queue_entries WHERE id = ?",
        [entries[0].entry.id],
      );
      assert.equal(row.status, "served");
    });

    await t.test("admin remove works on any entry", async () => {
      const { entries } = await queued("remove", 1);
      const admin = await fixtures.makeUser("remover", "admin");

      const removed = await finishEntry({
        entryId: entries[0].entry.id,
        outcome: "Removed",
        actingUserId: admin.id,
        isAdmin: true,
      });

      assert.equal(removed.outcome, "Removed");
      const [[row]] = await pool.query(
        "SELECT status FROM queue_entries WHERE id = ?",
        [entries[0].entry.id],
      );
      assert.equal(row.status, "removed");
    });

    await t.test("a non-admin cannot remove another user's entry", async () => {
      const { entries } = await queued("no-remove", 2);

      await assert.rejects(
        () =>
          finishEntry({
            entryId: entries[0].entry.id,
            outcome: "Removed",
            actingUserId: entries[1].user.id,
            isAdmin: false,
          }),
        (error) => error.status === 403 && error.code === "FORBIDDEN",
      );

      const [[row]] = await pool.query(
        "SELECT status FROM queue_entries WHERE id = ?",
        [entries[0].entry.id],
      );
      assert.equal(row.status, "waiting");
    });

    await t.test("concurrent serve and leave finish the entry exactly once", async () => {
      const { service, entries } = await queued("race", 1);
      const { user, entry } = entries[0];

      const results = await Promise.allSettled([
        serveNext({ serviceId: service.id }),
        finishEntry({
          entryId: entry.id,
          outcome: "Left Queue",
          actingUserId: user.id,
        }),
      ]);

      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);

      const [[row]] = await pool.query(
        "SELECT status FROM queue_entries WHERE id = ?",
        [entry.id],
      );
      assert.notEqual(row.status, "waiting");

      // One participation, one history row, one terminal outcome.
      const [[history]] = await pool.query(
        "SELECT COUNT(*) c FROM history WHERE id = ?",
        [entry.id],
      );
      assert.equal(Number(history.c), 1);
    });

    // Review Focus 3
    await t.test("finishing an already-terminal entry returns 404 and adds nothing", async () => {
      const { entries } = await queued("double", 1);
      const { user, entry } = entries[0];

      await finishEntry({
        entryId: entry.id,
        outcome: "Left Queue",
        actingUserId: user.id,
      });

      const [[before]] = await pool.query(
        "SELECT COUNT(*) c FROM notifications WHERE entry_id = ?",
        [entry.id],
      );

      await assert.rejects(
        () =>
          finishEntry({
            entryId: entry.id,
            outcome: "Left Queue",
            actingUserId: user.id,
          }),
        (error) => error.status === 404 && error.code === "ENTRY_NOT_FOUND",
      );

      const [[after]] = await pool.query(
        "SELECT COUNT(*) c FROM notifications WHERE entry_id = ?",
        [entry.id],
      );
      assert.equal(Number(after.c), Number(before.c));
    });

    // Review Focus 5
    await t.test("serving an empty queue returns 409", async () => {
      const { service } = await queued("empty", 1);
      await serveNext({ serviceId: service.id });

      await assert.rejects(
        () => serveNext({ serviceId: service.id }),
        (error) => error.status === 409 && error.code === "QUEUE_EMPTY",
      );
    });

    await t.test("serving a closed queue is refused", async () => {
      const { service } = await queued("shut", 1);
      await pool.execute("UPDATE queues SET status = 'closed' WHERE service_id = ?", [
        service.id,
      ]);

      await assert.rejects(
        () => serveNext({ serviceId: service.id }),
        (error) => error.status === 409 && error.code === "QUEUE_CLOSED",
      );
    });

    // --- Task 5: priority and move ------------------------------------------

    await t.test("raising priority moves an entry above the standard tier", async () => {
      const { service, entries } = await queued("tier", 3);
      const promoted = entries[2].entry;

      const ordered = await adjustEntry({
        entryId: promoted.id,
        priority: "priority",
      });

      assert.equal(ordered[0].id, promoted.id);
      assert.equal(ordered[0].priority, "priority");
      assert.deepEqual(
        ordered.map((e) => e.id),
        [promoted.id, entries[0].entry.id, entries[1].entry.id],
      );

      // The live read agrees with what the mutation returned.
      const reread = await listActiveEntriesByService(service.id);
      assert.deepEqual(reread.map((e) => e.id), ordered.map((e) => e.id));
    });

    await t.test("move swaps order within a tier", async () => {
      const { service, entries } = await queued("swap", 3);
      const [first, second] = [entries[0].entry, entries[1].entry];

      const before = await pool.query(
        "SELECT id, order_seq FROM queue_entries WHERE id IN (?, ?)",
        [first.id, second.id],
      );
      const seq = Object.fromEntries(
        before[0].map((r) => [Number(r.id), Number(r.order_seq)]),
      );

      const ordered = await adjustEntry({ entryId: second.id, direction: "up" });

      assert.deepEqual(
        ordered.map((e) => e.id),
        [second.id, first.id, entries[2].entry.id],
      );

      const after = await pool.query(
        "SELECT id, order_seq FROM queue_entries WHERE id IN (?, ?)",
        [first.id, second.id],
      );
      const swapped = Object.fromEntries(
        after[0].map((r) => [Number(r.id), Number(r.order_seq)]),
      );
      assert.equal(swapped[first.id], seq[second.id]);
      assert.equal(swapped[second.id], seq[first.id]);

      const reread = await listActiveEntriesByService(service.id);
      assert.deepEqual(reread.map((e) => e.id), ordered.map((e) => e.id));
    });

    await t.test("move past an edge is refused", async () => {
      const { entries } = await queued("edge", 2);

      await assert.rejects(
        () => adjustEntry({ entryId: entries[0].entry.id, direction: "up" }),
        (error) => error.status === 409 && error.code === "MOVE_NOT_ALLOWED",
      );
      await assert.rejects(
        () => adjustEntry({ entryId: entries[1].entry.id, direction: "down" }),
        (error) => error.status === 409 && error.code === "MOVE_NOT_ALLOWED",
      );
    });

    await t.test("move across a priority tier is refused", async () => {
      const { entries } = await queued("cross", 2);
      await adjustEntry({ entryId: entries[0].entry.id, priority: "priority" });

      // entries[1] is now the only standard entry, sitting below the tier line.
      await assert.rejects(
        () => adjustEntry({ entryId: entries[1].entry.id, direction: "up" }),
        (error) => error.status === 409 && error.code === "MOVE_NOT_ALLOWED",
      );
    });

    await t.test("reordering back into the top two does not duplicate almost-ready", async () => {
      const { entries } = await queued("threshold", 3);
      const subject = entries[1].entry;

      const countAlmostReady = async () => {
        const [[row]] = await pool.query(
          "SELECT COUNT(*) c FROM notifications WHERE entry_id = ? AND event = 'almost-ready'",
          [subject.id],
        );
        return Number(row.c);
      };

      assert.equal(await countAlmostReady(), 1);

      await adjustEntry({ entryId: subject.id, direction: "down" });
      await adjustEntry({ entryId: subject.id, direction: "up" });

      assert.equal(await countAlmostReady(), 1);
    });

    await t.test("timestamps are UTC, so elapsed wait time is real", async () => {
      // joined_at came from a SQL DEFAULT (server local time) while ended_at
      // came from a JS Date (UTC), putting two time frames in one row and
      // making every wait-time statistic wrong by the UTC offset.
      const { service, entries } = await queued("clock", 1);
      const joinedAt = Date.now();

      const [live] = await listActiveEntriesByService(service.id);
      assert.ok(
        Math.abs(new Date(live.joinedAt).getTime() - joinedAt) < 60_000,
        `joinedAt ${live.joinedAt} is not close to now`,
      );

      await serveNext({ serviceId: service.id });

      const [[row]] = await pool.query(
        "SELECT TIMESTAMPDIFF(SECOND, joined_at, ended_at) AS waited FROM history WHERE id = ?",
        [entries[0].entry.id],
      );
      assert.ok(
        Number(row.waited) >= 0 && Number(row.waited) < 60,
        `history wait of ${row.waited}s is not a real elapsed time`,
      );

      const [[note]] = await pool.query(
        "SELECT created_at FROM notifications WHERE entry_id = ? LIMIT 1",
        [entries[0].entry.id],
      );
      assert.ok(
        Math.abs(new Date(note.created_at).getTime() - joinedAt) < 60_000,
        `notification created_at ${note.created_at} is not close to now`,
      );
    });

    await t.test("adjusting a finished entry returns 404", async () => {
      const { entries } = await queued("gone", 1);
      const { user, entry } = entries[0];
      await finishEntry({
        entryId: entry.id,
        outcome: "Left Queue",
        actingUserId: user.id,
      });

      await assert.rejects(
        () => adjustEntry({ entryId: entry.id, priority: "priority" }),
        (error) => error.status === 404 && error.code === "ENTRY_NOT_FOUND",
      );
    });
  },
);
