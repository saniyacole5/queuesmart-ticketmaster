import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createAuth, requireRole } from '../src/modules/auth.js';
import { createServices, getService } from '../src/modules/services.js';
import { createQueues } from '../src/modules/queues.js';
import { createHistory } from '../src/modules/history.js';
import { createNotifications } from '../src/modules/notifications.js';
import { estimateWait, orderEntries } from '../src/modules/waitTime.js';
const throws = (fn, status) => assert.throws(fn, e => e.status === status);
const rejects = (promise, status) => assert.rejects(promise, e => e.status === status);
function fixture() {
  const store = createStore(), services = createServices(store);
  let tick = 0;
  const clock = () => new Date(1700000000000 + tick++ * 1000).toISOString();
  const notifications = createNotifications(store, clock), history = createHistory(store, clock);
  const queues = createQueues(store, notifications, history, clock);
  const people = [1, 2, 3, 4].map(id => ({ id, name: `User ${id}`, role: 'user' }));
  return { store, services, notifications, history, queues, people };
}
// MEMBER 1
// register/login are async (scrypt is awaited), so these use rejects/await.
// authenticate/logout stay synchronous: they do no hashing.
test('auth: registration, canonical emails, hashed passwords, safe role and duplicate conflict', async () => {
  const store = createStore(), auth = createAuth(store);
  const user = await auth.register({ name: ' New ', email: ' NEW@example.com ', password: 'Password1' });
  assert.equal(user.name, 'New'); assert.equal(user.role, 'user');
  assert.equal(user.digest, undefined); assert.equal(store.users.at(-1).password, undefined);
  await rejects(auth.register({ name: 'X', email: 'new@example.com', password: 'Password1' }), 409);
  await rejects(auth.register({ name: 'X', email: 'x@x.com', password: 'Password1', role: 'admin' }), 400);
});
test('auth: credentials, role matching, expiring and revoked sessions', async () => {
  let now = 1000;
  const auth = createAuth(createStore(), { now: () => now, ttl: 1000 });
  for (const body of [
    { email: 'unknown@x.com', password: 'Password1' },
    { email: 'user@queuesmart.com', password: 'Wrong123' },
    { email: 'user@queuesmart.com', password: 'User1234', expectedRole: 'admin' },
  ]) await rejects(auth.login(body), 401);
  await rejects(auth.login({ email: 'user@queuesmart.com', password: 'User1234', expectedRole: 'staff' }), 400);
  const session = await auth.login({ email: 'user@queuesmart.com', password: 'User1234', expectedRole: 'user' });
  assert.equal(session.token.length, 64); assert.equal(auth.authenticate(session.token).role, 'user');
  throws(() => requireRole(session.user, 'admin'), 403); requireRole(session.user, 'user');
  now = 2000; throws(() => auth.authenticate(session.token), 401);
  const next = await auth.login({ email: 'admin@queuesmart.com', password: 'Admin1234' });
  auth.logout(next.token); throws(() => auth.authenticate(next.token), 401);
  throws(() => auth.authenticate('missing'), 401);
});
// MEMBER 2
test('services: create/update/list and validation cannot partially mutate existing service', () => {
  const { services, store } = fixture();
  const body = { name: 'Concert', description: 'Tickets', expectedDuration: 5, priority: 'high' };
  const created = services.create(body); assert.equal(created.isOpen, true); assert.equal(services.list().length, 4);
  assert.equal(services.update(created.id, { isOpen: false }).isOpen, false);
  const prior = { ...getService(store, 1) };
  for (const update of [{}, { name: 'Renamed', expectedDuration: '5' }, { priority: 'urgent' }, { isOpen: 'false' }, { id: 1 }]) throws(() => services.update(1, update), 400);
  assert.deepEqual(getService(store, 1), prior);
  throws(() => services.create({ ...body, expectedDuration: 481 }), 400);
  throws(() => services.update(999, { name: 'X' }), 404);
  const copy = services.list(); copy[0].name = 'Changed'; assert.equal(getService(store, 1).name, prior.name);
});
test('wait: zero at first position, linear estimate, rejects invalid inputs', () => {
  assert.equal(estimateWait(1, 12), 0); assert.equal(estimateWait(3, 12), 24);
  for (const args of [[0, 10], [1, 0], [1.5, 10], [2, 481], [2, '10']]) assert.throws(() => estimateWait(...args), RangeError);
});
test('priority ordering preserves arrival ties, does not mutate input', () => {
  const input = [{ id: 1, order: 1, priority: 'standard' }, { id: 2, order: 2, priority: 'priority' }, { id: 3, order: 1, priority: 'standard' }];
  assert.deepEqual(orderEntries(input).map(e => e.id), [2, 1, 3]); assert.equal(input[0].id, 1);
});
// MEMBER 3 + MEMBER 4
test('join/leave: identity, one active queue, closed queue, ownership, history, rejoin', () => {
  const { queues, people, history, notifications } = fixture();
  assert.equal(queues.mine(1), null);
  const a = queues.join(people[0], 1, {}); assert.equal(a.position, 1); assert.equal(a.estimatedWait, 0);
  assert.equal(history.list(1)[0].outcome, 'Waiting'); assert.equal(notifications.list(1).length, 2);
  throws(() => queues.join(people[0], 2, {}), 409);
  throws(() => queues.join(people[1], 3, {}), 409);
  throws(() => queues.join(people[1], 999, {}), 404);
  throws(() => queues.join(people[1], 1, { priority: 'priority' }), 400);
  throws(() => queues.leave(people[1], a.id), 403);
  assert.equal(queues.mine(1).id, a.id);
  queues.leave(people[0], a.id); assert.equal(queues.mine(1), null); assert.equal(history.list(1)[0].outcome, 'Left Queue');
  assert.ok(history.list(1)[0].endedAt); throws(() => queues.leave(people[0], a.id), 404);
  const b = queues.join(people[0], 2, {}); assert.notEqual(a.id, b.id); assert.equal(history.list(1).length, 2);
  assert.equal(history.list(2).length, 0);
});
test('serve: FIFO within priority tier, status and wait update, isolated services', () => {
  const { queues, people, history, services } = fixture();
  const a = queues.join(people[0], 1, {}), b = queues.join(people[1], 1, {}), c = queues.join(people[2], 1, {});
  queues.join(people[3], 2, {});
  assert.equal(queues.mine(3).status, 'Waiting'); assert.equal(queues.mine(3).estimatedWait, 24);
  queues.priority(c.id, { priority: 'priority' }); assert.equal(queues.mine(3).position, 1);
  assert.equal(queues.serve(1).id, c.id); assert.equal(queues.serve(1).id, a.id); assert.equal(queues.serve(1).id, b.id);
  assert.equal(history.list(3)[0].outcome, 'Served'); assert.equal(queues.snapshot(2).length, 1);
  throws(() => queues.serve(1), 409);
  services.update(2, { isOpen: false }); throws(() => queues.serve(2), 409);
});
test('manual reorder only within tier and service; removals record outcome', () => {
  const { queues, people, history } = fixture();
  const a = queues.join(people[0], 1, {}), b = queues.join(people[1], 1, {}), c = queues.join(people[2], 1, {});
  assert.equal(queues.move(b.id, { direction: 'up' })[0].id, b.id);
  assert.equal(queues.move(b.id, { direction: 'down' })[1].id, b.id);
  throws(() => queues.move(a.id, { direction: 'up' }), 409);
  throws(() => queues.move(a.id, { direction: 'sideways' }), 400);
  queues.priority(c.id, { priority: 'priority' }); throws(() => queues.move(c.id, { direction: 'down' }), 409);
  throws(() => queues.priority(c.id, { priority: 'urgent' }), 400);
  queues.remove(c.id); assert.equal(history.list(3)[0].outcome, 'Removed');
  throws(() => queues.remove(999), 404);
});
test('notifications: close threshold on transitions, deduplication, read ownership and rejoin', () => {
  const { queues, people, notifications } = fixture();
  const a = queues.join(people[0], 1, {}); queues.join(people[1], 1, {}); queues.join(people[2], 1, {});
  assert.equal(notifications.list(3).filter(n => n.event === 'almost-ready').length, 0);
  queues.serve(1);
  assert.equal(notifications.list(3).filter(n => n.event === 'almost-ready').length, 1);
  const list = notifications.list(3); const n = list[0];
  throws(() => notifications.markRead(2, n.id), 404); assert.equal(notifications.markRead(3, n.id).read, true);
  list[0].message = 'Changed'; assert.notEqual(notifications.list(3)[0].message, 'Changed');
  queues.priority(queues.mine(3).id, { priority: 'priority' });
  assert.equal(notifications.list(3).filter(n => n.event === 'almost-ready').length, 1);
  queues.join(people[0], 1, {});
  assert.equal(notifications.list(1).filter(n => n.event === 'joined').length, 2);
  assert.equal(notifications.list(2).some(n => n.entryId === a.id), false);
});
