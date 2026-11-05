// MEMBER 3: queue routes served from SQL, with injected repositories.
// No database here -- this file proves the wiring, not the SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';

test('QUEUE_STORAGE configuration is validated', () => {
  assert.throws(
    () => createApp({ queueStorage: 'sqlite' }),
    /Invalid QUEUE_STORAGE/,
  );

  // SQL queues read service and user rows, so they cannot outrun those.
  assert.throws(
    () => createApp({ authStorage: 'mysql', queueStorage: 'mysql' }),
    /SQL queues require SERVICES_STORAGE=mysql/,
  );
});

test('A4 queue API integration with injected repositories', async (t) => {
  const adminToken = 'a'.repeat(64);
  const userToken = 'b'.repeat(64);
  const hash = (token) => createHash('sha256').update(token).digest('hex');

  const sessions = new Map([
    [hash(adminToken), {
      user: { id: 1, name: 'Test Admin', email: 'admin@example.test', role: 'admin' },
      expiresAt: Date.now() + 3600000,
    }],
    [hash(userToken), {
      user: { id: 2, name: 'Test User', email: 'user@example.test', role: 'user' },
      expiresAt: Date.now() + 3600000,
    }],
  ]);

  const usersRepository = {
    async findSession(tokenHash) {
      return sessions.get(tokenHash) ?? null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
  };

  const servicesRepository = {
    async listServices() {
      return [{
        id: 9001,
        name: 'SQL Fixture',
        description: 'Service returned by the injected repository',
        expectedDuration: 10,
        priority: 'medium',
        isOpen: true,
        queueLength: 1,
      }];
    },
  };

  const storedEntry = {
    id: 5001,
    userId: 2,
    serviceId: 9001,
    name: 'Test User',
    position: 1,
    estimatedWait: 0,
    status: 'Almost Ready',
    serviceName: 'SQL Fixture',
    priority: 'standard',
  };

  const calls = [];
  const queuesRepository = {
    async listActiveEntriesByService(serviceId) {
      calls.push(['list', serviceId]);
      return [storedEntry];
    },
    async findActiveEntryForUser(userId) {
      calls.push(['mine', userId]);
      return userId === 2 ? storedEntry : null;
    },
    async joinQueue(args) {
      calls.push(['join', args]);
      return storedEntry;
    },
    async finishEntry(args) {
      calls.push(['finish', args]);
      return { ...storedEntry, outcome: args.outcome };
    },
    async serveNext(args) {
      calls.push(['serve', args]);
      return { ...storedEntry, outcome: 'Served' };
    },
    async adjustEntry(args) {
      calls.push(['adjust', args]);
      return [storedEntry];
    },
  };

  const { app } = createApp({
    authStorage: 'mysql',
    servicesStorage: 'mysql',
    queueStorage: 'mysql',
    usersRepository,
    servicesRepository,
    queuesRepository,
  });

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = 'GET', token = adminToken, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${base}/api${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    return { status: response.status, json: await response.json() };
  }

  await t.test('health reports SQL queue storage', async () => {
    const result = await request('/health', { token: null });

    assert.equal(result.json.data.storage, 'mixed');
    assert.equal(result.json.data.queueStorage, 'mysql');
  });

  await t.test('queue routes are no longer blocked by the service-testing gate', async () => {
    const joined = await request('/services/9001/queue', {
      method: 'POST',
      token: userToken,
      body: {},
    });

    assert.equal(joined.status, 201);
    assert.equal(joined.json.data.position, 1);
    assert.deepEqual(
      calls.find(([name]) => name === 'join'),
      ['join', { userId: 2, serviceId: 9001 }],
    );
  });

  await t.test('queue reads come from the repository', async () => {
    const mine = await request('/queues/me', { token: userToken });
    assert.equal(mine.status, 200);
    assert.equal(mine.json.data.id, 5001);

    const queue = await request('/services/9001/queue');
    assert.equal(queue.status, 200);
    assert.equal(queue.json.data[0].id, 5001);
  });

  await t.test('admin-only queue actions still enforce roles', async () => {
    for (const [path, method] of [
      ['/services/9001/serve-next', 'POST'],
      ['/admin/queue-entries/5001', 'DELETE'],
    ]) {
      const result = await request(path, {
        method,
        token: userToken,
        ...(method === 'POST' ? { body: {} } : {}),
      });
      assert.equal(result.status, 403);
    }
  });

  await t.test('state serves SQL queue data and leaves history to Member 4', async () => {
    const asUser = await request('/state', { token: userToken });
    assert.equal(asUser.status, 200);
    assert.equal(asUser.json.data.currentQueue.id, 5001);
    assert.deepEqual(asUser.json.data.queueEntries, []);
    // Member 4 owns history persistence; the seam stays visible until then.
    assert.deepEqual(asUser.json.data.history, []);

    const asAdmin = await request('/state');
    assert.equal(asAdmin.json.data.queueEntries[0].id, 5001);
    assert.equal(asAdmin.json.data.currentQueue, null);
  });

  await t.test('an invalid queue body is rejected before reaching the repository', async () => {
    const before = calls.length;

    const result = await request('/admin/queue-entries/5001/priority', {
      method: 'PATCH',
      body: { priority: 'urgent' },
    });

    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'VALIDATION_ERROR');
    assert.equal(calls.length, before);
  });
});
