// Member work area - Integration and persistence.
// Capture after joining through React, restart Express, then run verify.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const base = (process.env.DEMO_API_URL || "http://127.0.0.1:3001/api").replace(/\/$/, "");
const snapshotPath = new URL("../demo-persistence.snapshot.local.json", import.meta.url);

async function request(path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error?.message || response.status}`);
  return payload.data;
}

try {
  const mode = process.argv[2];
  if (!["capture", "verify"].includes(mode)) throw new Error("Choose capture or verify.");
  const health = await request("/health");
  const modes = ["authStorage", "servicesStorage", "queueStorage", "activityStorage"];
  assert.equal(health.storage, "mysql");
  for (const field of modes) assert.equal(health[field], "mysql");

  const prefix = process.env.DEMO_PREFIX || "final-demo";
  if (!process.env.DEMO_USER_PASSWORD) throw new Error("Set DEMO_USER_PASSWORD in backend/.env.");
  const login = await request("/auth/login", undefined, {
    email: `${prefix}-customer-7@example.test`,
    password: process.env.DEMO_USER_PASSWORD,
    expectedRole: "user",
  });
  try {
    const token = login.token;
    const queue = await request("/queues/me", token);
    if (!queue) throw new Error("Join the demo service through React before capturing or verifying.");
    const services = await request("/services", token);
    const service = services.find(item => item.id === queue.serviceId);
    if (!service) throw new Error("The active queue has no matching service.");
    const history = await request("/history", token);
    const notifications = await request("/notifications", token);
    const snapshot = {
      api: base,
      customerId: login.user.id,
      queue: {
        id: queue.id, userId: queue.userId, serviceId: queue.serviceId,
        position: queue.position, priority: queue.priority, joinedAt: queue.joinedAt,
      },
      service: { id: service.id, name: service.name, isOpen: service.isOpen, expectedDuration: service.expectedDuration },
      history: history.map(item => ({
        id: item.id, serviceId: item.serviceId, outcome: item.outcome,
        joinedAt: item.joinedAt, endedAt: item.endedAt,
      })).sort((a, b) => a.id - b.id),
      notificationIds: notifications.map(item => item.id).sort((a, b) => a - b),
    };
    if (mode === "capture") {
      await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
      console.log("Captured queue, service, history, and notification identities. Restart Express, then run demo:verify.");
    } else {
      const before = JSON.parse(await readFile(snapshotPath, "utf8"));
      assert.deepEqual(snapshot, before);
      console.log("Queue, service, history, and notification identities match the saved snapshot.");
    }
  } finally {
    await request("/auth/logout", login.token, {});
  }
  // TODO(INTEGRATION-3) Add an opt-in test that starts, stops, and restarts a
  // real backend process against the isolated test DB. Preserve its token in
  // memory across restarts to verify durable sessions as well.
} catch (error) {
  console.error("Persistence check failed.", error.message);
  process.exitCode = 1;
}
