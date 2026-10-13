// OWNER 1: auth/session hardening and validation test extensions; see docs/TEAM_PLAN.md.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fail } from '../shared/errors.js';
import * as v from '../shared/validation.js';
export function publicUser({ id, name, email, role }) { return { id, name, email, role }; }
function hash(password, salt = randomBytes(16).toString('hex')) {
  return { salt, digest: scryptSync(password, salt, 64).toString('hex') };
}
export function createAuth(store, { now = () => Date.now(), ttl = 3600000 } = {}) {
  function add(name, email, password, role) {
    const user = { id: store.nextId(), name, email, role, ...hash(password) };
    store.users.push(user); return publicUser(user);
  }
  add('Jordan User', 'user@queuesmart.com', 'User1234', 'user');
  add('Avery Admin', 'admin@queuesmart.com', 'Admin1234', 'admin');
  return {
    register(body) {
      v.object(body, ['name', 'email', 'password']);
      const name = v.text(body, 'name', 1, 100), email = v.email(body), password = v.text(body, 'password', 8, 128, false);
      if (store.users.some(u => u.email === email)) fail(409, 'EMAIL_EXISTS', 'Email is already registered.');
      return add(name, email, password, 'user'); // Public registration cannot grant admin privileges.
    },
    login(body) {
      v.object(body, ['email', 'password', 'expectedRole']);
      const email = v.email(body), password = v.text(body, 'password', 8, 128, false);
      if (body.expectedRole !== undefined) v.choice(body, 'expectedRole', ['user', 'admin']);
      const user = store.users.find(u => u.email === email);
      const digest = hash(password, user?.salt || 'dummy-salt').digest;
      if (!user || !timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(user.digest, 'hex')) ||
        (body.expectedRole && body.expectedRole !== user.role)) fail(401, 'INVALID_CREDENTIALS', 'Incorrect email, password, or account role.');
      const token = randomBytes(32).toString('hex'), expiresAt = now() + ttl;
      store.sessions.set(token, { userId: user.id, expiresAt });
      return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) };
    },
    authenticate(token) {
      const session = store.sessions.get(token);
      if (!session || session.expiresAt <= now()) {
        store.sessions.delete(token); fail(401, 'UNAUTHENTICATED', 'Sign in again.');
      }
      return publicUser(store.users.find(u => u.id === session.userId));
    },
    logout(token) { store.sessions.delete(token); },
  };
}
export function requireRole(user, role) {
  if (user.role !== role) fail(403, 'FORBIDDEN', `Requires ${role} role.`);
}
