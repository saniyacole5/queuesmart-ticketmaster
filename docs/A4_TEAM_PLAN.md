# Assignment 4 — four-person implementation plan

This is a suggested **division of coding work**, not a claim that anyone has completed it. Choose who will be Member 1–4, track real commits and reviews, and adjust responsibilities together. Read [`API.md`](API.md) before changing endpoints.

## Shared first milestone (all four members)

- Review `backend/sql/001_schema.sql` and confirm tables, names, PK/FK structure, uniqueness, roles and queue policy.
- Use the correct Aiven `queuesmart_db`, `queuesmart_app` user and its **own** password in `backend/.env`.
- Verify access via `npm run db:check`.
- Agree that `app.js` has one integration owner at a time and feature repositories export Promise-based methods.
- Before anyone turns on database mode, preserve and run the existing A3 tests for a baseline.

## Member 1 — Database foundation + persisted authentication

**Primary files:** `backend/sql/001_schema.sql`, `backend/src/repositories/users.repo.js`, `backend/src/modules/auth.js`, `backend/src/db/transaction.js` (shared with Member 3), `backend/test/a4-auth-db.test.js` (create).

**Concrete tasks:**

1. Review/run and document 8-table DDL on empty `queuesmart_db`, including PK/FK and indexes. Ensure `user_credentials.email` is canonical/unique and `user_profiles` is 1:1.
2. Implement user repository methods with prepared SQL and transactionally insert credentials+profile, translating MySQL duplicate email errors into the existing HTTP `409 EMAIL_EXISTS`.
3. Preserve async `scrypt` hashing, salts, timing-safe verification, `expectedRole`, no password leaks and public registration role always `user`.
4. Implement durable `auth_sessions` storing only SHA-256 **hashes** of random bearer tokens; use DB lookup for `authenticate`/logout/expiry. Coordinate with integration owner to make `app.js` authentication middleware async.
5. Provide a safe intentional initial administrator bootstrap strategy, never via public register and never hard-code shared demo passwords in source.
6. Tests: create/register/login/logout/restart persistence, duplicate case-insensitive email and concurrent requests, session expiry, bad role and private fields never included in public JSON.

**Acceptance:** a user registered through React survives backend restart; login/roles are verified from SQL; real data appears in `user_credentials`, `user_profiles` and `auth_sessions`.

## Member 2 — Services + queue metadata + admin UI

**Primary files:** `backend/src/repositories/services.repo.js`, `backend/src/modules/services.js`, `backend/test/a4-services-db.test.js` (create), `frontend/src/pages/ServiceManagementPage.jsx`, `frontend/src/pages/AdminDashboardPage.jsx` as needed.

**Concrete tasks:**

1. Implement parameterized SQL for service list/create/partial update and `serviceRow` mapping; preserve API keys and validation.
2. Create a linked `queues` row for every new service. Update `services.is_open` and `queues.status` in one transaction when opening/closing.
3. Preserve case-insensitive unique service names, 409 conflict, expected duration between 1 and 480 and priority metadata. Handle missing service IDs as 404.
4. Compute queueLength and estimatedWait from **waiting** entries, not from old `store.entries`. Confirm read views stay accurate after service edits.
5. Tests: SQL persistence after server restart, invalid field bounds, duplicate case-insensitive names, service open/close sync and admin-only mutation.
6. Verify frontend service screens and empty/loading/error states against real API data.

**Acceptance:** services created on frontend persist in Aiven and reappear after restart, with durable open state/queue metadata.

## Member 3 — Transaction-safe queue lifecycle + user/admin UI

**Primary files:** `backend/src/repositories/queues.repo.js`, `backend/src/modules/queues.js`, `backend/src/db/transaction.js` (coordinate with Member 1), `backend/test/a4-queues-db.test.js` (create), `frontend/src/context/QueueContext.jsx`/queue pages as needed.

**Concrete tasks:**

1. Implement join in a transaction with row locking, open-queue check and ordered `order_seq` allocation. The generated unique active-user constraint guarantees one waiting entry per user even under concurrent HTTP requests.
2. Query ordered waiting entries, with high entry priority first, then arrival sequence/ID. Return `position`, `estimatedWait`, `status`, `serviceName` matching `docs/API.md`.
3. Implement leave, serve, admin remove as durable **soft finishes**, not DELETE. Update matching `history` and emit notifications within the same transaction using Member 4 helpers.
4. Implement admin priority change and move only within same tier/service, atomically swapping order sequence. No invalid cross-service/cross-tier moves.
5. Tests: two simultaneous joins by same user (201/409), multiple users FIFO, user ownership, permission checks, closure, restart survival, concurrent serve/leave, move boundaries, wait estimates.
6. Verify React JoinQueue, QueueStatus, QueueManagement and polling flows display stored values.

**Acceptance:** live SQL queue rows reflect every action, first/second position status works, orders survive restart and no duplicate active registration occurs.

## Member 4 — Notifications/history + tests/CI/submission evidence

**Primary files:** `backend/src/repositories/activity.repo.js`, `backend/src/modules/notifications.js`, `backend/src/modules/history.js`, `backend/test/a4-activity-db.test.js` (create), notification/history React pages, `.github/workflows/a4.yml` (shared).

**Concrete tasks:**

1. Persist history at join and terminal state at leave/serve/remove; preserve service name snapshot after service rename.
2. Persist joined, almost-ready, terminal notifications. Use unique `(entry_id,event)` to ensure almost-ready is sent only once per participation; preserve ownership checks and `read` status.
3. Integrate activity helpers into Member 3 transaction so no queue finish can commit without corresponding history/notification work.
4. Tests: history/notifications survive restart, separate user access control, read/unread, close threshold 2, rejoin generates new participation, same event only once.
5. Run coverage and frontend lint/build, help integrate A4 MySQL CI on ephemeral test DB, collect real coverage/screenshot evidence and gather **truthful** member work summaries.
6. Verify HistoryPage, NotificationCenter and UserDashboardPage with the real API data.

**Acceptance:** histories and notifications are visible only to the right users, persist across restart and satisfy API shapes.

A4 feature branch suggestions: `feature/a4-auth-db`, `feature/a4-services-db`, `feature/a4-queues-db`, `feature/a4-activity-db`. Keep branch labels independent of personal names. Conflict resolution is collaborative, not automatically Member 4's job.
