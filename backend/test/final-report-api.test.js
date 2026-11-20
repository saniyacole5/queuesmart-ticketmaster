import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";

test("final reports enforce authentication and administrator access", async t => {
  const adminToken = "a".repeat(64);
  const userToken = "b".repeat(64);
  const hash = value => createHash("sha256").update(value).digest("hex");
  const fixture = JSON.parse(await readFile(new URL("./fixtures/final-report.example.json", import.meta.url)));
  const sessions = new Map([
    [hash(adminToken), { user: { id: 1, role: "admin" }, expiresAt: Date.now() + 60000 }],
    [hash(userToken), { user: { id: 2, role: "user" }, expiresAt: Date.now() + 60000 }],
  ]);
  let calls = 0;
  const { app } = createApp({
    authStorage: "mysql", servicesStorage: "mysql", queueStorage: "mysql", activityStorage: "mysql",
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
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/reports`;

  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${userToken}` } })).status, 403);
  assert.equal(calls, 0);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, fixture);
  assert.equal(calls, 1);
});

test.todo("REPORT-1/2: MySQL report includes users with zero visits and services with zero history");
test.todo("REPORT-2: served visit counts, distinct customers, averages, and empty averages match real MySQL records");
