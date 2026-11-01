/** Member 1: MySQL-backed auth. The A3 in-memory auth implementation remains
 * available so existing unit tests and other teammates can migrate gradually.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from '../shared/errors.js';
import * as v from '../shared/validation.js';

const derive = promisify(scrypt);
const KEY_BYTES = 64;
const DUMMY_SALT = 'queuesmart-absent-account';
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const digest = await derive(password, salt, KEY_BYTES);
  return { salt, digest: digest.toString('hex') };
}

export function createSqlAuth(repository, { now = () => Date.now(), ttl = 3600000 } = {}) {
  if (!repository) throw new TypeError('SQL auth repository is required.');
  if (!Number.isFinite(ttl) || ttl <= 0) throw new TypeError('Session TTL must be positive.');

  return {
    async register(body) {
      v.object(body, ['name', 'email', 'password']);
      const name = v.text(body, 'name', 1, 100);
      const email = v.email(body);
      const password = v.text(body, 'password', 8, 128, false);
      const { salt, digest } = await hashPassword(password);
      // The DB's UNIQUE(email), not an in-memory Set, wins concurrent races.
      // A public request can never assign the administrator role.
      return repository.createUserWithProfile({ name, email, salt, digest, role: 'user' });
    },

    async login(body) {
      v.object(body, ['email', 'password', 'expectedRole']);
      const email = v.email(body);
      const password = v.text(body, 'password', 8, 128, false);
      if (body.expectedRole !== undefined) {
        v.choice(body, 'expectedRole', ['user', 'admin']);
      }
      const user = await repository.findUserByEmail(email);
      // Perform scrypt even for unknown accounts, reducing account enumeration.
      const { digest } = await hashPassword(password, user?.salt ?? DUMMY_SALT);
      const supplied = Buffer.from(digest, 'hex');
      const stored = user?.digest ? Buffer.from(user.digest, 'hex') : null;
      const passwordMatches = stored?.length === KEY_BYTES && timingSafeEqual(supplied, stored);
      if (!user || !passwordMatches || (body.expectedRole && body.expectedRole !== user.role)) {
        fail(401, 'INVALID_CREDENTIALS', 'Incorrect email, password, or account role.');
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = now() + ttl;
      await repository.saveSession({ tokenHash: tokenHash(token), userId: user.id, expiresAt });
      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
    },

    async authenticate(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        fail(401, 'UNAUTHENTICATED', 'Sign in again.');
      }
      const hash = tokenHash(token);
      const session = await repository.findSession(hash);
      if (!session || !session.user || session.expiresAt <= now()) {
        if (session) await repository.deleteSession(hash);
        fail(401, 'UNAUTHENTICATED', 'Sign in again.');
      }
      return session.user;
    },

    async logout(token) {
      // Route middleware already authenticates; revoke only this token.
      if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
        await repository.deleteSession(tokenHash(token));
      }
    },
  };
}
