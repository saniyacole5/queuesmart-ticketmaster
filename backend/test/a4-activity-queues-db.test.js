import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

const enabled = process.env.QUEUESMART_DB_TESTS === '1';

test('A4: SQL queue and activity integration', {
  skip: enabled ? false : 'Requires isolated local/CI MySQL and QUEUESMART_DB_TESTS=1.',
}, async (t) => {
  if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST) ||
      process.env.DB_NAME !== 'queuesmart_db') {
    throw new Error('Use a disposable local MySQL queuesmart_db for these tests.');
  }

  const { pool } = await import('../src/db/pool.js');
  const { createApp } = await import('../src/app.js');
  const { createFixtures } = await import('./helpers/queue-fixtures.js');
  const { createSqlAuth, hashPassword } = await import('../src/modules/authSql.js');
  const usersRepository = await import('../src/repositories/users.repo.js');
  const queueRepository = await import('../src/repositories/queues.repo.js');
  const fixtures = createFixtures(pool);

  t.after(async () => {
    try { await fixtures.cleanup(); }
    finally { await pool.end(); }
  });

  const password = 'ActivityIntegrationTest1';
  const { salt, digest } = await hashPassword(password);
  const auth = createSqlAuth(usersRepository);

  async function account(label, role = 'user') {
    const user = await fixtures.makeUser(label, role);
    await pool.execute(
      'UPDATE user_credentials SET password_salt = ?, password_digest = ? WHERE id = ?',
      [salt, digest, user.id],
    );
    const session = await auth.login({
      email: `${fixtures.prefix}-${label}@example.test`.toLowerCase(),
      password,
    });
    return { ...user, token: session.token };
  }

  async function launch() {
    const { app } = createApp({
      authStorage: 'mysql',
      servicesStorage: 'mysql',
      queueStorage: 'mysql',
      activityStorage: 'mysql',
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, url: `http://127.0.0.1:${server.address().port}/api` };
  }

  function stop(instance) {
    return new Promise((resolve) => {
      instance.server.close(resolve);
      instance.server.closeAllConnections();
    });
  }

  async function request(instance, path, token, method = 'GET', body) {
    const response = await fetch(instance.url + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, ...await response.json() };
  }

  await t.test('queue HTTP actions persist activity across restart and rejoin', async () => {
    const user = await account('http-user');
    const other = await account('http-other');
    const admin = await account('http-admin', 'admin');
    const service = await fixtures.makeService();
    const first = await launch();
    let entryId;
    let notificationId;

    try {
      const health = await request(first, '/health');
      assert.equal(health.data.storage, 'mysql');
      assert.equal(health.data.queueStorage, 'mysql');
      assert.equal(health.data.activityStorage, 'mysql');
      assert.equal((await request(first, '/not-a-route', user.token)).status, 404);
      assert.equal((await request(first, '/history')).status, 401);
      assert.equal((await request(first, '/history', admin.token)).status, 403);

      const joined = await request(first, `/services/${service.id}/queue`, user.token, 'POST', {});
      assert.equal(joined.status, 201);
      entryId = joined.data.id;
      assert.equal((await request(first, '/queues/me', user.token)).data.id, entryId);
      assert.equal((await request(first, '/history', user.token)).data[0].outcome, 'Waiting');

      const notices = (await request(first, '/notifications', user.token)).data;
      assert.deepEqual(notices.map((item) => item.event).sort(), ['almost-ready', 'joined']);
      notificationId = notices.find((item) => item.event === 'joined').id;
      assert.equal((await request(first, `/notifications/${notificationId}/read`, other.token, 'PATCH', {})).status, 404);
      assert.equal((await request(first, `/notifications/${notificationId}/read`, user.token, 'PATCH', {})).data.read, true);
      assert.deepEqual((await request(first, '/history', other.token)).data, []);
      assert.deepEqual((await request(first, '/notifications', other.token)).data, []);

      const adminState = (await request(first, '/state', admin.token)).data;
      assert.ok(adminState.queueEntries.some((entry) => entry.id === entryId));
      assert.deepEqual(adminState.history, []);
      assert.equal(adminState.currentQueue, null);

      const renamed = await request(first, `/services/${service.id}`, admin.token, 'PATCH', {
        name: `${service.name}-renamed`,
      });
      assert.equal(renamed.status, 200);
      const served = await request(first, `/services/${service.id}/serve-next`, admin.token, 'POST', {});
      assert.equal(served.status, 200);
      assert.equal(served.data.outcome, 'Served');

      const history = (await request(first, `/history?userId=${other.id}`, user.token)).data;
      assert.equal(history[0].outcome, 'Served');
      assert.equal(history[0].serviceName, service.name);
      assert.ok(history[0].endedAt);
      const [[stored]] = await pool.execute('SELECT ended_at FROM queue_entries WHERE id = ?', [entryId]);
      assert.equal(history[0].endedAt, new Date(stored.ended_at).toISOString());
      const state = (await request(first, '/state', user.token)).data;
      assert.deepEqual(state.history, history);
      assert.equal(state.currentQueue, null);
      const events = (await request(first, '/notifications', user.token)).data;
      assert.equal(events.filter((item) => item.event === 'Served').length, 1);
    } finally {
      await stop(first);
    }

    const second = await launch();
    try {
      assert.equal((await request(second, '/history', user.token)).data[0].outcome, 'Served');
      assert.equal((await request(second, '/queues/me', user.token)).data, null);
      const notices = (await request(second, '/notifications', user.token)).data;
      assert.equal(notices.find((item) => item.id === notificationId).read, true);

      const joined = await request(second, `/services/${service.id}/queue`, user.token, 'POST', {});
      assert.equal(joined.status, 201);
      assert.notEqual(joined.data.id, entryId);
      const left = await request(second, `/queue-entries/${joined.data.id}`, user.token, 'DELETE');
      assert.equal(left.status, 200);
      assert.equal(left.data.outcome, 'Left Queue');
      const history = (await request(second, '/history', user.token)).data;
      assert.deepEqual(history.map((record) => record.outcome), ['Left Queue', 'Served']);
      const noticesAfter = (await request(second, '/notifications', user.token)).data;
      assert.equal(noticesAfter.filter((item) => item.event === 'joined').length, 2);
      assert.equal(noticesAfter.filter((item) => item.event === 'almost-ready').length, 2);
    } finally {
      await stop(second);
    }
  });

  await t.test('missing activity history rolls back queue completion', async () => {
    const user = await fixtures.makeUser('missing-history');
    const service = await fixtures.makeService();
    const entry = await queueRepository.joinQueue({ userId: user.id, serviceId: service.id });
    await pool.execute('DELETE FROM history WHERE id = ?', [entry.id]);

    await assert.rejects(
      () => queueRepository.serveNext({ serviceId: service.id }),
      { status: 404, code: 'HISTORY_NOT_FOUND' },
    );
    const [[row]] = await pool.execute('SELECT status, ended_at FROM queue_entries WHERE id = ?', [entry.id]);
    assert.equal(row.status, 'waiting');
    assert.equal(row.ended_at, null);
    const [[events]] = await pool.execute(
      "SELECT COUNT(*) AS n FROM notifications WHERE entry_id = ? AND event = 'Served'",
      [entry.id],
    );
    assert.equal(Number(events.n), 0);
  });
});
