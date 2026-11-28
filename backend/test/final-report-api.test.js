import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";

test("final reports enforce authentication and administrator access", async t => {
  const adminToken = "a".repeat(64);
  const userToken = "b".repeat(64);

  const hash = value =>
    createHash("sha256").update(value).digest("hex");

  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/final-report.example.json", import.meta.url),
      "utf8",
    ),
  );

  const sessions = new Map([
    [
      hash(adminToken),
      {
        user: { id: 1, role: "admin" },
        expiresAt: Date.now() + 60000,
      },
    ],
    [
      hash(userToken),
      {
        user: { id: 2, role: "user" },
        expiresAt: Date.now() + 60000,
      },
    ],
  ]);

  let calls = 0;

  const { app } = createApp({
    authStorage: "mysql",
    servicesStorage: "mysql",
    queueStorage: "mysql",
    activityStorage: "mysql",

    usersRepository: {
      async findSession(tokenHash) {
        return sessions.get(tokenHash) ?? null;
      },
    },

    reportsRepository: {
      async generateReport() {
        calls++;
        return fixture;
      },
    },
  });

  const server = app.listen(0, "127.0.0.1");

  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  await new Promise(resolve => {
    server.once("listening", resolve);
  });

  const url =
    `http://127.0.0.1:${server.address().port}/api/admin/reports`;

  const unauthenticated = await fetch(url);
  assert.equal(unauthenticated.status, 401);

  const customerResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });

  assert.equal(customerResponse.status, 403);
  assert.equal(calls, 0);

  const adminResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  assert.equal(adminResponse.status, 200);
  assert.deepEqual((await adminResponse.json()).data, fixture);
  assert.equal(calls, 1);
});

test("report repository returns empty data and rolls back on failure", async () => {
  const { generateReport } = await import(
    "../src/repositories/reports.repo.js"
  );

  const events = [];

  const connection = {
    async beginTransaction() {
      events.push("begin");
    },
    async execute() {
      return [[]];
    },
    async commit() {
      events.push("commit");
    },
    async rollback() {
      events.push("rollback");
    },
    release() {
      events.push("release");
    },
  };

  const source = {
    async getConnection() {
      return connection;
    },
  };

  const report = await generateReport(source);

  assert.deepEqual(report, {
    generatedAt: report.generatedAt,
    customers: [],
    participations: [],
    services: [],
    totals: {
      customerCount: 0,
      participationCount: 0,
      servedVisits: 0,
      distinctCustomersServed: 0,
      averageWaitMinutes: null,
    },
  });

  assert.equal(
    new Date(report.generatedAt).toISOString(),
    report.generatedAt,
  );

  assert.deepEqual(events, ["begin", "commit", "release"]);

  events.length = 0;

  const error = new Error("Database unavailable");

  connection.execute = async () => {
    throw error;
  };

  await assert.rejects(() => generateReport(source), error);

  assert.deepEqual(events, ["begin", "rollback", "release"]);
});

test("MySQL report: empty data, unused records, and served statistics", {
  skip: process.env.QUEUESMART_DB_TESTS === "1"
    ? false
    : "Requires isolated MySQL and QUEUESMART_DB_TESTS=1.",
}, async t => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST),
  );

  assert.equal(process.env.DB_NAME, "queuesmart_db");

  const { default: mysql } = await import("mysql2/promise");

  const { generateReport } = await import(
    "../src/repositories/reports.repo.js"
  );

  // Temporary tables on one dedicated connection isolate fixtures
  // from other test suites and leave the original tables unchanged.
  const source = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: "Z",
    connectionLimit: 1,
  });

  t.after(() => source.end());

  for (const table of [
    "user_credentials",
    "user_profiles",
    "services",
    "queues",
    "queue_entries",
    "history",
  ]) {
    const template = `report_template_${table}`;

    await source.query(
      `CREATE TEMPORARY TABLE ${template} LIKE ${table}`,
    );

    await source.query(
      `CREATE TEMPORARY TABLE ${table} LIKE ${template}`,
    );

    await source.query(
      `DROP TEMPORARY TABLE ${template}`,
    );
  }

  const empty = await generateReport(source);

  assert.deepEqual(empty.customers, []);
  assert.deepEqual(empty.participations, []);
  assert.deepEqual(empty.services, []);

  assert.deepEqual(empty.totals, {
    customerCount: 0,
    participationCount: 0,
    servedVisits: 0,
    distinctCustomersServed: 0,
    averageWaitMinutes: null,
  });

  await source.query(`
    INSERT INTO user_credentials
      (id, email, password_salt, password_digest, role)
    VALUES
      (1, 'a@example.test',
       REPEAT('0',32), REPEAT('0',128), 'user'),
      (2, 'b@example.test',
       REPEAT('0',32), REPEAT('0',128), 'user'),
      (3, 'unused@example.test',
       REPEAT('0',32), REPEAT('0',128), 'user'),
      (4, 'admin@example.test',
       REPEAT('0',32), REPEAT('0',128), 'admin')
  `);

  await source.query(`
    INSERT INTO user_profiles (user_id, name)
    VALUES
      (1, 'A'),
      (2, 'B'),
      (3, 'Unused'),
      (4, 'Administrator')
  `);

  await source.query(`
    INSERT INTO services
      (id, name, description, expected_duration, is_open)
    VALUES
      (1, 'Renamed service', 'First', 5, TRUE),
      (2, 'Second service', 'Second', 10, TRUE),
      (3, 'Unused service', 'No visits', 15, FALSE)
  `);

  await source.query(`
    INSERT INTO queues (id, service_id, status)
    VALUES
      (1, 1, 'open'),
      (2, 2, 'open'),
      (3, 3, 'closed')
  `);

  async function visit(id, userId, serviceId, outcome, minutes) {
    const status = {
      Served: "served",
      Waiting: "waiting",
      "Left Queue": "left",
      Removed: "removed",
    }[outcome];

    const joined = new Date("2026-11-17T12:00:00.000Z");

    const ended = minutes === null
      ? null
      : new Date(+joined + minutes * 60000);

    await source.execute(`
      INSERT INTO queue_entries
        (id, queue_id, user_id, order_seq, status, joined_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, serviceId, userId, id, status, joined, ended,
    ]);

    await source.execute(`
      INSERT INTO history
        (id, user_id, service_id, service_name,
         joined_at, ended_at, outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, userId, serviceId, "Original name",
      joined, ended, outcome,
    ]);
  }

  // Unequal served counts expose incorrectly averaged service averages.
  await visit(1, 1, 1, "Served", 2);
  await visit(2, 1, 1, "Served", 4);
  await visit(3, 2, 2, "Served", 12.5);
  await visit(4, 1, 1, "Left Queue", 100);
  await visit(5, 2, 1, "Removed", 200);
  await visit(6, 2, 1, "Waiting", null);

  const report = await generateReport(source);

  assert.deepEqual(
    report.customers.map(c => [c.id, c.participationCount]),
    [[1, 3], [2, 3], [3, 0]],
  );

  assert.deepEqual(report.totals, {
    customerCount: 3,
    participationCount: 6,
    servedVisits: 3,
    distinctCustomersServed: 2,
    averageWaitMinutes: 18.5 / 3,
  });

  assert.deepEqual(report.services, [
    {
      id: 1,
      name: "Renamed service",
      description: "First",
      isOpen: true,
      expectedDuration: 5,
      waitingCount: 1,
      participationCount: 5,
      servedVisits: 2,
      distinctCustomersServed: 1,
      averageWaitMinutes: 3,
    },
    {
      id: 2,
      name: "Second service",
      description: "Second",
      isOpen: true,
      expectedDuration: 10,
      waitingCount: 0,
      participationCount: 1,
      servedVisits: 1,
      distinctCustomersServed: 1,
      averageWaitMinutes: 12.5,
    },
    {
      id: 3,
      name: "Unused service",
      description: "No visits",
      isOpen: false,
      expectedDuration: 15,
      waitingCount: 0,
      participationCount: 0,
      servedVisits: 0,
      distinctCustomersServed: 0,
      averageWaitMinutes: null,
    },
  ]);

  assert.deepEqual(
    report.participations.map(p => p.entryId),
    [6, 5, 4, 3, 2, 1],
  );

  assert.equal(report.participations[0].endedAt, null);
  assert.equal(report.participations[0].waitMinutes, null);

  assert.deepEqual(
    report.participations.find(p => p.entryId === 3),
    {
      entryId: 3,
      userId: 2,
      customerName: "B",
      serviceId: 2,
      serviceName: "Original name",
      joinedAt: "2026-11-17T12:00:00.000Z",
      endedAt: "2026-11-17T12:12:30.000Z",
      outcome: "Served",
      waitMinutes: 12.5,
    },
  );

  assert.doesNotMatch(
    JSON.stringify(report),
    /password|digest|salt|token_hash/i,
  );

  // A customer served in two services counts once in overall totals.
  await visit(7, 1, 2, "Served", 0);

  const updated = await generateReport(source);

  assert.equal(updated.totals.servedVisits, 4);
  assert.equal(updated.totals.distinctCustomersServed, 2);
  assert.equal(updated.totals.averageWaitMinutes, 18.5 / 4);
  assert.equal(updated.services[1].distinctCustomersServed, 2);
  assert.equal(updated.participations[0].waitMinutes, 0);
});