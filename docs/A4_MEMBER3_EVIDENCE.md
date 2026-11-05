# A4 Member 3 — queue lifecycle verification evidence

**Branch:** `feature/a4-queue-lifecycle`
**Date:** 2026-11-05
**Scope:** Transaction-safe queue entry lifecycle — join, leave, serve, remove,
position calculation, priority and SQL transactions.

## What was verified, and where

Two environments, for two different purposes:

| Environment | Purpose |
|---|---|
| Disposable local MySQL 8.4 (port 3307) | Automated integration tests and the end-to-end UI pass. Write-oriented tests commit and clean up, so they must never run against the shared database — the same rule Member 1 encodes in `test/a4-auth-db.test.js`. |
| Shared Aiven `queuesmart_db` | Running the application. Backend boots in full SQL mode and reports `queueStorage: "mysql"`. |

## Automated tests

| Command | Result |
|---|---|
| `npm test` (no database) | 107 passing, 0 failing, 3 skipped |
| `npm run test:db` (local MySQL) | 149 passing, 0 failing |
| `npm run coverage:db` | **98.42% lines, 99.49% functions** (gates: 75%) |

`queues.repo.js` alone is 96.64% lines / 95.24% functions.

Coverage must be measured with the database tests enabled. A bare
`npm run coverage` cannot execute repository SQL and will understate the real
figure. CI (`.github/workflows/a4.yml`) already sets `QUEUESMART_DB_TESTS=1`
against an ephemeral MySQL and uploads `coverage-report.txt`.

## End-to-end pass through the React UI

Backend on SQL (`AUTH_STORAGE`, `SERVICES_STORAGE`, `QUEUE_STORAGE` all `mysql`),
frontend on Vite, two isolated browser sessions (one admin, one user).

| # | Check | Result |
|---|---|---|
| 1 | User joins through **JoinQueue** | Row written; UI shows position and wait from SQL |
| 2 | **QueueStatus** shows position, wait, status | #2 · 5 min · Almost Ready, matching the database |
| 3 | Positions 1–2 read "Almost Ready", 3rd reads "Waiting" | Correct |
| 4 | **QueueManagement** lists the queue in stored order | Matches `order_seq` exactly |
| 5 | Admin priority change | Entry moved above the standard tier, persisted |
| 6 | Admin move within tier | `order_seq` values swapped in SQL |
| 7 | Move past tier boundary | Refused, `409 MOVE_NOT_ALLOWED` |
| 8 | Move buttons at queue edges | Disabled in the UI |
| 9 | Admin serve-next | Entry `served`, `ended_at` set, row retained |
| 10 | **Polling** — admin acts, user tab updates | User moved #2 → #1 within the 3-second poll, no refresh |
| 11 | **Restart survival** — backend killed and restarted | Session and queue position both intact after reload |
| 12 | Duplicate join by the same user | `409 ALREADY_QUEUED`; exactly one waiting row |
| 13 | Leave, then rejoin | New entry ID and a second history row, not a reused one |
| 14 | Empty state | "Nobody is waiting in this queue." |
| 15 | Failure state (backend stopped) | QueueStatus shows "Could not refresh queue information. Retrying automatically." |

Screenshots: `docs/evidence/a4-member3-queue-management.png`,
`docs/evidence/a4-member3-queue-status.png`.

## Database state after the pass

```
+-----+-------------+--------+-----------+-------------------------+
| id  | name        | status | order_seq | ended_at                |
+-----+-------------+--------+-----------+-------------------------+
| 746 | Avery Demo  | left   |         2 | 2026-11-05 23:47:28.580 |
| 747 | Jordan Demo | served |         1 | 2026-11-05 23:39:12.565 |
| 748 | Riley Demo  | served |         3 | 2026-11-05 23:34:52.330 |
| 751 | Avery Demo  | left   |         4 | 2026-11-05 23:50:03.337 |
+-----+-------------+--------+-----------+-------------------------+
```

Every terminal entry is retained rather than deleted, because `history` and
`notifications` hold foreign keys into `queue_entries`. Entry 751 is Avery's
rejoin after leaving 746 — a separate participation, as the contract requires.

Matching history, with real elapsed durations:

```
+-----+------------+----------+
| id  | outcome    | waited_s |
+-----+------------+----------+
| 746 | Left Queue |      772 |
| 747 | Served     |      276 |
| 748 | Served     |       16 |
| 751 | Left Queue |       81 |
+-----+------------+----------+
```

Notifications carry `joined` and `almost-ready` per entry plus the terminal
outcome, with exactly one `almost-ready` per participation even after an entry
was reordered out of and back into the top two — enforced by
`UNIQUE (entry_id, event)`.

## Defects found and fixed during verification

**Timestamps were in two different time frames.** `queue_entries.joined_at` and
`notifications.created_at` used `DEFAULT CURRENT_TIMESTAMP(3)`, which records
the MySQL server's *local* time, while `ended_at` was a JavaScript `Date` stored
as UTC. A queue participation lasting 1.2 seconds reported a wait of 21,601
seconds. Every `joinedAt` the API returned was wrong by the UTC offset, and any
average-wait statistic computed from the pair was meaningless. Both timestamps
are now supplied by the application, so they share one clock and do not depend
on server timezone configuration. Covered by a regression test.

**Inconsistent lock ordering.** `serveNext` locked the `queues` row before the
entry row; `finishEntry` locked only the entry. Deadlock-free by accident, but
it allowed two concurrent leaves in one service to compute ordered lists that
invalidated each other. All mutations now take `queues` before `queue_entries`.

## Known gaps (not Member 3's scope)

1. **Notification and history routes are still gated.** `GET /api/notifications`
   returns `503 FEATURE_NOT_READY` on every 3-second poll, so the UI shows "No
   new notifications" permanently and the browser console fills with 503s. The
   rows exist and are correct — only the read endpoints are missing. Member 4.
2. **`/api/state` returns `history: []`** by design, pinned by a test so the
   seam is not closed accidentally. Member 4.
3. **`UserDashboardPage` renders neither `loading` nor `error`.** With the
   backend down it shows stale data with no indication anything is wrong.
   `QueueStatusPage`, `JoinQueuePage` and `QueueManagementPage` all handle this
   correctly. `UserDashboardPage` is Member 4's verification target.
4. **Login screens advertise A3 demo accounts** (`user@queuesmart.com` /
   `User1234`, `admin@queuesmart.com` / `Admin1234`) that do not exist in the
   SQL database. Misleading during a demo. Member 1.
5. **`services.created_at` and `user_credentials.created_at`** still use
   local-time SQL defaults. Nothing reads them today, but any future report on
   signup or creation dates will hit the same bug fixed above. Member 1.

## Reproducing this

```bash
# 1. Disposable local MySQL (any throwaway instance works)
mysql -h 127.0.0.1 -P <port> -u root -e "CREATE DATABASE queuesmart_db"
mysql -h 127.0.0.1 -P <port> -u root queuesmart_db < backend/sql/001_schema.sql

# 2. backend/.env.test  (gitignored; see backend/.env.example)
#    DB_HOST=127.0.0.1 / DB_PORT=<port> / DB_NAME=queuesmart_db
#    QUEUESMART_DB_TESTS=1

cd backend
npm run test:db        # integration + concurrency
npm run coverage:db    # the coverage figure to report
```
