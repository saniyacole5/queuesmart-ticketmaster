# A4 integration — replacing A3 in-memory storage safely

**Current repository state:** `backend/src/db/pool.js` exists and connects to MySQL, but `backend/src/app.js` still does `createStore()`, constructing modules against `backend/src/store.js` arrays/Map. `backend/src/server.js` still reports an in-memory demo. Therefore `db:check` alone is NOT sufficient for Assignment 4.

## Preserve contract while changing implementation

Existing `docs/API.md` at repository root `/docs` is the authoritative current contract. Keep `data` response envelope, `id` numeric fields, camelCase `expectedDuration` / `isOpen`, error codes, status behavior, authorization, queue ordering, wait estimates and public-user filtering. The included `src/db/mappers.js` helps translate snake_case SQL columns into API objects.

Implement repository methods in `backend/src/repositories/`. The stub functions intentionally throw descriptive `A4_MEMBER_N_TODO` errors so nobody mistakes starter interfaces for completed integration. Existing A3 modules do not import these stubs yet. Member implementation should replace TODOs with SQL and add tests before wiring up live routes.

### Critical async architecture changes

**Every SQL query returns a Promise.** `createAuth().authenticate()` is currently synchronous and is called directly inside Express middleware. This must become async, as must module methods, `serviceViews()`, `queues.snapshot()`, `/api/state` aggregation, logout etc. Express 5 supports Promise-returning handlers, but the team still needs to `await` them and call `next(err)` for any hand-written middleware not returned as an Express-compatible Promise.

Suggested integration contract:

```js
const authenticated = async (req, res, next) => {
  try {
    req.token = /^Bearer ([a-f0-9]{64})$/.exec(
      req.get("Authorization") || "",
    )?.[1];
    req.user = await auth.authenticate(req.token);
    res.set("Cache-Control", "no-store");
    next();
  } catch (error) {
    next(error);
  }
};
```

Then update routes: `await auth.logout(...)`, `await services.list()`, `await queues.snapshot(id)`, `await history.list(userId)`, `await notifications.markRead(...)`, and carefully aggregate `/state` via Promise-aware code. **Do not copy the example verbatim without updating the surrounding module methods**.

### SQL queries and transactions

- Use `mysql2/promise` parameter placeholders `?` for all user-supplied values. Do not interpolate SQL strings from URLs/body fields.
- Use `withTransaction(async connection => { ... })` for all multi-table changes and pass the **same transaction connection** into collaborating repository methods.
- Keep the queue lock and status check, entry insert/update, history insert/update and notification insert in the same DB transaction. Use the generated unique active_user_id to prevent race conditions even across multiple backend processes.
- For auth registration, insert `user_credentials` + `user_profiles` in one transaction; map duplicate unique email to HTTP 409.
- For services, insert/update `services` + `queues` in one transaction; no orphan queues.
- For queue status changes, `queue_entries.status` becomes terminal rather than deleting the row. All positions/counts use `status='waiting'`.
- Avoid using the same shared Aiven database for parallel integration test cleanup. Prefer ephemeral CI MySQL or unique test schema.
- Keep role checks server-side. `req.user` must derive from DB-backed authentication, not browser role claims.

### Current A3 seed-account trap

The A3 auth module auto-seeds `admin@queuesmart.com` and `user@queuesmart.com` on startup. The empty Aiven `queuesmart_db` has neither account. Remove/replace A3 seed dependency only when an intentional and secure admin bootstrap mechanism is ready. Never expose a registration option that lets the client choose `role='admin'`.

### Honest feature completion checklist

A4 is complete only when React -> Express -> **MySQL** -> Express -> React works for authentication, services, queue actions, notification/read and history, when actual Aiven tables contain rows, and when the records survive a backend restart. Change health route from `storage:'in-memory'` to `storage:'mysql'` only after verifying persistence. Legacy unit tests using createStore() may continue for pure business rules, but add SQL integration tests for persistent flows.
