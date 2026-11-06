import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';

import { createApp } from '../src/app.js';
import * as repository from '../src/repositories/activity.repo.js';
import {
  createSqlHistory,
  createSqlNotifications,
  createQueueActivity,
} from '../src/modules/activitySql.js';
import { fail } from '../src/shared/errors.js';

const joinedAt = '2026-11-05T12:00:00.000Z';
const endedAt = '2026-11-05T12:10:00.000Z';

const service = { id: 30, name: 'Tickets' };
const entry = { id: 50, userId: 10, joinedAt };

test('SQL activity adapters preserve the contract and caller transaction', async () => {
  const calls = [];

  const methods = [
    'createHistoryForJoin',
    'completeHistory',
    'listHistoryForUser',
    'emitNotification',
    'listNotificationsForUser',
    'markNotificationRead',
  ];

  const repo = Object.fromEntries(
    methods.map((name) => [
      name,
      async (...args) => {
        calls.push({ name, args });
        return args[0];
      },
    ]),
  );

  const history = createSqlHistory(repo, () => endedAt);
  const notifications = createSqlNotifications(repo);
  const activity = createQueueActivity(history, notifications);

  const connection = { execute() {} };

  const ordered = [
    entry,
    { id: 51, userId: 11 },
    { id: 52, userId: 12 },
  ];

  await activity.joined(
    { entry, service, ordered },
    connection,
  );

  assert.deepEqual(
    calls.map((call) => call.name),
    [
      'createHistoryForJoin',
      'emitNotification',
      'emitNotification',
      'emitNotification',
    ],
  );

  assert.ok(
    calls.every((call) => call.args[1] === connection),
  );

  assert.deepEqual(calls[0].args[0], {
    entryId: 50,
    userId: 10,
    serviceId: 30,
    serviceName: 'Tickets',
    joinedAt,
  });

  assert.deepEqual(
    calls.slice(1).map((call) => call.args[0].event),
    ['joined', 'almost-ready', 'almost-ready'],
  );

  assert.deepEqual(
    calls.slice(2).map((call) => call.args[0].entryId),
    [50, 51],
  );

  calls.length = 0;

  await activity.finished(
    {
      entry,
      service,
      outcome: 'Served',
      ordered: [],
    },
    connection,
  );

  assert.deepEqual(
    calls.map((call) => call.name),
    ['completeHistory', 'emitNotification'],
  );

  assert.deepEqual(calls[0].args[0], {
    entryId: 50,
    outcome: 'Served',
    endedAt,
  });

  assert.equal(calls[1].args[0].event, 'Served');

  assert.equal(await history.list(10), 10);
  assert.equal(await notifications.list(10), 10);

  assert.deepEqual(
    await notifications.markRead(10, 80),
    { id: 80, userId: 10 },
  );
});

test('queue activity refuses a missing connection or a pool and propagates failures', async () => {
  const broken = createQueueActivity(
    {
      async joined() {
        throw new Error('database unavailable');
      },
    },
    {},
  );

  const invalidConnections = [
    undefined,
    {},
    { execute() {}, getConnection() {} },
  ];

  for (const connection of invalidConnections) {
    await assert.rejects(
      () => broken.joined(
        { entry, service, ordered: [] },
        connection,
      ),
      /transaction connection/,
    );

    await assert.rejects(
      () => broken.finished(
        {
          entry,
          service,
          outcome: 'Served',
          ordered: [],
        },
        connection,
      ),
      /transaction connection/,
    );
  }

  await assert.rejects(
    () => broken.joined(
      { entry, service, ordered: [] },
      { execute() {} },
    ),
    /database unavailable/,
  );

  const history = createSqlHistory({
    completeHistory: async (input) => input,
  });

  const result = await history.finish(entry, 'Left Queue');

  assert.ok(Number.isFinite(Date.parse(result.endedAt)));
});

test('activity repository rejects malformed fields before SQL and preserves database errors', async () => {
  const noSQL = {
    execute() {
      throw new Error('SQL must not run for invalid data');
    },
  };

  const valid = {
    entryId: 50,
    userId: 10,
    serviceId: 30,
    serviceName: 'Tickets',
    joinedAt,
  };

  const invalid = {
    status: 400,
    code: 'VALIDATION_ERROR',
  };

  const invalidHistoryFields = [
    { entryId: 0 },
    { userId: '10' },
    { serviceId: -1 },
    { serviceName: '' },
    { serviceName: 'X'.repeat(101) },
    { joinedAt: 'not-a-date' },
    { joinedAt: null },
  ];

  for (const patch of invalidHistoryFields) {
    await assert.rejects(
      () => repository.createHistoryForJoin(
        { ...valid, ...patch },
        noSQL,
      ),
      invalid,
    );
  }

  await assert.rejects(
    () => repository.completeHistory(
      { entryId: 50, outcome: 'invalid', endedAt },
      noSQL,
    ),
    invalid,
  );

  await assert.rejects(
    () => repository.completeHistory(
      { entryId: 50, outcome: 'Served', endedAt: {} },
      noSQL,
    ),
    invalid,
  );

  const invalidNotificationFields = [
    { event: 'arbitrary' },
    { message: '' },
    { message: 'X'.repeat(501) },
    { userId: 0 },
    { entryId: NaN },
  ];

  for (const patch of invalidNotificationFields) {
    await assert.rejects(
      () => repository.emitNotification(
        {
          userId: 10,
          entryId: 50,
          event: 'joined',
          message: 'Hi',
          ...patch,
        },
        noSQL,
      ),
      invalid,
    );
  }

  await assert.rejects(
    () => repository.listHistoryForUser(0, noSQL),
    invalid,
  );

  await assert.rejects(
    () => repository.listNotificationsForUser('10', noSQL),
    invalid,
  );

  await assert.rejects(
    () => repository.markNotificationRead(
      { id: 0, userId: 10 },
      noSQL,
    ),
    invalid,
  );

  await assert.rejects(
    () => repository.markNotificationRead(
      { id: 1, userId: 0 },
      noSQL,
    ),
    invalid,
  );

  const error = new Error('connection unavailable');

  await assert.rejects(
    () => repository.createHistoryForJoin(valid, {
      execute: async () => {
        throw error;
      },
    }),
    (received) => received === error,
  );
});

test('activity storage rejects incompatible configuration', () => {
  assert.throws(
    () => createApp({ activityStorage: 'unknown' }),
    /Invalid ACTIVITY_STORAGE/,
  );

  assert.throws(
    () => createApp({ activityStorage: 'mysql' }),
    /SQL activity requires/,
  );

  assert.throws(
    () => createApp({
      authStorage: 'mysql',
      activityStorage: 'mysql',
    }),
    /SQL activity requires/,
  );
});

test('SQL activity HTTP routes await repositories and enforce identity, roles and body validation', async (t) => {
  const tokens = {
    user: 'a'.repeat(64),
    other: 'b'.repeat(64),
    admin: 'c'.repeat(64),
  };

  const users = [
    { id: 10, name: 'User', role: 'user' },
    { id: 11, name: 'Other', role: 'user' },
    { id: 12, name: 'Admin', role: 'admin' },
  ];

  const sessions = new Map(
    Object.values(tokens).map((token, index) => [
      createHash('sha256').update(token).digest('hex'),
      {
        user: users[index],
        expiresAt: Date.now() + 60000,
      },
    ]),
  );

  const records = [
    {
      id: 50,
      userId: 10,
      serviceId: 30,
      serviceName: 'Original name',
      joinedAt,
      endedAt,
      outcome: 'Served',
    },
  ];

  const notices = [
    {
      id: 80,
      userId: 10,
      entryId: 50,
      message: 'Served',
      event: 'Served',
      read: false,
      type: 'info',
      createdAt: endedAt,
    },
  ];

  let broken = false;

  const activityRepository = {
    async listHistoryForUser(id) {
      if (broken) {
        throw new Error('SQL unavailable');
      }

      return records.filter((record) => record.userId === id);
    },

    async listNotificationsForUser(id) {
      return notices.filter((notice) => notice.userId === id);
    },

    async markNotificationRead({ id, userId }) {
      const row = notices.find(
        (notice) =>
          notice.id === id && notice.userId === userId,
      );

      if (!row) {
        fail(
          404,
          'NOTIFICATION_NOT_FOUND',
          'Notification not found.',
        );
      }

      row.read = true;
      return { ...row };
    },
  };

  const { app } = createApp({
    authStorage: 'mysql',
    servicesStorage: 'mysql',
    activityStorage: 'mysql',

    usersRepository: {
      findSession: async (hash) => sessions.get(hash),
    },

    servicesRepository: {
      listServices: async () => [],
    },

    activityRepository,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  await once(server, 'listening');

  async function call(
    path,
    token = tokens.user,
    method = 'GET',
    body,
  ) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api${path}`,
      {
        method,

        headers: {
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),

          ...(body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },

        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body) }),
      },
    );

    return {
      status: response.status,
      ...await response.json(),
    };
  }

  // Authentication is required.
  for (const path of ['/history', '/notifications']) {
    assert.equal((await call(path, null)).status, 401);
  }

  // Query parameters cannot change the authenticated identity.
  assert.deepEqual(
    (await call('/history?userId=11')).data,
    records,
  );

  // Other users cannot see this user's records.
  assert.deepEqual(
    (await call('/history', tokens.other)).data,
    [],
  );

  assert.deepEqual(
    (await call('/notifications', tokens.other)).data,
    [],
  );

  assert.equal(
    (await call('/history', tokens.admin)).status,
    403,
  );

  assert.deepEqual(
    (await call('/notifications', tokens.admin)).data,
    [],
  );

  // State includes history only for the signed-in user.
  assert.deepEqual(
    (await call('/state')).data.history,
    records,
  );

  assert.deepEqual(
    (await call('/state', tokens.admin)).data.history,
    [],
  );

  assert.equal(
    (await call('/health', null)).data.activityStorage,
    'mysql',
  );

  assert.equal(
    (await call('/health', null)).data.queueStorage,
    'disabled',
  );

  // Users cannot mark another user's notification read.
  assert.equal(
    (
      await call(
        '/notifications/80/read',
        tokens.other,
        'PATCH',
        {},
      )
    ).status,
    404,
  );

  assert.equal(notices[0].read, false);

  // Reject extra body fields and malformed IDs.
  assert.equal(
    (
      await call(
        '/notifications/80/read',
        tokens.user,
        'PATCH',
        { userId: 11 },
      )
    ).status,
    400,
  );

  assert.equal(
    (
      await call(
        '/notifications/bad/read',
        tokens.user,
        'PATCH',
        {},
      )
    ).status,
    400,
  );

  assert.equal(
    (
      await call(
        '/notifications/80/read',
        null,
        'PATCH',
        {},
      )
    ).status,
    401,
  );

  // The owner can mark the notification read.
  assert.equal(
    (
      await call(
        '/notifications/80/read',
        tokens.user,
        'PATCH',
        {},
      )
    ).data.read,
    true,
  );

  // Unfinished SQL queue actions remain blocked.
  assert.equal(
    (
      await call(
        '/services/30/queue',
        tokens.user,
        'POST',
        {},
      )
    ).status,
    503,
  );

  // Internal database errors return a generic response.
  broken = true;

  const failed = await call('/history');

  assert.equal(failed.status, 500);
  assert.equal(failed.error.message, 'Unexpected server error.');
});