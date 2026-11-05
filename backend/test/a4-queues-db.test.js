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
    const { listActiveEntriesByService, findActiveEntryForUser } = await import(
      "../src/repositories/queues.repo.js"
    );

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
  },
);
