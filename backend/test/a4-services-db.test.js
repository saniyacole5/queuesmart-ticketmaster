import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const enabled = process.env.QUEUESMART_DB_TESTS === "1";

test(
  "A4 services: real MySQL repository operations",
  { skip: enabled ? false : "Requires an isolated MySQL test database." },
  async (t) => {
    // Import only when explicitly enabled, so ordinary tests do not
    // initialize a database connection or read a certificate.
    const {
      pool,
      createService,
      updateService,
      getServiceById,
      listServices,
    } = await import("../src/repositories/services.repo.js");

    const connection = await pool.getConnection();

    t.after(async () => {
      try {
        await connection.rollback();
      } finally {
        connection.release();
        await pool.end();
      }
    });

    // All fixtures belong to this transaction and are rolled back.
    await connection.beginTransaction();

    const prefix = `A4-${randomUUID()}`;

    function body(suffix, overrides = {}) {
      return {
        name: `${prefix}-${suffix}`,
        description: "Member 2 database test",
        expectedDuration: 5,
        priority: "medium",
        isOpen: true,
        ...overrides,
      };
    }

    async function queueFor(serviceId) {
      const [rows] = await connection.execute(
        "SELECT service_id, status FROM queues WHERE service_id = ?",
        [serviceId],
      );

      assert.equal(rows.length, 1);
      return rows[0];
    }

    await t.test("create stores a service and linked queue", async () => {
      const fields = body("create");
      const created = await createService(fields, connection);

      assert.ok(Number.isSafeInteger(created.id));
      assert.equal(created.name, fields.name);
      assert.equal(created.description, fields.description);
      assert.equal(created.expectedDuration, 5);
      assert.equal(created.priority, "medium");
      assert.equal(created.isOpen, true);
      assert.equal(created.queueLength, 0);

      const queue = await queueFor(created.id);
      assert.equal(Number(queue.service_id), created.id);
      assert.equal(queue.status, "open");

      const fetched = await getServiceById(created.id, connection);
      assert.deepEqual(fetched, created);

      const listed = await listServices(connection);
      assert.ok(listed.some((service) => service.id === created.id));
    });

    await t.test("closed creation stores matching queue status", async () => {
      const created = await createService(
        body("closed", { isOpen: false }),
        connection,
      );

      assert.equal(created.isOpen, false);
      assert.equal((await queueFor(created.id)).status, "closed");
    });

    await t.test("duplicate names ignore case and surrounding spaces", async () => {
      const fields = body("duplicate");
      await createService(fields, connection);

      await assert.rejects(
        () =>
          createService(
            {
              ...fields,
              name: `  ${fields.name.toUpperCase()}  `,
            },
            connection,
          ),
        (error) =>
          error.status === 409 &&
          error.code === "SERVICE_NAME_CONFLICT",
      );
    });

    await t.test("partial updates preserve unspecified fields", async () => {
      const created = await createService(
        body("partial", { isOpen: false }),
        connection,
      );

      const updated = await updateService(
        created.id,
        { expectedDuration: 12 },
        connection,
      );

      assert.deepEqual(updated, {
        ...created,
        expectedDuration: 12,
      });

      assert.equal((await queueFor(created.id)).status, "closed");
    });

    await t.test("opening and closing keep both tables synchronized", async () => {
      const created = await createService(body("toggle"), connection);

      for (const isOpen of [false, true]) {
        const updated = await updateService(
          created.id,
          { isOpen },
          connection,
        );

        assert.equal(updated.isOpen, isOpen);
        assert.equal(
          (await queueFor(created.id)).status,
          isOpen ? "open" : "closed",
        );
      }
    });

    await t.test("conflicting rename preserves the existing service", async () => {
      const first = await createService(body("first"), connection);
      const second = await createService(body("second"), connection);

      await assert.rejects(
        () =>
          updateService(
            second.id,
            {
              name: first.name.toUpperCase(),
              expectedDuration: 30,
              isOpen: false,
            },
            connection,
          ),
        (error) =>
          error.status === 409 &&
          error.code === "SERVICE_NAME_CONFLICT",
      );

      assert.deepEqual(
        await getServiceById(second.id, connection),
        second,
      );
      assert.equal((await queueFor(second.id)).status, "open");
    });

    await t.test("keeping a service's own name is allowed", async () => {
      const created = await createService(body("same-name"), connection);

      const updated = await updateService(
        created.id,
        { name: created.name },
        connection,
      );

      assert.deepEqual(updated, created);
    });

    await t.test("missing service IDs return 404", async () => {
      // Zero is not an ID generated by this application's AUTO_INCREMENT.
      for (const action of [
        () => getServiceById(0, connection),
        () => updateService(0, { isOpen: false }, connection),
      ]) {
        await assert.rejects(
          action,
          (error) =>
            error.status === 404 &&
            error.code === "SERVICE_NOT_FOUND",
        );
      }
    });
  },
);