// MEMBER 1: authentication and validation boundary cases.
// owned by the Authentication/Validation work package; see docs/TEAM_PLAN.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { createAuth } from '../src/modules/auth.js';

// register/login are async (scrypt is awaited); authenticate/logout are not.
const rejects = (promise, status, field) => assert.rejects(promise, error => {
  assert.equal(error.status, status);
  if (field) assert.ok(error.fields[field], `expected a "${field}" field error`);
  return true;
});
const throws = (fn, status) => assert.throws(fn, e => e.status === status);

// runs `fn` in its own microtask so a synchronous throw and a rejected promise
// are observed identically. This keeps the concurrency test honest against both
// the synchronous reference implementation and the asynchronous one.
const attempt = fn => Promise.resolve().then(fn);

const SEEDED_USER = { email: 'user@queuesmart.com', password: 'User1234' };
const SEEDED_ADMIN = { email: 'admin@queuesmart.com', password: 'Admin1234' };

test('two simultaneous registrations for one email yield a single account', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const body = () => ({ name: 'Race Condition', email: 'race@example.com', password: 'Password1' });

  const results = await Promise.allSettled([
    attempt(() => auth.register(body())),
    attempt(() => auth.register(body())),
  ]);

  const created = results.filter(r => r.status === 'fulfilled');
  const refused = results.filter(r => r.status === 'rejected');

  assert.equal(created.length, 1, 'exactly one registration should succeed');
  assert.equal(refused.length, 1, 'the losing registration should be refused');
  assert.equal(refused[0].reason.status, 409);
  assert.equal(refused[0].reason.code, 'EMAIL_EXISTS');
  assert.equal(store.users.filter(u => u.email === 'race@example.com').length, 1,
    'the store must never hold two users with the same email');
});

test('a rejected registration does not block a later attempt at the same email', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const email = 'retry@example.com';

  // every reachable failure is a validation error raised before the email is
  // claimed, so none of them may leave the address unusable.
  await rejects(auth.register({ name: '', email, password: 'Password1' }), 400, 'name');
  await rejects(auth.register({ name: 'Retry', email, password: 'short' }), 400, 'password');
  await rejects(auth.register({ name: 'Retry', email, password: 'Password1', role: 'admin' }), 400, 'role');

  const created = await auth.register({ name: 'Retry', email, password: 'Password1' });
  assert.equal(created.email, email);
  assert.equal((await auth.login({ email, password: 'Password1' })).user.id, created.id);

  await rejects(auth.register({ name: 'Y', email, password: 'Password1' }), 409);
  assert.equal(store.users.filter(u => u.email === email).length, 1);
});

// not covered: the `finally` that releases a claim when the awaited hash itself
// rejects. `claiming` is closure-private and scrypt has no reachable failure
// mode here, so that path cannot be driven through the public API. It matters
// only if hashing starts throwing, which would need a seam to inject.

test('password length is rejected at 7 and 129, accepted at 8 and 128', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const chars = n => 'a'.repeat(n);
  const register = (email, password) => auth.register({ name: 'Boundary', email, password });

  await rejects(register('short@example.com', chars(7)), 400, 'password');
  await rejects(register('long@example.com', chars(129)), 400, 'password');
  assert.equal(store.users.filter(u => u.name === 'Boundary').length, 0,
    'a password outside the bounds must not create an account');

  assert.equal((await register('min@example.com', chars(8))).email, 'min@example.com');
  assert.equal((await register('max@example.com', chars(128))).email, 'max@example.com');

  // Both accepted lengths must survive the hash/verify round trip.
  for (const [email, password] of [['min@example.com', chars(8)], ['max@example.com', chars(128)]])
    assert.equal((await auth.login({ email, password })).user.email, email);

  // login applies the same bounds, and does so before looking up the account,
  // so an out-of-range password is a 400 rather than a 401.
  await rejects(auth.login({ email: 'min@example.com', password: chars(7) }), 400, 'password');
  await rejects(auth.login({ email: 'min@example.com', password: chars(129) }), 400, 'password');

  // passwords are never trimmed: surrounding space is significant.
  await rejects(auth.login({ email: 'min@example.com', password: ` ${chars(7)}` }), 401);
});

test('a whitespace-only name is rejected and the stored name is trimmed', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const seeded = store.users.length;

  for (const name of ['', ' ', '   ', '\t', '\n', ' \t\n '])
    await rejects(auth.register({ name, email: 'blank@example.com', password: 'Password1' }), 400, 'name');
  assert.equal(store.users.length, seeded, 'no account should have been created');

  const user = await auth.register({ name: '  Padded Name  ', email: 'blank@example.com', password: 'Password1' });
  assert.equal(user.name, 'Padded Name');

  // 100 characters is the limit; 101 is refused.
  await rejects(auth.register({ name: 'n'.repeat(101), email: 'long.name@example.com', password: 'Password1' }), 400, 'name');
  assert.equal((await auth.register({ name: 'n'.repeat(100), email: 'long.name@example.com', password: 'Password1' })).name.length, 100);
});

test('email canonicalisation makes case and surrounding space a duplicate', async () => {
  const store = createStore();
  const auth = createAuth(store);

  const created = await auth.register({ name: 'Case', email: '  Mixed.Case@Example.COM  ', password: 'Password1' });
  assert.equal(created.email, 'mixed.case@example.com', 'email is stored canonicalised');

  for (const email of ['mixed.case@example.com', 'MIXED.CASE@EXAMPLE.COM', 'Mixed.Case@Example.Com', '  mixed.case@example.com  '])
    await rejects(auth.register({ name: 'Duplicate', email, password: 'Password1' }), 409);
  assert.equal(store.users.filter(u => u.email === 'mixed.case@example.com').length, 1);

  // the same variants must resolve to that one account at login.
  for (const email of ['MIXED.CASE@EXAMPLE.COM', ' Mixed.Case@Example.com '])
    assert.equal((await auth.login({ email, password: 'Password1' })).user.id, created.id);
});

test('a session is valid up to its final millisecond and rejected exactly at expiry', async () => {
  let now = 1000;
  const store = createStore();
  const auth = createAuth(store, { now: () => now, ttl: 1000 });

  const { token, expiresAt } = await auth.login(SEEDED_USER);
  assert.equal(expiresAt, new Date(2000).toISOString());

  now = 1999; // one millisecond before expiry.
  assert.equal(auth.authenticate(token).email, SEEDED_USER.email);

  now = 2000; // exactly at expiry: `expiresAt <= now()` rejects.
  throws(() => auth.authenticate(token), 401);
  assert.equal(store.sessions.size, 0, 'the expired session should be discarded, not merely refused');
});

test('logout revokes only its own token and is safe to repeat', async () => {
  const store = createStore();
  const auth = createAuth(store);

  const first = await auth.login(SEEDED_USER);
  const second = await auth.login(SEEDED_USER);
  assert.notEqual(first.token, second.token);

  auth.logout(first.token);
  throws(() => auth.authenticate(first.token), 401);
  assert.equal(auth.authenticate(second.token).role, 'user',
    'the account\'s other session must survive');

  auth.logout(first.token); // repeating a logout is a no-op, not an error.
  auth.logout('never-issued');
  throws(() => auth.authenticate('never-issued'), 401);
  throws(() => auth.authenticate(undefined), 401);
});

test('expectedRole must match the stored role', async () => {
  const auth = createAuth(createStore());

  // right credentials, wrong role: refused as 401, never 403, so the response
  // does not reveal that the account exists.
  await rejects(auth.login({ ...SEEDED_USER, expectedRole: 'admin' }), 401);
  await rejects(auth.login({ ...SEEDED_ADMIN, expectedRole: 'user' }), 401);

  // a role outside the enum is a validation error.
  await rejects(auth.login({ ...SEEDED_USER, expectedRole: 'staff' }), 400, 'expectedRole');
  await rejects(auth.login({ ...SEEDED_USER, expectedRole: null }), 400, 'expectedRole');

  assert.equal((await auth.login({ ...SEEDED_USER, expectedRole: 'user' })).user.role, 'user');
  assert.equal((await auth.login({ ...SEEDED_ADMIN, expectedRole: 'admin' })).user.role, 'admin');
  // omitting expectedRole is allowed and matches either role.
  assert.equal((await auth.login(SEEDED_ADMIN)).user.role, 'admin');
});

test('registration payloads cannot set role, id or any other unknown field', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const base = { name: 'Escalation', email: 'escalate@example.com', password: 'Password1' };

  for (const [field, value] of [
    ['role', 'admin'], ['id', 99], ['salt', 'x'], ['digest', 'x'], ['createdAt', 1],
  ]) await rejects(auth.register({ ...base, [field]: value }), 400, field);

  assert.equal(store.users.length, 2, 'only the two seeded accounts should exist');

  // a clean registration is always a plain user, and the ID is server-assigned.
  const created = await auth.register(base);
  assert.equal(created.role, 'user');
  assert.notEqual(created.id, 99);
  assert.equal(store.users.filter(u => u.role === 'admin').length, 1,
    'public registration must not add an administrator');

  // login rejects unknown fields too.
  await rejects(auth.login({ ...SEEDED_USER, role: 'admin' }), 400, 'role');
  // a non-object body is refused before any field is read.
  for (const body of [null, undefined, 'string', 42, []])
    await rejects(auth.register(body), 400);
});

test('no auth response or thrown error exposes credential material', async () => {
  const store = createStore();
  const auth = createAuth(store);
  const password = 'Password1';

  const registered = await auth.register({ name: 'Secret', email: 'secret@example.com', password });
  const stored = store.users.find(u => u.email === 'secret@example.com');
  assert.ok(stored.salt && stored.digest, 'the store itself does keep the credentials');

  const session = await auth.login({ email: 'secret@example.com', password });
  const authenticated = auth.authenticate(session.token);

  for (const payload of [registered, session, session.user, authenticated]) {
    assert.deepEqual(
      Object.keys(payload).filter(k => ['salt', 'digest', 'password'].includes(k)), [],
      'no credential key may appear on a returned object');
    const text = JSON.stringify(payload);
    assert.ok(!text.includes(stored.salt), 'the salt must not be serialisable from a response');
    assert.ok(!text.includes(stored.digest), 'the digest must not be serialisable from a response');
    assert.ok(!text.includes(password), 'the password must not be echoed back');
  }

  // a failed login must not leak it either.
  await assert.rejects(auth.login({ email: 'secret@example.com', password: 'WrongPass1' }), error => {
    const text = JSON.stringify({ message: error.message, fields: error.fields });
    assert.ok(!text.includes(stored.salt) && !text.includes(stored.digest));
    return error.status === 401;
  });
});

test('HTTP responses never carry credential material and preserve auth status codes', async t => {
  const { app, store } = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const call = async (path, method = 'GET', body, token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, text: await response.text() };
  };

  const password = 'Password1';
  const created = await call('/auth/register', 'POST', { name: 'Wire', email: 'wire@example.com', password });
  assert.equal(created.status, 201);
  const stored = store.users.find(u => u.email === 'wire@example.com');

  const signedIn = await call('/auth/login', 'POST', { email: 'wire@example.com', password });
  assert.equal(signedIn.status, 200);
  const token = JSON.parse(signedIn.text).data.token;

  const me = await call('/auth/me', 'GET', undefined, token);
  assert.equal(me.status, 200);

  for (const { text } of [created, signedIn, me]) {
    for (const secret of [stored.salt, stored.digest, password])
      assert.ok(!text.includes(secret), `response body leaked credential material: ${text}`);
    assert.ok(!/"(salt|digest|password)"\s*:/.test(text), `response body exposed a credential key: ${text}`);
  }

  // status codes the acceptance criteria call out.
  assert.equal((await call('/auth/login', 'POST', { email: 'wire@example.com', password: 'WrongPass1' })).status, 401);
  assert.equal((await call('/auth/register', 'POST', { name: 'Dup', email: 'wire@example.com', password })).status, 409);
  assert.equal((await call('/auth/register', 'POST', { name: 'Esc', email: 'esc@example.com', password, role: 'admin' })).status, 400);
  assert.equal((await call('/services', 'POST', { name: 'X' }, token)).status, 403, 'a user cannot reach an admin route');
  assert.equal((await call('/auth/me')).status, 401);

  // a revoked token stops working on the next request.
  assert.equal((await call('/auth/logout', 'POST', {}, token)).status, 200);
  assert.equal((await call('/auth/me', 'GET', undefined, token)).status, 401);
});
