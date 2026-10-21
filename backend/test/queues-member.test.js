import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

async function setup(t) {
  const { app } = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(path, method = 'GET', body, token) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, ...await response.json() };
  }
  async function login(email, password) {
    const result = await call('/auth/login', 'POST', { email, password });
    assert.equal(result.status, 200);
    return result.data.token;
  }
  const admin = await login('admin@queuesmart.com', 'Admin1234');
  const users = [await login('user@queuesmart.com', 'User1234')];
  for (let i = 1; i < 4; i++) {
    const email = `queue${i}@example.com`;
    assert.equal((await call('/auth/register', 'POST', {
      name: `Queue User ${i}`, email, password: 'Password1',
    })).status, 201);
    users.push(await login(email, 'Password1'));
  }
  const join = async (user, service = 1) => {
    const result = await call(`/services/${service}/queue`, 'POST', {}, user);
    assert.equal(result.status, 201);
    return result.data;
  };
  const queue = async (service = 1) => {
    const result = await call(`/services/${service}/queue`, 'GET', undefined, admin);
    assert.equal(result.status, 200);
    return result.data;
  };
  return { call, admin, users, join, queue };
}

for (const services of [[1, 1], [1, 2]]) {
  test(`simultaneous joins into ${services.join('/')} allow one active participation`, async t => {
    const { call, users, queue } = await setup(t);
    const results = await Promise.all(services.map(id => call(`/services/${id}/queue`, 'POST', {}, users[0])));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    assert.equal(results.find(r => r.status === 409).error.code, 'ALREADY_QUEUED');
    assert.equal((await queue(1)).length + (await queue(2)).length, 1);
    assert.equal((await call('/history', 'GET', undefined, users[0])).data.length, 1);
  });
}

test('FIFO, priority, manual overrides, positions, waits and service isolation', async t => {
  const { call, admin, users, join, queue } = await setup(t);
  const first = await join(users[0]), second = await join(users[1]), third = await join(users[2]);
  await join(users[3], 2);
  const otherQueue = await queue(2);
  assert.deepEqual((await queue()).map(e => e.id), [first.id, second.id, third.id]);
  assert.deepEqual((await queue()).map(e => [e.position, e.estimatedWait]), [[1, 0], [2, 12], [3, 24]]);
  const move = (id, direction) => call(`/admin/queue-entries/${id}/move`, 'POST', { direction }, admin);
  assert.equal((await move(first.id, 'up')).status, 409);
  assert.equal((await move(third.id, 'down')).status, 409);
  assert.equal((await move(second.id, 'up')).status, 200);
  assert.deepEqual((await queue()).map(e => e.id), [second.id, first.id, third.id]);
  assert.equal((await call(`/admin/queue-entries/${third.id}/priority`, 'PATCH', { priority: 'priority' }, admin)).status, 200);
  assert.deepEqual((await queue()).map(e => e.id), [third.id, second.id, first.id]);
  assert.equal((await move(third.id, 'down')).status, 409);
  assert.equal((await move(second.id, 'up')).status, 409);
  assert.equal((await call('/services/1', 'PATCH', { priority: 'high', expectedDuration: 5 }, admin)).status, 200);
  assert.deepEqual((await queue()).map(e => [e.id, e.estimatedWait]), [[third.id, 0], [second.id, 5], [first.id, 10]]);
  assert.deepEqual(await queue(2), otherQueue);
  assert.equal((await call('/services/1/serve-next', 'POST', {}, admin)).data.id, third.id);
  assert.equal((await call(`/queue-entries/${third.id}`, 'DELETE', undefined, users[2])).status, 404);
  assert.equal((await call('/queues/me', 'GET', undefined, users[2])).data, null);
  assert.equal((await call('/history', 'GET', undefined, users[2])).data[0].outcome, 'Served');
  assert.deepEqual(await queue(2), otherQueue);
});

test('identity, priority and ownership are enforced by HTTP authorization', async t => {
  const { call, admin, users, join, queue } = await setup(t);
  assert.equal((await call('/services/1/queue', 'POST', {}, admin)).status, 403);
  for (const body of [{ userId: 999 }, { id: 999 }, { priority: 'priority' }, { order: 0 }, { name: 'Someone else' }]) {
    assert.equal((await call('/services/1/queue', 'POST', body, users[0])).status, 400);
  }
  assert.equal((await queue()).length, 0);
  const entry = await join(users[0]);
  assert.equal(entry.priority, 'standard');
  const me = (await call('/auth/me', 'GET', undefined, users[0])).data;
  assert.equal(entry.userId, me.id);
  assert.equal(entry.name, me.name);
  assert.equal((await call(`/queue-entries/${entry.id}`, 'DELETE', undefined, users[1])).status, 403);
  for (const [path, method, body] of [
    ['/services/1/serve-next', 'POST', {}],
    [`/admin/queue-entries/${entry.id}`, 'DELETE'],
    [`/admin/queue-entries/${entry.id}/priority`, 'PATCH', { priority: 'priority' }],
    [`/admin/queue-entries/${entry.id}/move`, 'POST', { direction: 'up' }],
  ]) assert.equal((await call(path, method, body, users[0])).status, 403);
  assert.equal((await queue()).length, 1);
  const state = (await call('/state', 'GET', undefined, users[1])).data;
  assert.deepEqual(state.queueEntries, []);
  assert.equal(state.currentQueue, null);
  assert.equal((await call(`/queue-entries/${entry.id}`, 'DELETE', undefined, users[0])).data.outcome, 'Left Queue');
  assert.equal((await call('/queues/me', 'GET', undefined, users[0])).data, null);
  assert.notEqual((await join(users[0], 2)).id, entry.id);
});

test('closing preserves waiting entries, blocks join/serve and permits admin management and leave', async t => {
  const { call, admin, users, join, queue } = await setup(t);
  const first = await join(users[0]), second = await join(users[1]);
  const before = await queue();
  assert.equal((await call('/services/1', 'PATCH', { isOpen: false }, admin)).status, 200);
  assert.deepEqual(await queue(), before);
  for (const result of [await call('/services/1/queue', 'POST', {}, users[2]), await call('/services/1/serve-next', 'POST', {}, admin)]) {
    assert.equal(result.status, 409);
    assert.equal(result.error.code, 'QUEUE_CLOSED');
  }
  assert.equal((await call(`/admin/queue-entries/${second.id}/move`, 'POST', { direction: 'up' }, admin)).status, 200);
  assert.equal((await call(`/admin/queue-entries/${first.id}/priority`, 'PATCH', { priority: 'priority' }, admin)).status, 200);
  assert.equal((await call(`/queue-entries/${first.id}`, 'DELETE', undefined, users[0])).data.outcome, 'Left Queue');
  assert.equal((await call(`/admin/queue-entries/${second.id}`, 'DELETE', undefined, admin)).data.outcome, 'Removed');
  assert.equal((await queue()).length, 0);
  assert.equal((await call('/services/1', 'PATCH', { isOpen: true }, admin)).status, 200);
  assert.equal((await call('/services/1/serve-next', 'POST', {}, admin)).error.code, 'QUEUE_EMPTY');
  await join(users[2]);
});

test('unknown entries and services return 404 without changing queues', async t => {
  const { call, admin, users, join, queue } = await setup(t);
  await join(users[0]);
  const before = await queue();
  for (const [path, method, body, token] of [
    ['/queue-entries/999999', 'DELETE', undefined, users[0]],
    ['/admin/queue-entries/999999', 'DELETE', undefined, admin],
    ['/admin/queue-entries/999999/priority', 'PATCH', { priority: 'priority' }, admin],
    ['/admin/queue-entries/999999/move', 'POST', { direction: 'up' }, admin],
    ['/services/999999/queue', 'POST', {}, users[1]],
    ['/services/999999/queue', 'GET', undefined, admin],
    ['/services/999999/serve-next', 'POST', {}, admin],
  ]) assert.equal((await call(path, method, body, token)).status, 404);
  assert.deepEqual(await queue(), before);
});
