import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "../src/modules/authSql.js";
import { createFixtures } from "./helpers/queue-fixtures.js";

const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const enabled = process.env.QUEUESMART_DB_TESTS === "1";

async function unusedPort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) => {
    listener.close(error => error ? reject(error) : resolve());
  });
  return port;
}

async function stopBackend(server) {
  if (!server || !server.child.pid) return;
  if (server.child.exitCode !== null || server.child.signalCode !== null) return;

  const forceStop = setTimeout(() => server.child.kill("SIGKILL"), 5000);
  try {
    server.child.kill();
    await server.exited;
  } finally {
    clearTimeout(forceStop);
  }
}

async function startBackend() {
  const port = await unusedPort();
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      SESSION_TTL_MINUTES: "60",
      AUTH_STORAGE: "mysql",
      SERVICES_STORAGE: "mysql",
      QUEUE_STORAGE: "mysql",
      ACTIVITY_STORAGE: "mysql",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const base = `http://127.0.0.1:${port}/api`;
  const exited = new Promise(resolve => child.once("exit", resolve));
  const server = { child, base, exited };
  let output = "";
  let launchError;
  const collect = chunk => {
    output = (output + chunk.toString()).slice(-4000);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.once("error", error => {
    launchError = error;
  });

  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Backend exited during startup.\n${output}`);
      }

      let health;
      try {
        const response = await fetch(`${base}/health`, {
          signal: AbortSignal.timeout(500),
        });
        if (response.ok) health = (await response.json()).data;
      } catch {
        // The child may still be connecting to the test database.
      }

      if (health) {
        assert.equal(health.storage, "mysql");
        for (const field of [
          "authStorage", "servicesStorage", "queueStorage", "activityStorage",
        ]) {
          assert.equal(health[field], "mysql");
        }
        return server;
      }
      await delay(100);
    }
    throw new Error(`Backend did not become ready.\n${output}`);
  } catch (error) {
    await stopBackend(server);
    throw error;
  }
}

test(
  "final persistence survives a real backend process restart",
  {
    skip: enabled ? false : "Run with isolated MySQL and QUEUESMART_DB_TESTS=1.",
    timeout: 60000,
  },
  async t => {
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(process.env.DB_HOST),
      "Use the isolated local or CI MySQL instance.",
    );
    assert.equal(process.env.DB_NAME, "queuesmart_db");

    const { pool } = await import("../src/db/pool.js");
    const { getUserById } = await import("../src/repositories/users.repo.js");
    const fixtures = createFixtures(pool);
    let server;

    t.after(async () => {
      try {
        await stopBackend(server);
      } finally {
        try {
          await fixtures.cleanup();
        } finally {
          await pool.end();
        }
      }
    });

    const customer = await fixtures.makeUser("customer");
    const administrator = await fixtures.makeUser("administrator", "admin");
    const service = await fixtures.makeService();
    const password = "RestartFixturePassword1";

    // Queue fixtures start with placeholder hashes. Give both accounts
    // real credentials before exercising the HTTP login endpoint.
    for (const account of [customer, administrator]) {
      const { salt, digest } = await hashPassword(password);
      await pool.execute(
        "UPDATE user_credentials SET password_salt = ?, password_digest = ? WHERE id = ?",
        [salt, digest, account.id],
      );
    }
    const customerAccount = await getUserById(customer.id);
    const adminAccount = await getUserById(administrator.id);

    server = await startBackend();

    async function request(path, token, method = "GET", body) {
      const response = await fetch(`${server.base}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000),
      });
      const payload = await response.json();
      assert.equal(
        response.ok,
        true,
        `${method} ${path} returned ${response.status}: ${payload.error?.message || ""}`,
      );
      return payload.data;
    }

    const userLogin = await request("/auth/login", undefined, "POST", {
      email: customerAccount.email, password, expectedRole: "user",
    });
    const adminLogin = await request("/auth/login", undefined, "POST", {
      email: adminAccount.email, password, expectedRole: "admin",
    });

    await request(`/services/${service.id}`, adminLogin.token, "PATCH", {
      description: "Description persisted by the final restart test",
    });
    const firstJoin = await request(
      `/services/${service.id}/queue`, userLogin.token, "POST", {},
    );
    const served = await request(
      `/services/${service.id}/serve-next`, adminLogin.token, "POST", {},
    );
    assert.equal(served.id, firstJoin.id);
    assert.equal(served.outcome, "Served");

    const secondJoin = await request(
      `/services/${service.id}/queue`, userLogin.token, "POST", {},
    );
    assert.notEqual(secondJoin.id, firstJoin.id);

    const notifications = await request("/notifications", userLogin.token);
    assert.ok(notifications.length > 0);
    const readId = notifications[0].id;
    await request(`/notifications/${readId}/read`, userLogin.token, "PATCH", {});

    async function snapshot() {
      const services = await request("/services", userLogin.token);
      return {
        account: await request("/auth/me", userLogin.token),
        queue: await request("/queues/me", userLogin.token),
        history: await request("/history", userLogin.token),
        notifications: await request("/notifications", userLogin.token),
        service: services.find(item => item.id === service.id),
      };
    }

    const before = await snapshot();
    assert.equal(before.queue.id, secondJoin.id);
    assert.equal(before.service.description, "Description persisted by the final restart test");
    assert.ok(before.history.some(item => item.id === firstJoin.id && item.outcome === "Served"));
    assert.ok(before.history.some(item => item.id === secondJoin.id && item.outcome === "Waiting"));
    assert.equal(before.notifications.find(item => item.id === readId).read, true);

    await stopBackend(server);
    server = await startBackend();

    // Reuse both original tokens after the process restart.
    const after = await snapshot();
    assert.deepEqual(after, before);
    assert.equal((await request("/auth/me", adminLogin.token)).id, administrator.id);

    const nextServed = await request(
      `/services/${service.id}/serve-next`, adminLogin.token, "POST", {},
    );
    assert.equal(nextServed.id, secondJoin.id);
    assert.equal(await request("/queues/me", userLogin.token), null);
  },
);
