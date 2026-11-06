import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const enabled = process.env.QUEUESMART_DB_TESTS === '1';

test(
  'A4 activity: real MySQL persistence, transactions, concurrency and HTTP ownership',
  {
    skip: enabled
      ? false
      : 'Requires disposable local/CI MySQL and QUEUESMART_DB_TESTS=1.',
  },
  async (t) => {
    if (
      !['127.0.0.1', 'localhost', '::1'].includes(
        process.env.DB_HOST,
      ) ||
      process.env.DB_NAME !== 'queuesmart_db'
    ) {
      throw new Error(
        'Use an isolated local MySQL queuesmart_db, never the shared Aiven database.',
      );
    }

    const { pool } = await import('../src/db/pool.js');
    const { withTransaction } = await import(
      '../src/db/transaction.js'
    );

    const repository = await import(
      '../src/repositories/activity.repo.js'
    );

    const {
      createSqlHistory,
      createSqlNotifications,
      createQueueActivity,
    } = await import('../src/modules/activitySql.js');

    const usersRepository = await import(
      '../src/repositories/users.repo.js'
    );

    const {
      createService,
      updateService,
    } = await import('../src/repositories/services.repo.js');

    const {
      hashPassword,
      createSqlAuth,
    } = await import('../src/modules/authSql.js');

    const { createApp } = await import('../src/app.js');

    const prefix = `activity-${randomUUID()}`;
    const users = [];
    const services = [];

    const joinedAt = '2026-11-05T12:00:00.000Z';
    const endedAt = '2026-11-05T12:15:00.000Z';

    const history = createSqlHistory(
      repository,
      () => endedAt,
    );

    const notifications = createSqlNotifications(repository);
    const activity = createQueueActivity(
      history,
      notifications,
    );

    const testPassword = 'Member4TestPassword1';
    const credentials = await hashPassword(testPassword);

    let sequence = 0;

    // Remove only records created by this test suite.
    t.after(async () => {
      try {
        for (const account of users) {
          await pool.execute(
            'DELETE FROM notifications WHERE user_id = ?',
            [account.id],
          );

          await pool.execute(
            'DELETE FROM history WHERE user_id = ?',
            [account.id],
          );

          await pool.execute(
            'DELETE FROM queue_entries WHERE user_id = ?',
            [account.id],
          );

          await pool.execute(
            'DELETE FROM user_credentials WHERE id = ?',
            [account.id],
          );
        }

        for (const offered of services) {
          await pool.execute(
            'DELETE FROM queues WHERE service_id = ?',
            [offered.id],
          );

          await pool.execute(
            'DELETE FROM services WHERE id = ?',
            [offered.id],
          );
        }
      } finally {
        await pool.end();
      }
    });

    async function user(role = 'user') {
      const created =
        await usersRepository.createUserWithProfile({
          name: 'Activity test',
          email: `${prefix}-${users.length}@example.test`,
          ...credentials,
          role,
        });

      users.push(created);
      return created;
    }

    async function service() {
      const created = await createService({
        name: `${prefix}-${services.length}`,
        description: 'Isolated Member 4 fixture',
        expectedDuration: 5,
        priority: 'medium',
        isOpen: true,
      });

      services.push(created);
      return created;
    }

    async function ordered(serviceId, connection) {
      const [rows] = await connection.execute(
        `SELECT e.id, e.user_id
         FROM queue_entries e
         JOIN queues q ON e.queue_id = q.id
         WHERE q.service_id = ?
           AND e.status = 'waiting'
         ORDER BY
           (e.priority = 'priority') DESC,
           e.order_seq,
           e.id`,
        [serviceId],
      );

      return rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
      }));
    }

    // Queue fixtures exercise the Member 4 transaction hooks.
    // Production SQL queue routes remain Member 3's responsibility.
    async function insertEntry(account, offered, connection) {
      const [[queue]] = await connection.execute(
        'SELECT id FROM queues WHERE service_id = ?',
        [offered.id],
      );

      const [result] = await connection.execute(
        `INSERT INTO queue_entries
           (queue_id, user_id, order_seq, joined_at)
         VALUES (?, ?, ?, ?)`,
        [
          queue.id,
          account.id,
          ++sequence,
          new Date(joinedAt),
        ],
      );

      return {
        id: Number(result.insertId),
        userId: account.id,
        serviceId: offered.id,
        joinedAt,
      };
    }

    async function join(account, offered, hooks = activity) {
      return withTransaction(async (connection) => {
        const entry = await insertEntry(
          account,
          offered,
          connection,
        );

        await hooks.joined(
          {
            entry,
            service: offered,
            ordered: await ordered(offered.id, connection),
          },
          connection,
        );

        return entry;
      });
    }

    async function finish(
      entry,
      offered,
      outcome,
      hooks = activity,
    ) {
      return withTransaction(async (connection) => {
        const statuses = {
          Served: 'served',
          'Left Queue': 'left',
          Removed: 'removed',
        };

        await connection.execute(
          `UPDATE queue_entries
           SET status = ?, ended_at = ?
           WHERE id = ?`,
          [
            statuses[outcome],
            new Date(endedAt),
            entry.id,
          ],
        );

        return hooks.finished(
          {
            entry,
            service: offered,
            outcome,
            ordered: await ordered(offered.id, connection),
          },
          connection,
        );
      });
    }

    await t.test(
      'join stores Waiting history and joined/almost-ready notifications',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        assert.deepEqual(await history.list(account.id), [
          {
            id: entry.id,
            userId: account.id,
            serviceId: offered.id,
            serviceName: offered.name,
            joinedAt,
            date: joinedAt,
            endedAt: null,
            outcome: 'Waiting',
          },
        ]);

        const events = await notifications.list(account.id);

        assert.deepEqual(
          events.map((item) => item.event).sort(),
          ['almost-ready', 'joined'],
        );

        assert.ok(
          events.every(
            (item) =>
              item.entryId === entry.id &&
              item.read === false &&
              item.type === 'info' &&
              Number.isFinite(Date.parse(item.createdAt)),
          ),
        );

        await assert.rejects(
          () => history.joined(entry, offered),
          { status: 409, code: 'HISTORY_EXISTS' },
        );
      },
    );

    await t.test(
      'history rejects mismatched ownership, service and missing entries',
      async () => {
        const account = await user();
        const other = await user();
        const offered = await service();

        const entry = await withTransaction(
          (connection) =>
            insertEntry(account, offered, connection),
        );

        const invalidReferences = [
          { userId: other.id },
          { serviceId: offered.id + 100000 },
          { entryId: 900000000000 },
        ];

        for (const patch of invalidReferences) {
          await assert.rejects(
            () => repository.createHistoryForJoin({
              entryId: entry.id,
              userId: account.id,
              serviceId: offered.id,
              serviceName: offered.name,
              joinedAt,
              ...patch,
            }),
            { status: 404, code: 'ENTRY_NOT_FOUND' },
          );
        }

        assert.deepEqual(await history.list(account.id), []);
      },
    );

    await t.test(
      'terminal outcomes persist and repeated completion preserves the original time',
      async () => {
        for (const outcome of [
          'Served',
          'Left Queue',
          'Removed',
        ]) {
          const account = await user();
          const offered = await service();
          const entry = await join(account, offered);

          const final = await finish(
            entry,
            offered,
            outcome,
          );

          assert.equal(final.outcome, outcome);
          assert.equal(final.endedAt, endedAt);

          const repeated = await repository.completeHistory({
            entryId: entry.id,
            outcome,
            endedAt: '2026-11-05T13:00:00.000Z',
          });

          assert.deepEqual(repeated, final);

          const conflicting =
            outcome === 'Served' ? 'Removed' : 'Served';

          await assert.rejects(
            () => repository.completeHistory({
              entryId: entry.id,
              outcome: conflicting,
              endedAt,
            }),
            {
              status: 409,
              code: 'HISTORY_ALREADY_FINISHED',
            },
          );

          const events = await notifications.list(account.id);

          assert.ok(
            events.some((item) => item.event === outcome),
          );
        }
      },
    );

    await t.test(
      'missing history and completion before joining are rejected',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        await assert.rejects(
          () => repository.completeHistory({
            entryId: 900000000000,
            outcome: 'Served',
            endedAt,
          }),
          { status: 404, code: 'HISTORY_NOT_FOUND' },
        );

        await assert.rejects(
          () => repository.completeHistory({
            entryId: entry.id,
            outcome: 'Served',
            endedAt: '2026-11-04T00:00:00Z',
          }),
          { status: 400, code: 'VALIDATION_ERROR' },
        );

        assert.equal(
          (await history.list(account.id))[0].outcome,
          'Waiting',
        );
      },
    );

    await t.test(
      'service name snapshots survive renaming and rejoining creates a new visit',
      async () => {
        const account = await user();
        const offered = await service();

        const first = await join(account, offered);
        await finish(first, offered, 'Left Queue');

        const renamed = await updateService(offered.id, {
          name: `${offered.name}-renamed`,
        });

        const second = await join(account, renamed);
        const records = await history.list(account.id);

        assert.deepEqual(
          records.map((record) => record.id),
          [second.id, first.id],
        );

        assert.equal(
          records[0].serviceName,
          renamed.name,
        );

        assert.equal(
          records[1].serviceName,
          offered.name,
        );

        assert.equal(records[0].outcome, 'Waiting');
        assert.equal(records[1].outcome, 'Left Queue');

        const events = await notifications.list(account.id);

        assert.equal(
          events.filter((item) => item.event === 'joined').length,
          2,
        );

        assert.equal(
          events.filter(
            (item) => item.event === 'almost-ready',
          ).length,
          2,
        );
      },
    );

    await t.test(
      'only the first two positions get almost-ready and reordering does not duplicate it',
      async () => {
        const offered = await service();

        const accounts = [
          await user(),
          await user(),
          await user(),
        ];

        const entries = [];

        for (const account of accounts) {
          entries.push(await join(account, offered));
        }

        const almostReadyCount = async (userId) =>
          (await notifications.list(userId)).filter(
            (item) => item.event === 'almost-ready',
          ).length;

        assert.equal(
          await almostReadyCount(accounts[2].id),
          0,
        );

        await finish(entries[0], offered, 'Served');

        assert.equal(
          await almostReadyCount(accounts[2].id),
          1,
        );

        await withTransaction(async (connection) => {
          await notifications.close(
            [entries[2], entries[1]],
            offered,
            connection,
          );

          await notifications.close(
            [entries[1], entries[2]],
            offered,
            connection,
          );
        });

        for (const account of accounts) {
          assert.equal(
            await almostReadyCount(account.id),
            1,
          );
        }
      },
    );

    await t.test(
      'concurrent duplicate events preserve one notification and its read state',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        const existing = (
          await notifications.list(account.id)
        ).find((item) => item.event === 'joined');

        const read = await notifications.markRead(
          account.id,
          existing.id,
        );

        const sent = await Promise.all(
          Array.from(
            { length: 8 },
            () => repository.emitNotification({
              userId: account.id,
              entryId: entry.id,
              event: 'joined',
              message: 'Retry cannot replace original',
            }),
          ),
        );

        assert.ok(
          sent.every((item) => item.id === existing.id),
        );

        assert.deepEqual(sent[0], read);

        const [[row]] = await pool.execute(
          `SELECT COUNT(*) AS n
           FROM notifications
           WHERE entry_id = ? AND event = ?`,
          [entry.id, 'joined'],
        );

        assert.equal(Number(row.n), 1);
      },
    );

    await t.test(
      'notification timestamps stay UTC in a non-UTC database session',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        const connection = await pool.getConnection();

        const [[original]] = await connection.query(
          'SELECT @@session.time_zone AS zone',
        );

        try {
          await connection.query(
            "SET time_zone = '+05:00'",
          );

          const before = Date.now();

          const item = await repository.emitNotification(
            {
              userId: account.id,
              entryId: entry.id,
              event: 'Served',
              message: 'UTC timestamp test',
            },
            connection,
          );

          assert.ok(
            Math.abs(Date.parse(item.createdAt) - before) < 5000,
          );
        } finally {
          await connection.query(
            'SET time_zone = ?',
            [original.zone],
          );

          connection.release();
        }
      },
    );

    await t.test(
      'concurrent conflicting completions produce one final outcome',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        const results = await Promise.allSettled(
          ['Served', 'Removed'].map(
            (outcome) => repository.completeHistory({
              entryId: entry.id,
              outcome,
              endedAt,
            }),
          ),
        );

        const successful = results.filter(
          (result) => result.status === 'fulfilled',
        );

        const rejected = results.filter(
          (result) =>
            result.status === 'rejected' &&
            result.reason.code === 'HISTORY_ALREADY_FINISHED',
        );

        assert.equal(successful.length, 1);
        assert.equal(rejected.length, 1);

        assert.equal(
          (await history.list(account.id))[0].outcome,
          successful[0].value.outcome,
        );
      },
    );

    await t.test(
      'user scoping and read ownership prevent access to another user',
      async () => {
        const account = await user();
        const other = await user();
        const offered = await service();
        const entry = await join(account, offered);

        assert.deepEqual(
          await history.list(other.id),
          [],
        );

        assert.deepEqual(
          await notifications.list(other.id),
          [],
        );

        const item = (
          await notifications.list(account.id)
        )[0];

        await assert.rejects(
          () => notifications.markRead(other.id, item.id),
          {
            status: 404,
            code: 'NOTIFICATION_NOT_FOUND',
          },
        );

        await assert.rejects(
          () => notifications.markRead(
            account.id,
            900000000000,
          ),
          {
            status: 404,
            code: 'NOTIFICATION_NOT_FOUND',
          },
        );

        assert.equal(
          (await notifications.list(account.id))[0].read,
          false,
        );

        const first = await notifications.markRead(
          account.id,
          item.id,
        );

        assert.equal(first.read, true);

        assert.deepEqual(
          await notifications.markRead(account.id, item.id),
          first,
        );

        await assert.rejects(
          () => repository.emitNotification({
            userId: other.id,
            entryId: entry.id,
            event: 'joined',
            message: 'Forged',
          }),
          { status: 404, code: 'ENTRY_NOT_FOUND' },
        );
      },
    );

    await t.test(
      'database constraints reject orphan rows, duplicate events and long messages',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        const insert = `
          INSERT INTO notifications
            (user_id, entry_id, event, message)
          VALUES (?, ?, ?, ?)
        `;

        await assert.rejects(
          () => pool.execute(insert, [
            account.id,
            900000000000,
            'joined',
            'Orphan',
          ]),
          { code: 'ER_NO_REFERENCED_ROW_2' },
        );

        await assert.rejects(
          () => pool.execute(insert, [
            account.id,
            entry.id,
            'joined',
            'Duplicate',
          ]),
          { code: 'ER_DUP_ENTRY' },
        );

        await assert.rejects(
          () => pool.execute(insert, [
            account.id,
            entry.id,
            'extra',
            'X'.repeat(501),
          ]),
          { code: 'ER_DATA_TOO_LONG' },
        );
      },
    );

    function failingActivity() {
      return createQueueActivity(
        history,
        createSqlNotifications({
          ...repository,

          emitNotification: (fields, connection) =>
            repository.emitNotification(
              {
                ...fields,
                userId: 900000000000,
              },
              connection,
            ),
        }),
      );
    }

    await t.test(
      'failed notification work rolls back the queue join and history',
      async () => {
        const account = await user();
        const offered = await service();

        await assert.rejects(
          () => join(account, offered, failingActivity()),
          { code: 'ENTRY_NOT_FOUND' },
        );

        const [[row]] = await pool.execute(
          `SELECT COUNT(*) AS n
           FROM queue_entries
           WHERE user_id = ?`,
          [account.id],
        );

        assert.equal(Number(row.n), 0);

        assert.deepEqual(
          await history.list(account.id),
          [],
        );

        assert.deepEqual(
          await notifications.list(account.id),
          [],
        );
      },
    );

    await t.test(
      'failed notification work rolls back queue completion and history',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        await assert.rejects(
          () => finish(
            entry,
            offered,
            'Served',
            failingActivity(),
          ),
          { code: 'ENTRY_NOT_FOUND' },
        );

        const [[row]] = await pool.execute(
          `SELECT status, ended_at
           FROM queue_entries
           WHERE id = ?`,
          [entry.id],
        );

        assert.equal(row.status, 'waiting');
        assert.equal(row.ended_at, null);

        const record = (await history.list(account.id))[0];

        assert.equal(record.outcome, 'Waiting');
        assert.equal(record.endedAt, null);

        assert.equal(
          (await notifications.list(account.id)).some(
            (item) => item.event === 'Served',
          ),
          false,
        );
      },
    );

    await t.test(
      'committed history and read state survive a fresh Node process',
      async () => {
        const account = await user();
        const offered = await service();
        const entry = await join(account, offered);

        await finish(entry, offered, 'Removed');

        const item = (
          await notifications.list(account.id)
        )[0];

        await notifications.markRead(account.id, item.id);

        const script = `
          import { pool } from './src/db/pool.js';
          import {
            listHistoryForUser,
            listNotificationsForUser,
          } from './src/repositories/activity.repo.js';

          try {
            const userId = Number(process.argv[1]);

            console.log(JSON.stringify({
              history: await listHistoryForUser(userId),
              notifications: await listNotificationsForUser(userId),
            }));
          } finally {
            await pool.end();
          }
        `;

        const { stdout } = await promisify(execFile)(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            script,
            String(account.id),
          ],
          {
            cwd: new URL('..', import.meta.url),
            timeout: 15000,
          },
        );

        const stored = JSON.parse(stdout);

        assert.deepEqual(
          stored.history,
          await history.list(account.id),
        );

        assert.deepEqual(
          stored.notifications,
          await notifications.list(account.id),
        );

        assert.equal(
          stored.notifications.find(
            (notice) => notice.id === item.id,
          ).read,
          true,
        );
      },
    );

    await t.test(
      'SQL-backed HTTP history and read status survive an Express restart',
      async () => {
        const account = await user();
        const other = await user();
        const admin = await user('admin');
        const offered = await service();

        const entry = await join(account, offered);
        await finish(entry, offered, 'Served');

        const auth = createSqlAuth(usersRepository);

        async function login(account) {
          const result = await auth.login({
            email: account.email,
            password: testPassword,
          });

          return result.token;
        }

        const token = await login(account);
        const otherToken = await login(other);
        const adminToken = await login(admin);

        async function launch() {
          const { app } = createApp({
            authStorage: 'mysql',
            servicesStorage: 'mysql',
            activityStorage: 'mysql',
          });

          const server = app.listen(0, '127.0.0.1');

          await once(server, 'listening');

          return {
            server,
            url: `http://127.0.0.1:${server.address().port}/api`,
          };
        }

        function stop(instance) {
          return new Promise((resolve) => {
            instance.server.close(resolve);
            instance.server.closeAllConnections();
          });
        }

        async function request(
          instance,
          route,
          bearer = token,
          method = 'GET',
          body,
        ) {
          const response = await fetch(
            instance.url + route,
            {
              method,

              headers: {
                ...(bearer
                  ? { Authorization: `Bearer ${bearer}` }
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

        const first = await launch();
        let notificationId;

        try {
          assert.equal(
            (await request(first, '/history', null)).status,
            401,
          );

          assert.equal(
            (
              await request(
                first,
                '/history',
                adminToken,
              )
            ).status,
            403,
          );

          assert.deepEqual(
            (
              await request(
                first,
                '/history',
                otherToken,
              )
            ).data,
            [],
          );

          assert.deepEqual(
            (
              await request(
                first,
                '/notifications',
                otherToken,
              )
            ).data,
            [],
          );

          const records = await request(
            first,
            '/history?userId=' + other.id,
          );

          assert.deepEqual(
            records.data,
            await history.list(account.id),
          );

          assert.deepEqual(
            (await request(first, '/state')).data.history,
            records.data,
          );

          const listed = await request(
            first,
            '/notifications',
          );

          notificationId = listed.data[0].id;

          assert.equal(
            (
              await request(
                first,
                `/notifications/${notificationId}/read`,
                otherToken,
                'PATCH',
                {},
              )
            ).status,
            404,
          );

          assert.equal(
            (
              await request(
                first,
                `/notifications/${notificationId}/read`,
                token,
                'PATCH',
                {},
              )
            ).data.read,
            true,
          );
        } finally {
          await stop(first);
        }

        const second = await launch();

        try {
          assert.equal(
            (await request(second, '/history')).data[0].outcome,
            'Served',
          );

          const listed = await request(
            second,
            '/notifications',
          );

          assert.equal(
            listed.data.find(
              (notice) => notice.id === notificationId,
            ).read,
            true,
          );

          assert.equal(
            (
              await request(second, '/health', null)
            ).data.activityStorage,
            'mysql',
          );
        } finally {
          await stop(second);
        }
      },
    );
  },
);