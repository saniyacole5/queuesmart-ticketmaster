import express from 'express';
import { createStore } from './store.js';
import { createAuth, requireRole } from './modules/auth.js';
import { createSqlAuth } from './modules/authSql.js';
import * as usersRepository from './repositories/users.repo.js';
import * as servicesRepository from './repositories/services.repo.js';
import * as queuesRepository from './repositories/queues.repo.js';
import { createServices } from './modules/services.js';
import { createQueues } from './modules/queues.js';
import { createNotifications } from './modules/notifications.js';
import { createHistory } from './modules/history.js';
import { errorHandler, fail } from './shared/errors.js';
import { id, object } from './shared/validation.js';

export function createApp(options = {}) {
  const store = createStore();
  // Member 1: opt-in persistent auth. Remaining service/queue/history modules
  // stay in-memory until Members 2–4 complete shared integration.
  const authStorage = options.authStorage ?? 'memory';
  if (!['memory', 'mysql'].includes(authStorage)) throw new Error('Invalid AUTH_STORAGE. Use mysql or memory.');
  const auth = authStorage === 'mysql'
    ? createSqlAuth(options.usersRepository ?? usersRepository, options)
    : createAuth(store, options);
  const servicesStorage = options.servicesStorage ?? 'memory';
  if (!['memory', 'mysql'].includes(servicesStorage)) {
    throw new Error('Invalid SERVICES_STORAGE. Use mysql or memory.');
  }
  if (servicesStorage === 'mysql' && authStorage !== 'mysql') {
    throw new Error('SQL services require AUTH_STORAGE=mysql.');
  }
  const services = createServices(
    store,
    servicesStorage === 'mysql'
      ? (options.servicesRepository ?? servicesRepository)
      : null,
  );
  const queueStorage = options.queueStorage ?? 'memory';
  if (!['memory', 'mysql'].includes(queueStorage)) {
    throw new Error('Invalid QUEUE_STORAGE. Use mysql or memory.');
  }
  if (queueStorage === 'mysql' && servicesStorage !== 'mysql') {
    throw new Error('SQL queues require SERVICES_STORAGE=mysql.');
  }
  const notifications = createNotifications(store, options.clock);
  const history = createHistory(store, options.clock);
  const queues = createQueues(
    store,
    notifications,
    history,
    options.clock,
    queueStorage === 'mysql'
      ? (options.queuesRepository ?? queuesRepository)
      : null,
  );
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const ok = (res, data, status = 200) => res.status(status).json({ data });

  app.get('/api/health', (req, res) => ok(res, {
    status: 'ok', 
    storage:
      authStorage === 'mysql' || servicesStorage === 'mysql'
        ? 'mixed'
        : 'in-memory',
    authStorage: authStorage === 'mysql' ? 'mysql' : 'in-memory',
    servicesStorage: servicesStorage === 'mysql' ? 'mysql' : 'in-memory',
    queueStorage: queueStorage === 'mysql'
      ? 'mysql'
      : servicesStorage === 'mysql'
        ? 'disabled'
        : 'in-memory',
  }));
  app.post('/api/auth/register', async (req, res) => ok(res, await auth.register(req.body), 201));
  app.post('/api/auth/login', async (req, res) => ok(res, await auth.login(req.body)));

  // Temporary service-testing mode until queue/activity SQL integration is ready.
  // Authenticate protected API requests before checking roles.
  app.use('/api', async (req, res, next) => {
    req.token = /^Bearer ([a-f0-9]{64})$/.exec(
      req.get('Authorization') || '',
    )?.[1];

    req.user = await auth.authenticate(req.token);
    res.set('Cache-Control', 'no-store');
    next();
  });

  const admin = (req, res, next) => {
    requireRole(req.user, 'admin');
    next();
  };

  const user = (req, res, next) => {
    requireRole(req.user, 'user');
    next();
  };

  app.get('/api/auth/me', (req, res) => ok(res, req.user));

  app.post('/api/auth/logout', async (req, res) => {
    object(req.body, []);
    await auth.logout(req.token);
    ok(res, { loggedOut: true });
  });

  // Temporary service-testing mode.
  // Authentication and its routes are above this middleware.
  app.use('/api', (req, res, next) => {
    if (servicesStorage !== 'mysql') {
      return next();
    }

  const serviceRequest =
    (req.method === 'GET' && req.path === '/services') ||
    (req.method === 'POST' && req.path === '/services') ||
    (req.method === 'PATCH' && /^\/services\/[^/]+$/.test(req.path));

  const stateRequest =
    req.method === 'GET' && req.path === '/state';

  // Member 3: queue routes leave the refusal list once they are SQL-backed.
  const queueRequest =
    queueStorage === 'mysql' && (
      req.path === '/queues/me' ||
      /^\/services\/[^/]+\/(queue|serve-next)$/.test(req.path) ||
      /^\/queue-entries\/[^/]+$/.test(req.path) ||
      /^\/admin\/queue-entries\/[^/]+(\/(priority|move))?$/.test(req.path)
    );

  if (serviceRequest || stateRequest || queueRequest) {
    return next();
  }

  fail(
    503,
    'FEATURE_NOT_READY',
    'Only authentication, services and queues are available in SQL mode.',
  );
});

  async function serviceViews() {
    const list = await services.list();

    return list.map((service) => {
      const queueLength = servicesStorage === 'mysql'
        ? service.queueLength
        : queues.snapshot(service.id).length;

      return {
        ...service,
        queueLength,
        estimatedWait: queueLength * service.expectedDuration,
      }; 
    });
  }
  app.get('/api/services', async (req, res) => {
    ok(res, await serviceViews());
  });
  app.post('/api/services', admin, async (req, res) => {
    ok(res, await services.create(req.body), 201);
  });
  app.patch('/api/services/:id', admin, async (req, res) => {
    ok(res, await services.update(id(req.params.id), req.body));
  });
  // Awaited so the SQL repository's Promises resolve before responding.
  // In memory mode these methods are synchronous and await is a no-op.
  app.get('/api/queues/me', user, async (req, res) => ok(res, await queues.mine(req.user.id)));
  app.get('/api/services/:id/queue', admin, async (req, res) => ok(res, await queues.snapshot(id(req.params.id))));
  app.post('/api/services/:id/queue', user, async (req, res) => ok(res, await queues.join(req.user, id(req.params.id), req.body), 201));
  app.delete('/api/queue-entries/:id', user, async (req, res) => ok(res, await queues.leave(req.user, id(req.params.id))));
  app.post('/api/services/:id/serve-next', admin, async (req, res) => {
    object(req.body, []); ok(res, await queues.serve(id(req.params.id)));
  });
  app.delete('/api/admin/queue-entries/:id', admin, async (req, res) => ok(res, await queues.remove(id(req.params.id))));
  app.patch('/api/admin/queue-entries/:id/priority', admin, async (req, res) => ok(res, await queues.priority(id(req.params.id), req.body)));
  app.post('/api/admin/queue-entries/:id/move', admin, async (req, res) => ok(res, await queues.move(id(req.params.id), req.body)));
  app.get('/api/notifications', (req, res) => ok(res, notifications.list(req.user.id)));
  app.patch('/api/notifications/:id/read', (req, res) => {
    object(req.body, []); ok(res, notifications.markRead(req.user.id, id(req.params.id)));
  });
  app.get('/api/history', user, (req, res) => ok(res, history.list(req.user.id)));
  app.get('/api/state', async (req, res) => {
    const serviceList = await serviceViews();

    if (queueStorage === 'mysql') {
      // Queue data is SQL-backed. History is Member 4's deliverable and stays
      // empty until their routes land -- the gap is a deliberate seam, not a
      // bug to patch by reading the table directly here.
      return ok(res, {
        services: serviceList,
        queueEntries: req.user.role === 'admin'
          ? (await Promise.all(
              serviceList.map((service) => queues.snapshot(service.id)),
            )).flat()
          : [],
        currentQueue: req.user.role === 'user'
          ? await queues.mine(req.user.id)
          : null,
        history: [],
      });
    }

    if (servicesStorage === 'mysql') {
      // Temp placeholders for the service-screen preview.
      // These are not SQL queue/history results.
      return ok(res, {
        services: serviceList,
        queueEntries: [],
        currentQueue: null,
        history: [],
      });
    }
    return ok(res, {
      services: serviceList,
      queueEntries: req.user.role === 'admin'
        ? serviceList.flatMap((service) => queues.snapshot(service.id))
        : [],
      currentQueue: req.user.role === 'user'
        ? queues.mine(req.user.id)
        : null,
      history: req.user.role === 'user'
        ? history.list(req.user.id)
        : [],
    });
  });
  app.use((req, res) => fail(404, 'NOT_FOUND', 'API route not found.'));
  app.use(errorHandler);
  return { app, store, auth, services, queues, notifications, history };
}
