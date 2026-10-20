import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { createApp } from "../src/app.js";

async function setupApi(t) {
  const { app } = createApp();
  const server = app.listen(0, "127.0.0.1");

  t.after(
    () => new Promise((resolve) => server.close(resolve)),
  );

  await once(server, "listening");

  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(
    path,
    { method = "GET", body, token, raw = false } = {},
  ) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: raw ? body : JSON.stringify(body) }),
    });

    return {
      status: response.status,
      ...(await response.json()),
    };
  }

  async function get(path, token) {
    const response = await call(path, { token });
    assert.equal(response.status, 200);
    return response.data;
  }

  async function login(email, password) {
    const response = await call("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    assert.equal(response.status, 200);
    return response.data;
  }

  async function join(token) {
    const response = await call("/services/1/queue", {
      method: "POST",
      body: {},
      token,
    });

    assert.equal(response.status, 201);
    return response.data;
  }

  const first = await login(
    "user@queuesmart.com",
    "User1234",
  );

  const registration = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Second Member 4 User",
      email: "member4-second@queuesmart.test",
      password: "Member4Pass",
    },
  });

  assert.equal(registration.status, 201);

  const second = await login(
    "member4-second@queuesmart.test",
    "Member4Pass",
  );

  const admin = await login(
    "admin@queuesmart.com",
    "Admin1234",
  );

  return { call, get, join, first, second, admin };
}

test("HTTP: notifications and history enforce authentication and roles", async (t) => {
  const { call, get, admin } = await setupApi(t);

  for (const [path, method, body] of [
    ["/notifications", "GET", undefined],
    ["/history", "GET", undefined],
    ["/notifications/1/read", "PATCH", {}],
  ]) {
    const response = await call(path, { method, body });

    assert.equal(response.status, 401);
    assert.equal(response.error.code, "UNAUTHENTICATED");
  }

  const invalidSession = await call("/notifications", {
    token: "0".repeat(64),
  });

  assert.equal(invalidSession.status, 401);

  const adminHistory = await call("/history", {
    token: admin.token,
  });

  assert.equal(adminHistory.status, 403);
  assert.equal(adminHistory.error.code, "FORBIDDEN");

  const adminNotifications = await get(
    "/notifications",
    admin.token,
  );

  assert.ok(Array.isArray(adminNotifications));
});

test("HTTP: users see only their records and can mark only their notifications read", async (t) => {
  const { call, get, join, first, second } =
    await setupApi(t);

  const firstEntry = await join(first.token);
  const secondEntry = await join(second.token);

  const firstHistory = await get("/history", first.token);
  const secondHistory = await get("/history", second.token);

  assert.deepEqual(
    firstHistory.map((record) => record.id),
    [firstEntry.id],
  );
  assert.deepEqual(
    secondHistory.map((record) => record.id),
    [secondEntry.id],
  );

  const firstNotifications = await get(
    "/notifications",
    first.token,
  );
  const secondNotifications = await get(
    "/notifications",
    second.token,
  );

  assert.ok(firstNotifications.length > 0);
  assert.ok(secondNotifications.length > 0);

  assert.ok(
    firstNotifications.every(
      (item) =>
        item.userId === first.user.id &&
        item.entryId === firstEntry.id,
    ),
  );
  assert.ok(
    secondNotifications.every(
      (item) =>
        item.userId === second.user.id &&
        item.entryId === secondEntry.id,
    ),
  );

  // Query parameters cannot select another user's records.
  assert.deepEqual(
    await get(
      `/history?userId=${second.user.id}`,
      first.token,
    ),
    firstHistory,
  );
  assert.deepEqual(
    await get(
      `/notifications?userId=${second.user.id}`,
      first.token,
    ),
    firstNotifications,
  );

  const notification = firstNotifications.find(
    (item) => item.event === "joined",
  );

  assert.ok(notification);

  const forbiddenRead = await call(
    `/notifications/${notification.id}/read`,
    {
      method: "PATCH",
      body: {},
      token: second.token,
    },
  );

  assert.equal(forbiddenRead.status, 404);
  assert.equal(
    forbiddenRead.error.code,
    "NOTIFICATION_NOT_FOUND",
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    const marked = await call(
      `/notifications/${notification.id}/read`,
      {
        method: "PATCH",
        body: {},
        token: first.token,
      },
    );

    assert.equal(marked.status, 200);
    assert.equal(marked.data.read, true);
    assert.equal(
      marked.data.createdAt,
      notification.createdAt,
    );
  }

  const refreshed = await get(
    "/notifications",
    first.token,
  );

  assert.equal(
    refreshed.find((item) => item.id === notification.id).read,
    true,
  );
  assert.equal(
    refreshed.length,
    firstNotifications.length,
  );

  assert.deepEqual(
    await get("/notifications", second.token),
    secondNotifications,
  );

  const state = await get("/state", first.token);

  assert.deepEqual(state.history, firstHistory);
  assert.equal(state.currentQueue.id, firstEntry.id);
  assert.deepEqual(state.queueEntries, []);
});

test("HTTP: notification read validates IDs and request bodies without changing records", async (t) => {
  const { call, get, join, first, second } =
    await setupApi(t);

  await join(first.token);

  const before = await get("/notifications", first.token);
  const notification = before[0];

  assert.ok(notification);

  for (const id of [
    "0",
    "-1",
    "01",
    "1.5",
    "abc",
    "1000000000000000",
  ]) {
    const response = await call(
      `/notifications/${id}/read`,
      {
        method: "PATCH",
        body: {},
        token: first.token,
      },
    );

    assert.equal(response.status, 400, `Invalid ID: ${id}`);
    assert.equal(
      response.error.code,
      "VALIDATION_ERROR",
    );
    assert.equal(typeof response.error.fields.id, "string");
  }

  // A 15-digit ID has valid syntax but does not exist.
  const missing = await call(
    "/notifications/999999999999999/read",
    {
      method: "PATCH",
      body: {},
      token: first.token,
    },
  );

  assert.equal(missing.status, 404);
  assert.equal(
    missing.error.code,
    "NOTIFICATION_NOT_FOUND",
  );

  const path = `/notifications/${notification.id}/read`;

  for (const body of [
    undefined,
    null,
    [],
    true,
    "read",
    { read: true },
    { userId: second.user.id },
    { event: "joined" },
  ]) {
    const response = await call(path, {
      method: "PATCH",
      body,
      token: first.token,
    });

    assert.equal(response.status, 400);
    assert.ok(
      ["VALIDATION_ERROR", "INVALID_JSON"].includes(
        response.error.code,
      ),
    );
    assert.equal(
      typeof response.error.fields,
      "object",
    );
  }

  const malformed = await call(path, {
    method: "PATCH",
    body: "{",
    token: first.token,
    raw: true,
  });

  assert.equal(malformed.status, 400);
  assert.equal(malformed.error.code, "INVALID_JSON");

  const oversized = await call(path, {
    method: "PATCH",
    body: { message: "x".repeat(17000) },
    token: first.token,
  });

  assert.equal(oversized.status, 413);
  assert.equal(
    oversized.error.code,
    "BODY_TOO_LARGE",
  );

  assert.deepEqual(
    await get("/notifications", first.token),
    before,
  );
});

test("HTTP: history preserves service snapshots and records rejoining as a new visit", async (t) => {
  const { call, get, join, first, second, admin } =
    await setupApi(t);

  const original = await join(first.token);
  const renamedService = "Member 4 Renamed Queue";

  const renamed = await call("/services/1", {
    method: "PATCH",
    body: { name: renamedService },
    token: admin.token,
  });

  assert.equal(renamed.status, 200);

  const afterRename = await get("/history", first.token);

  assert.equal(
    afterRename[0].serviceName,
    original.serviceName,
  );

  const left = await call(
    `/queue-entries/${original.id}`,
    {
      method: "DELETE",
      token: first.token,
    },
  );

  assert.equal(left.status, 200);
  assert.equal(left.data.outcome, "Left Queue");

  const rejoined = await join(first.token);
  const records = await get("/history", first.token);

  assert.notEqual(rejoined.id, original.id);
  assert.deepEqual(
    records.map((record) => record.id),
    [rejoined.id, original.id],
  );

  const [current, previous] = records;

  assert.equal(current.outcome, "Waiting");
  assert.equal(current.endedAt, null);
  assert.equal(current.serviceName, renamedService);

  assert.equal(previous.outcome, "Left Queue");
  assert.equal(previous.serviceName, original.serviceName);
  assert.equal(previous.joinedAt, original.joinedAt);
  assert.equal(previous.date, original.joinedAt);
  assert.ok(
    Number.isFinite(Date.parse(previous.endedAt)),
  );

  const notifications = await get(
    "/notifications",
    first.token,
  );

  assert.equal(
    notifications.filter((item) => item.event === "joined")
      .length,
    2,
  );
  assert.equal(
    notifications.filter(
      (item) => item.event === "almost-ready",
    ).length,
    2,
  );

  const newJoinNotification = notifications.find(
    (item) =>
      item.entryId === rejoined.id &&
      item.event === "joined",
  );

  assert.ok(newJoinNotification);
  assert.equal(
    newJoinNotification.message,
    `You joined ${renamedService}.`,
  );

  assert.deepEqual(
    await get("/history", second.token),
    [],
  );

  const state = await get("/state", first.token);

  assert.deepEqual(state.history, records);
  assert.equal(state.currentQueue.id, rejoined.id);
});