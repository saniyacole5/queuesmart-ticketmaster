import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
// Real HTTP integration checks: auth, permissions, JSON/type/length failures, UI state.
test('HTTP contracts and end-to-end A3 workflow', async t => {
  const { app } = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(path, method = 'GET', body, token, raw = false) {
    const response = await fetch(base + path, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }) });
    return { status: response.status, ...await response.json() };
  }
  const login = async (email, password) => (await call('/auth/login', 'POST', { email, password })).data;
  assert.equal((await call('/health')).status, 200);
  assert.equal((await call('/services')).status, 401);
  assert.equal((await call('/auth/register', 'POST', { name: 'New', email: 'new@x.com', password: 'Password1' })).status, 201);
  const user = await login('user@queuesmart.com', 'User1234'), admin = await login('admin@queuesmart.com', 'Admin1234');
  const other = await login('new@x.com', 'Password1');
  const u = user.token, a = admin.token;
  assert.equal((await call('/auth/me', 'GET', undefined, u)).data.role, 'user');
  assert.equal((await call('/services', 'GET', undefined, u)).data.length, 3);
  const body = { name: 'Event', description: 'Tickets', expectedDuration: 8, priority: 'medium' };
  assert.equal((await call('/services', 'POST', body, u)).status, 403);
  const service = await call('/services', 'POST', body, a); assert.equal(service.status, 201);
  assert.equal((await call(`/services/${service.data.id}`, 'PATCH', { expectedDuration: 4 }, a)).status, 200);
  assert.equal((await call('/services/1', 'PATCH', { expectedDuration: '4' }, a)).status, 400);
  assert.equal((await call('/services/1', 'PATCH', { description: 'x'.repeat(501) }, a)).status, 400);
  assert.equal((await call('/services/-1', 'PATCH', {}, a)).status, 400);
  assert.equal((await call('/services/999', 'PATCH', { name: 'X' }, a)).status, 404);
  assert.equal((await call('/services/1/queue', 'POST', {}, a)).status, 403);
  const joined = await call('/services/1/queue', 'POST', {}, u); assert.equal(joined.status, 201);
  assert.equal((await call('/queues/me', 'GET', undefined, u)).data.id, joined.data.id);
  assert.equal((await call('/services/1/queue', 'GET', undefined, u)).status, 403);
  assert.equal((await call('/services/1/queue', 'GET', undefined, a)).data.length, 1);
  assert.equal((await call(`/queue-entries/${joined.data.id}`, 'DELETE', undefined, other.token)).status, 403);
  assert.equal((await call(`/admin/queue-entries/${joined.data.id}/priority`, 'PATCH', { priority: 'priority' }, a)).status, 200);
  assert.equal((await call(`/admin/queue-entries/${joined.data.id}/move`, 'POST', { direction: 'up' }, a)).status, 409);
  const state = (await call('/state', 'GET', undefined, u)).data;
  assert.equal(state.queueEntries.length, 0); assert.equal(state.currentQueue.position, 1); assert.equal(state.history.length, 1);
  assert.equal((await call('/state', 'GET', undefined, a)).data.queueEntries.length, 1);
  const n = (await call('/notifications', 'GET', undefined, u)).data[0];
  assert.equal((await call(`/notifications/${n.id}/read`, 'PATCH', {}, u)).data.read, true);
  assert.equal((await call(`/notifications/${n.id}/read`, 'PATCH', {}, other.token)).status, 404);
  assert.equal((await call('/services/1/serve-next', 'POST', {}, u)).status, 403);
  assert.equal((await call('/services/1/serve-next', 'POST', {}, a)).data.outcome, 'Served');
  assert.equal((await call('/history', 'GET', undefined, u)).data[0].outcome, 'Served');
  const rejoin = await call('/services/2/queue', 'POST', {}, u);
  assert.equal((await call(`/queue-entries/${rejoin.data.id}`, 'DELETE', undefined, u)).data.outcome, 'Left Queue');
  const again = await call('/services/1/queue', 'POST', {}, u);
  assert.equal((await call(`/admin/queue-entries/${again.data.id}`, 'DELETE', undefined, a)).data.outcome, 'Removed');
  assert.equal((await call('/missing', 'GET', undefined, a)).status, 404);
  assert.equal((await call('/auth/register', 'POST', '{', undefined, true)).error.code, 'INVALID_JSON');
  assert.equal((await call('/auth/register', 'POST', JSON.stringify({ name: 'x'.repeat(20000) }), undefined, true)).status, 413);
  assert.equal((await call('/auth/logout', 'POST', {}, u)).status, 200);
  assert.equal((await call('/auth/me', 'GET', undefined, u)).status, 401);
});
