import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';
import { fail } from '../src/shared/errors.js';

test('A4 services API integration with injected repositories', async (t) => {
  const adminToken = 'a'.repeat(64);
  const userToken = 'b'.repeat(64);
  const hash = (token) =>
    createHash('sha256').update(token).digest('hex');

  const sessions = new Map([
    [hash(adminToken), {
      user: {
        id: 1,
        name: 'Test Admin',
        email: 'admin@example.test',
        role: 'admin',
      },
      expiresAt: Date.now() + 3600000,
    }],
    [hash(userToken), {
      user: {
        id: 2,
        name: 'Test User',
        email: 'user@example.test',
        role: 'user',
      },
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

  // Deliberately different from the old in-memory demo services.
  const rows = [{
    id: 9001,
    name: 'SQL Fixture',
    description: 'Service returned by the injected repository',
    expectedDuration: 10,
    priority: 'medium',
    isOpen: true,
    queueLength: 3,
  }];

  let nextId = 9002;
  let writes = 0;

  function findService(id) {
    const service = rows.find((row) => row.id === id);
    if (!service) {
      fail(404, 'SERVICE_NOT_FOUND', 'Service not found.');
    }
    return service;
  }

  function checkName(name, excludeId) {
    if (rows.some((row) =>
      row.id !== excludeId &&
      row.name.toLowerCase() === name.trim().toLowerCase()
    )) {
      fail(
        409,
        'SERVICE_NAME_CONFLICT',
        'A service with this name already exists.',
      );
    }
  }

  const servicesRepository = {
    async listServices() {
      return rows.map((row) => ({ ...row }));
    },

    async getServiceById(id) {
      return { ...findService(id) };
    },

    async createService(fields) {
      checkName(fields.name);
      const service = {
        id: nextId++,
        isOpen: true,
        ...fields,
        queueLength: 0,
      };
      rows.push(service);
      writes++;
      return { ...service };
    },

    async updateService(id, patch) {
      const service = findService(id);
      if (Object.hasOwn(patch, 'name')) {
        checkName(patch.name, id);
      }
      Object.assign(service, patch);
      writes++;
      return { ...service };
    },
  };

  const { app } = createApp({
    authStorage: 'mysql',
    servicesStorage: 'mysql',
    usersRepository,
    servicesRepository,
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

  async function request(path, {
    method = 'GET',
    token = adminToken,
    body,
  } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${base}/api${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    return {
      status: response.status,
      json: await response.json(),
    };
  }

  const validService = {
    name: 'API Created Service',
    description: 'Created through the service route',
    expectedDuration: 15,
    priority: 'high',
  };

  await t.test('health reports partial SQL integration', async () => {
    const result = await request('/health', { token: null });
    assert.equal(result.status, 200);
    assert.equal(result.json.data.storage, 'mixed');
    assert.equal(result.json.data.authStorage, 'mysql');
    assert.equal(result.json.data.servicesStorage, 'mysql');
    assert.equal(result.json.data.queueStorage, 'disabled');
  });

  await t.test('service reads require authentication', async () => {
    const result = await request('/services', { token: null });
    assert.equal(result.status, 401);
  });

  await t.test('list and state await repository data and use SQL counts', async () => {
    const result = await request('/services', { token: userToken });
    assert.equal(result.status, 200);
    assert.equal(result.json.data.length, 1);
    assert.equal(result.json.data[0].id, 9001);
    assert.equal(result.json.data[0].queueLength, 3);
    assert.equal(result.json.data[0].estimatedWait, 30);

    const state = await request('/state');
    assert.equal(state.status, 200);
    assert.deepEqual(state.json.data.services, result.json.data);
    assert.deepEqual(state.json.data.queueEntries, []);
    assert.equal(state.json.data.currentQueue, null);
    assert.deepEqual(state.json.data.history, []);
  });

  await t.test('regular users cannot create or update services', async () => {
    const before = writes;

    const create = await request('/services', {
      method: 'POST',
      token: userToken,
      body: validService,
    });
    assert.equal(create.status, 403);

    const update = await request('/services/9001', {
      method: 'PATCH',
      token: userToken,
      body: { isOpen: false },
    });
    assert.equal(update.status, 403);
    assert.equal(writes, before);
  });

  await t.test('admin creation and partial update return resolved data', async () => {
    const created = await request('/services', {
      method: 'POST',
      body: validService,
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.name, validService.name);
    assert.equal(typeof created.json.data.id, 'number');

    const updated = await request(`/services/${created.json.data.id}`, {
      method: 'PATCH',
      body: { isOpen: false },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.data.isOpen, false);
    assert.equal(updated.json.data.expectedDuration, 15);
    assert.equal(updated.json.data.name, validService.name);
  });

  await t.test('invalid input never reaches repository writes', async () => {
    const before = writes;

    for (const duration of [0, 481, 1.5, '10']) {
      const result = await request('/services', {
        method: 'POST',
        body: { ...validService, expectedDuration: duration },
      });
      assert.equal(result.status, 400);
    }

    const emptyPatch = await request('/services/9001', {
      method: 'PATCH',
      body: {},
    });
    assert.equal(emptyPatch.status, 400);
    assert.equal(writes, before);
  });

  await t.test('repository conflicts and missing IDs reach the client', async () => {
    const duplicate = await request('/services', {
      method: 'POST',
      body: { ...validService, name: 'sql fixture' },
    });
    assert.equal(duplicate.status, 409);

    const missing = await request('/services/999999', {
      method: 'PATCH',
      body: { isOpen: false },
    });
    assert.equal(missing.status, 404);
  });

  await t.test('duration edits refresh estimated wait', async () => {
    const updated = await request('/services/9001', {
      method: 'PATCH',
      body: { expectedDuration: 20 },
    });
    assert.equal(updated.status, 200);

    const result = await request('/services');
    const service = result.json.data.find((row) => row.id === 9001);
    assert.equal(service.queueLength, 3);
    assert.equal(service.estimatedWait, 60);
  });

  await t.test('unfinished features are blocked in service-testing mode', async () => {
    for (const path of ['/queues/me', '/notifications', '/history']) {
      const result = await request(path, { token: userToken });
      assert.equal(result.status, 503);
    }

    const join = await request('/services/9001/queue', {
      method: 'POST',
      token: userToken,
      body: {},
    });
    assert.equal(join.status, 503);
  });

  await t.test('authentication routes remain accessible and logout revokes access', async () => {
    const me = await request('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.json.data.role, 'admin');

    const logout = await request('/auth/logout', {
      method: 'POST',
      body: {},
    });
    assert.equal(logout.status, 200);
    assert.equal(logout.json.data.loggedOut, true);

    const afterLogout = await request('/services');
    assert.equal(afterLogout.status, 401);
  });
});