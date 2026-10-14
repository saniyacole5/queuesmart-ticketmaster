import express from 'express';
import { createStore } from './store.js';
import { createAuth, requireRole } from './modules/auth.js';
import { createServices } from './modules/services.js';
import { createQueues } from './modules/queues.js';
import { createNotifications } from './modules/notifications.js';
import { createHistory } from './modules/history.js';
import { errorHandler, fail } from './shared/errors.js';
import { id, object } from './shared/validation.js';
export function createApp(options = {}) {
  const store = createStore(), auth = createAuth(store, options), services = createServices(store);
  const notifications = createNotifications(store, options.clock), history = createHistory(store, options.clock);
  const queues = createQueues(store, notifications, history, options.clock);
  const app = express(); app.disable('x-powered-by'); app.use(express.json({ limit: '16kb' }));
  const ok = (res, data, status = 200) => res.status(status).json({ data });
  app.get('/api/health', (req, res) => ok(res, { status: 'ok', storage: 'in-memory' }));
  app.post('/api/auth/register', (req, res) => ok(res, auth.register(req.body), 201));
  app.post('/api/auth/login', (req, res) => ok(res, auth.login(req.body)));
  app.use('/api', (req, res, next) => {
    req.token = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '')?.[1];
    req.user = auth.authenticate(req.token); res.set('Cache-Control', 'no-store'); next();
  });
  const admin = (req, res, next) => { requireRole(req.user, 'admin'); next(); };
  const user = (req, res, next) => { requireRole(req.user, 'user'); next(); };
  app.get('/api/auth/me', (req, res) => ok(res, req.user));
  app.post('/api/auth/logout', (req, res) => { object(req.body, []); auth.logout(req.token); ok(res, { loggedOut: true }); });
  function serviceViews() {
    return services.list().map(s => ({ ...s, queueLength: queues.snapshot(s.id).length,
      estimatedWait: queues.snapshot(s.id).length * s.expectedDuration }));
  }
  app.get('/api/services', (req, res) => ok(res, serviceViews()));
  app.post('/api/services', admin, (req, res) => ok(res, services.create(req.body), 201));
  app.patch('/api/services/:id', admin, (req, res) => ok(res, services.update(id(req.params.id), req.body)));
  app.get('/api/queues/me', user, (req, res) => ok(res, queues.mine(req.user.id)));
  app.get('/api/services/:id/queue', admin, (req, res) => ok(res, queues.snapshot(id(req.params.id))));
  app.post('/api/services/:id/queue', user, (req, res) => ok(res, queues.join(req.user, id(req.params.id), req.body), 201));
  app.delete('/api/queue-entries/:id', user, (req, res) => ok(res, queues.leave(req.user, id(req.params.id))));
  app.post('/api/services/:id/serve-next', admin, (req, res) => { object(req.body, []); ok(res, queues.serve(id(req.params.id))); });
  app.delete('/api/admin/queue-entries/:id', admin, (req, res) => ok(res, queues.remove(id(req.params.id))));
  app.patch('/api/admin/queue-entries/:id/priority', admin, (req, res) => ok(res, queues.priority(id(req.params.id), req.body)));
  app.post('/api/admin/queue-entries/:id/move', admin, (req, res) => ok(res, queues.move(id(req.params.id), req.body)));
  app.get('/api/notifications', (req, res) => ok(res, notifications.list(req.user.id)));
  app.patch('/api/notifications/:id/read', (req, res) => { object(req.body, []); ok(res, notifications.markRead(req.user.id, id(req.params.id))); });
  app.get('/api/history', user, (req, res) => ok(res, history.list(req.user.id)));
  app.get('/api/state', (req, res) => ok(res, {
    services: serviceViews(),
    queueEntries: req.user.role === 'admin' ? services.list().flatMap(s => queues.snapshot(s.id)) : [],
    currentQueue: req.user.role === 'user' ? queues.mine(req.user.id) : null,
    history: req.user.role === 'user' ? history.list(req.user.id) : [],
  }));
  app.use((req, res) => fail(404, 'NOT_FOUND', 'API route not found.'));
  app.use(errorHandler);
  return { app, store, auth, services, queues, notifications, history };
}
