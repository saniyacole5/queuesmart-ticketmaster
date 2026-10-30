import test from "node:test";
import assert from "node:assert/strict";
import { createServices } from "../src/modules/services.js";

const validBody = {
  name: " Test Service ",
  description: " Test description ",
  expectedDuration: 5,
  priority: "medium",
};

test("SQL service module: list returns repository results", async () => {
  const expected = [{ id: 1, name: "Test Service" }];

  const services = createServices(null, {
    async listServices() {
      return expected;
    },
  });

  assert.deepEqual(await services.list(), expected);
});

test("SQL service module: create validates and trims fields", async () => {
  let received;

  const services = createServices(null, {
    async createService(fields) {
      received = fields;
      return { id: 10, isOpen: true, ...fields };
    },
  });

  const created = await services.create(validBody);

  assert.deepEqual(received, {
    name: "Test Service",
    description: "Test description",
    expectedDuration: 5,
    priority: "medium",
  });
  assert.equal(created.id, 10);
});

test("SQL service module: invalid creation never reaches repository", async () => {
  let calls = 0;

  const services = createServices(null, {
    async createService() {
      calls += 1;
    },
  });

  for (const expectedDuration of [0, 481, 1.5, "5", null]) {
    await assert.rejects(
      () => services.create({ ...validBody, expectedDuration }),
      (error) =>
        error.status === 400 &&
        error.code === "VALIDATION_ERROR",
    );
  }

  assert.equal(calls, 0);
});

test("SQL service module: partial update sends only supplied fields", async () => {
  const calls = [];

  const services = createServices(null, {
    async getServiceById(id) {
      calls.push(["get", id]);
      return { id };
    },
    async updateService(id, patch) {
      calls.push(["update", id, patch]);
      return { id, ...patch };
    },
  });

  const updated = await services.update(10, { isOpen: false });

  assert.deepEqual(calls, [
    ["get", 10],
    ["update", 10, { isOpen: false }],
  ]);
  assert.deepEqual(updated, { id: 10, isOpen: false });
});

test("SQL service module: invalid updates never reach repository writes", async () => {
  let writes = 0;

  const services = createServices(null, {
    async getServiceById(id) {
      return { id };
    },
    async updateService() {
      writes += 1;
    },
  });

  for (const patch of [
    {},
    { expectedDuration: 481 },
    { isOpen: "false" },
    { priority: "urgent" },
    { id: 99 },
  ]) {
    await assert.rejects(
      () => services.update(10, patch),
      (error) =>
        error.status === 400 &&
        error.code === "VALIDATION_ERROR",
    );
  }

  assert.equal(writes, 0);
});

test("SQL service module: missing service prevents update", async () => {
  const missing = Object.assign(new Error("Service not found."), {
    status: 404,
    code: "SERVICE_NOT_FOUND",
  });
  let writes = 0;

  const services = createServices(null, {
    async getServiceById() {
      throw missing;
    },
    async updateService() {
      writes += 1;
    },
  });

  await assert.rejects(
    () => services.update(999, { name: "Changed" }),
    (error) => error === missing,
  );

  assert.equal(writes, 0);
});

test("SQL service module: duplicate-name error reaches caller", async () => {
  const conflict = Object.assign(new Error("Duplicate service name."), {
    status: 409,
    code: "SERVICE_NAME_CONFLICT",
  });

  const services = createServices(null, {
    async createService() {
      throw conflict;
    },
  });

  await assert.rejects(
    () => services.create(validBody),
    (error) => error === conflict,
  );
});