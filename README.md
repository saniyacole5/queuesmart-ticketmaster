# QueueSmart Ticketmaster — Assignment 4 (MySQL persistence)

QueueSmart is a React/Vite frontend with a Node.js 24 + Express 5 backend. Assignment 3 uses **in-memory** users, services, queue entries, notifications, and history. Assignment 4 requires a **real persistent MySQL database**, functioning database-backed APIs, React display of actual stored data, input validation, meaningful tests and test coverage, and a group report. The existing frontend/backend API contract is in [`docs/API.md`](docs/API.md).

> **Important current status:** Aiven MySQL connectivity is configured in `backend/src/db/pool.js`, but **a successful connection does not make the application database-backed**. The current `backend/src/app.js` still builds `createStore()` from `backend/src/store.js`. Member work below must replace this production storage path and preserve the API response shapes. `/api/health` should say `storage: 'mysql'` only after that conversion has been verified.

## Setup at a glance

| Component              | Technology                | Where it runs                                      |
| ---------------------- | ------------------------- | -------------------------------------------------- |
| React frontend         | Vite / React              | Your own computer, usually `http://localhost:5173` |
| Express backend        | Node.js 24 / Express 5    | Your own computer, usually `http://127.0.0.1:3001` |
| Shared persistent data | **MySQL 8.4 on Aiven**    | Aiven cloud service                                |
| Aiven project          | `queuesmart-ticketmaster` | Organizational container                           |
| Aiven service          | `queuesmart-mysql`        | Hosted MySQL instance                              |
| MySQL database         | **`queuesmart_db`**       | Contains all application tables                    |
| Runtime MySQL user     | **`queuesmart_app`**      | Used by Node.js, subject to grants                 |

Aiven also has an automatically created `defaultdb` and `avnadmin` account. These are not the intended QueueSmart runtime database/user. Do **not** put an Aiven database password into GitHub, screenshots, documentation, source code, or the React frontend.

## Step 2 — Database credentials and local `.env`

The database is hosted on Aiven; each teammate uses MySQL Workbench or the Node.js backend to connect to the **same `queuesmart_db`**.

The `queuesmart_app` password will be provided. Never paste it in chat or commit it.

The repository already tracks the **public** Aiven CA certificate at `backend/certs/ca.pem`; this is _not_ a secret or private key.

In VS Code terminal **from the repository root**:

```powershell
cd backend
Copy-Item .env.example .env
```

Then edit **`backend/.env`** to replace `REPLACE_WITH_DB_PASSWORD` with the password for **`queuesmart_app`**. The example specifies:

```dotenv
PORT=3001
SESSION_TTL_MINUTES=60
DB_HOST=queuesmart-mysql-queuesmart-ticketmaster.i.aivencloud.com
DB_PORT=15771
DB_USER=queuesmart_app
DB_PASSWORD=REPLACE_WITH_DB_PASSWORD
DB_NAME=queuesmart_db
DB_SSL_CA_PATH=./certs/ca.pem
```

Aiven may change service endpoints, so use the current Aiven dashboard values if they differ. `DB_SSL_CA_PATH` is resolved relative to the **`backend` working directory**. SSL/TLS certificate verification remains enabled for the Aiven connection. `backend/.gitignore` ignores `.env` and does _not_ ignore the tracked public `ca.pem`.

**Quick connection check:**

```powershell
npm ci
npm run db:check
```

A successful connection reports `database: queuesmart_db` and the authenticated account. Before schema creation, `db:check` may report missing tables, which is expected.

## Step 3 — Create currently empty database tables

The Aiven database exists but has **no project tables yet**. Creating a MySQL user or `.env` alone does not create tables.

Project Tables:

1. `user_credentials` — email, salted scrypt digest, role
2. `user_profiles` — profile name and optional contact/preferences, linked to credentials
3. `auth_sessions` — hashed bearer tokens with expiry, linked to credentials
4. `services` — name, description, duration, priority, open state
5. `queues` — one queue per service, open/closed state
6. `queue_entries` — users, ordering, priority, active/terminal status, timestamp
7. `history` — participation outcome and immutable service-name snapshot
8. `notifications` — user-specific events, message, read state, timestamp

`queue_entries` includes a generated-column unique constraint that permits **at most one `waiting` entry per user across all queues**, even when two backends try to join concurrently. Terminal entries remain as records (soft finish) so foreign keys and history remain intact.

To verify schema creation:

```sql
USE queuesmart_db;
SHOW TABLES;
SELECT COUNT(*) AS users FROM user_credentials;
SELECT COUNT(*) AS services FROM services;
```

Both counts should initially be zero. You can optionally insert **demo services only** using `npm run db:seed:services` from `backend` after schema creation; seed is opt-in and safe to rerun. It does **not** create demo users, passwords, or admin accounts. See [`docs/A4_DATABASE_DESIGN.md`](docs/A4_DATABASE_DESIGN.md).

## Step 4 — Run the application locally

Open **two terminals**, each from the repository root:

```powershell
# Terminal 1
cd backend
npm ci
npm run dev
```

```powershell
# Terminal 2
cd frontend
npm ci
npm run dev
```

Visit `http://localhost:5173`. The React/Vite development proxy forwards `/api` calls to the Express server on port `3001` (`frontend/vite.config.js`). The API status is at `http://127.0.0.1:3001/api/health`.

**Critical:** While the old `app.js`/modules still call `createStore()`, this runs **the A3 in-memory backend** and the existing seeded demo credentials may still work, but no records will reach MySQL. Do not claim this is a database-backed demo. The team must replace storage with SQL repositories, await asynchronous queries in Express 5 handlers, and make `/api/health` report the correct storage system.

### Final database-backed demo acceptance

- Register a new user, log in, create services as an admin, join a queue, verify position/wait time, mark notifications read, and complete/leave a queue.
- In Workbench on **Aiven `queuesmart_db`**, verify corresponding SQL rows and foreign key relations.
- Restart **the backend**; the service, user, queue/history and notification data should remain. Sessions should be either durably stored or have an explicitly documented expiration/re-login policy.
- Use separate browser sessions for user/admin and two different users to check isolation, role restrictions, concurrent joins, and queue ordering.
- Verify there is **no dependency on `defaultdb`**, and API data is served from MySQL rather than the old `store.js`.

## Team workflow — four members

Member labels are work packages. Each member should contribute actual code, tests, frontend verification and evidence. Detailed deliverables, file boundaries, handoffs, acceptance criteria and proposed PR order are in [`docs/A4_TEAM_PLAN.md`](docs/A4_TEAM_PLAN.md).

| Work package | Main task                                                                                        | Files owned / scaffold starting points                                                     |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Member 1** | MySQL schema, authenticated users/profiles/sessions and authentication API persistence           | `backend/sql/`, `backend/src/repositories/users.repo.js`, `backend/src/modules/auth.js`    |
| **Member 2** | Services and queue metadata persistence, duration/priority and admin UI                          | `backend/src/repositories/services.repo.js`, `backend/src/modules/services.js`, service UI |
| **Member 3** | Concurrent queue entry lifecycle, positions, priority/move and transaction safety                | `backend/src/repositories/queues.repo.js`, `backend/src/modules/queues.js`, queue UI       |
| **Member 4** | Notifications/history persistence, integration checks, database tests/coverage and demo evidence | `backend/src/repositories/activity.repo.js`, notification/history modules, CI and reports  |

**Shared files** (`backend/src/app.js`, `backend/src/server.js`, `backend/src/db/pool.js`, `frontend/src/api/`, `.github/workflows/`) should be changed by agreement. Preserve the `/api` shapes documented in `docs/API.md`, including `data` response wrapping and error codes. See [`docs/A4_INTEGRATION.md`](docs/A4_INTEGRATION.md).

Suggested feature branches: `feature/a4-auth-db`, `feature/a4-services-db`, `feature/a4-queues-db`, `feature/a4-activity-db`. Base each on the team's agreed updated `a4-scaffold` foundation. Open PRs to the agreed integration branch; require review and rerun tests after each merge. Resolve conflicts collaboratively, never silently replace a teammate's work.

## Testing, CI and submission

From `backend`: `npm test`, `npm run coverage` (current scripts enforce at least 75% line/function coverage for measured backend code). From `frontend`: `npm run lint`, `npm run build`. The included `.github/workflows/a4.yml` is a **proposed** GitHub Actions workflow with a temporary MySQL 8.4 service and intentionally non-production credentials. The included `backend/test/a4-schema.test.js` checks schema structure without touching the shared Aiven database. Actual DB integration tests must be added by the team using an isolated CI/test database and real assertions.

**Never run test suites that clear or reset tables against the shared Aiven `queuesmart_db`.** Use a separate local/CI database, unique fixture IDs and transactions. CI must not require the Aiven password.

The Assignment 4 group submission is one Word/PDF file with: GitHub repository link, SQL schema with primary/foreign keys, real coverage results, and truthful contributions from all four members. Capture evidence of data persisting after backend restart. See [`docs/A4_SUBMISSION_CHECKLIST.md`](docs/A4_SUBMISSION_CHECKLIST.md).

### Documentation reading order

1. **This README**, then [`A4_CHANGES.md`](A4_CHANGES.md) for ZIP-versus-branch file comparisons.
2. [`docs/A4_DATABASE_DESIGN.md`](docs/A4_DATABASE_DESIGN.md): schema, keys, empty database, privileges, SSL.
3. [`docs/A4_TEAM_PLAN.md`](docs/A4_TEAM_PLAN.md): four work packages, handoffs and review order.
4. Existing [`docs/API.md`](docs/API.md) in the GitHub branch: current user/admin endpoint contract.
5. [`docs/A4_INTEGRATION.md`](docs/A4_INTEGRATION.md): safe replacement of in-memory modules.
6. [`docs/A4_TEST_PLAN.md`](docs/A4_TEST_PLAN.md) and [`docs/A4_SUBMISSION_CHECKLIST.md`](docs/A4_SUBMISSION_CHECKLIST.md): verification and evidence.

Existing A3 documents in `docs/` remain useful historical references. Avoid treating their in-memory behavior as A4 acceptance.
