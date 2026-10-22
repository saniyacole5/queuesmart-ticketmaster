// MEMBER 1: auth/session hardening and validation test extensions; see docs/TEAM_PLAN.md.
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fail } from "../shared/errors.js";
import * as v from "../shared/validation.js";

const derive = promisify(scrypt);
const KEY_LENGTH = 64;
// compared against when no account matches, so an unknown email costs the same
// work as a real one and response timing cannot be used to enumerate accounts.
const ABSENT_USER_SALT = "dummy-salt";

export function publicUser({ id, name, email, role }) {
  return { id, name, email, role };
}

// request-path hashing: asynchronous so a scrypt derivation never blocks the
// event loop while other requests are waiting.
async function hash(password, salt = randomBytes(16).toString("hex")) {
  const digest = await derive(password, salt, KEY_LENGTH);
  return { salt, digest: digest.toString("hex") };
}

// startup seeding only. Runs twice at construction, off the request path, so
// blocking here costs nothing and keeps createAuth synchronous for callers.
function hashAtBoot(password, salt = randomBytes(16).toString("hex")) {
  return { salt, digest: scryptSync(password, salt, KEY_LENGTH).toString("hex") };
}

export function createAuth(
  store,
  { now = () => Date.now(), ttl = 3600000 } = {},
) {
  function insert(name, email, role, credentials) {
    const user = { id: store.nextId(), name, email, role, ...credentials };
    store.users.push(user);
    return publicUser(user);
  }
  const seed = (name, email, password, role) =>
    insert(name, email, role, hashAtBoot(password));
  seed("Jordan User", "user@queuesmart.com", "User1234", "user");
  seed("Avery Admin", "admin@queuesmart.com", "Admin1234", "admin");
  // emails whose registration has passed the duplicate check but not yet been
  // inserted. Awaiting scrypt yields the event loop, so without this reservation
  // two concurrent registrations both pass the check and both insert.
  const claiming = new Set();
  return {
    async register(body) {
      v.object(body, ["name", "email", "password"]);
      const name = v.text(body, "name", 1, 100),
        email = v.email(body),
        password = v.text(body, "password", 8, 128, false);
      if (store.users.some((u) => u.email === email) || claiming.has(email))
        fail(409, "EMAIL_EXISTS", "Email is already registered.");
      claiming.add(email); // claimed synchronously, before the first await.
      try {
        const credentials = await hash(password);
        return insert(name, email, "user", credentials); // Public registration cannot grant admin privileges.
      } finally {
        claiming.delete(email); // released even on failure so a retry can proceed.
      }
    },
    async login(body) {
      v.object(body, ["email", "password", "expectedRole"]);
      const email = v.email(body),
        password = v.text(body, "password", 8, 128, false);
      if (body.expectedRole !== undefined)
        v.choice(body, "expectedRole", ["user", "admin"]);
      const user = store.users.find((u) => u.email === email);
      const { digest } = await hash(password, user?.salt || ABSENT_USER_SALT);
      if (
        !user ||
        !timingSafeEqual(
          Buffer.from(digest, "hex"),
          Buffer.from(user.digest, "hex"),
        ) ||
        (body.expectedRole && body.expectedRole !== user.role)
      )
        fail(
          401,
          "INVALID_CREDENTIALS",
          "Incorrect email, password, or account role.",
        );
      const token = randomBytes(32).toString("hex"),
        expiresAt = now() + ttl;
      store.sessions.set(token, { userId: user.id, expiresAt });
      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        user: publicUser(user),
      };
    },
    authenticate(token) {
      const session = store.sessions.get(token);
      if (!session || session.expiresAt <= now()) {
        store.sessions.delete(token);
        fail(401, "UNAUTHENTICATED", "Sign in again.");
      }
      return publicUser(store.users.find((u) => u.id === session.userId));
    },
    logout(token) {
      store.sessions.delete(token);
    },
  };
}

export function requireRole(user, role) {
  if (user.role !== role) fail(403, "FORBIDDEN", `Requires ${role} role.`);
}
