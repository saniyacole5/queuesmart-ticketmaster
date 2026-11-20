# QueueSmart Ticketmaster

QueueSmart is a React/Vite frontend with a Node.js 24+ and Express 5 backend. The application integrates user authentication, service management, queues, participation history, notifications, and MySQL persistence. The final assignment adds administrator reporting, CSV export, and a historical wait-time feature.

The frontend/backend API contract is documented in [docs/API.md](docs/API.md). The final assignment work areas and demo sequence are in [docs/final-docs/README.md](docs/final-docs/README.md).

## Current implementation

MySQL implementations are available for authentication, services, queue entries, history, and notifications. The four storage settings in `backend/.env` select these implementations.

The final demo scripts and the real backend-process restart test are included. Reporting queries, CSV assembly, and the historical wait-time algorithm still have implementation TODOs. Track their completion in the [final work areas](docs/final-docs/README.md).

## Requirements and setup at a glance

- Node.js 24 or newer and the npm version bundled with Node.js.
- Backend dependencies installed using `npm ci` in `backend`. These include Express and `mysql2`.
- Frontend dependencies installed using `npm ci` in `frontend`. These include React, React Router, Vite, and the configured lint tools.
- Access to the team's Aiven MySQL database for running the application.
- An isolated local or CI MySQL instance for database integration tests.

| Component                 | Technology                | Normal location                      |
| ------------------------- | ------------------------- | ------------------------------------ |
| React frontend            | React / Vite              | `http://localhost:5173`              |
| Backend API               | Node.js 24+ / Express 5   | `http://127.0.0.1:3001`              |
| Shared application data   | MySQL 8.4 on Aiven        | Aiven cloud service                  |
| Aiven project             | `queuesmart-ticketmaster` | Aiven dashboard                      |
| Aiven service             | `queuesmart-mysql`        | Aiven dashboard                      |
| Application database      | `queuesmart_db`           | Shared MySQL instance                |
| Application database user | `queuesmart_app`          | Account subject to configured grants |

MySQL Workbench can be used to inspect tables, foreign keys, and stored rows. Store actual database and demo passwords in your local environment file. Commit the placeholder configuration in `backend/.env.example`.

## Configure the backend

The commands in this README use PowerShell. Begin in the repository root.

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
```

Edit `backend/.env` with the current Aiven connection settings and your chosen demo password.

```dotenv
PORT=3001
SESSION_TTL_MINUTES=60

DB_HOST=queuesmart-mysql-queuesmart-ticketmaster.i.aivencloud.com
DB_PORT=15771
DB_USER=queuesmart_app
DB_PASSWORD=REPLACE_WITH_DB_PASSWORD
DB_NAME=queuesmart_db
DB_SSL_CA_PATH=./certs/ca.pem

AUTH_STORAGE=mysql
SERVICES_STORAGE=mysql
QUEUE_STORAGE=mysql
ACTIVITY_STORAGE=mysql

DEMO_PREFIX=final-demo
DEMO_USER_PASSWORD=REPLACE_WITH_DEMO_PASSWORD
DEMO_API_URL=http://127.0.0.1:3001/api
```

Replace both password placeholders before using the setup commands. Use the current Aiven dashboard values if the service endpoint differs from the example. `DEMO_USER_PASSWORD` must contain 8-128 characters.

The public Aiven CA certificate is tracked at `backend/certs/ca.pem`. `DB_SSL_CA_PATH` is resolved relative to the backend working directory. The database pool verifies the Aiven TLS certificate.

| Setting                  | Persistent component                      |
| ------------------------ | ----------------------------------------- |
| `AUTH_STORAGE=mysql`     | User credentials, profiles, and sessions  |
| `SERVICES_STORAGE=mysql` | Services and their queue metadata         |
| `QUEUE_STORAGE=mysql`    | Queue entries and queue lifecycle actions |
| `ACTIVITY_STORAGE=mysql` | Participation history and notifications   |

Set all four values to `mysql` for the final demo. Each omitted storage setting defaults to the earlier in-memory mode. SQL services require SQL authentication, and SQL queues require SQL services.

`DEMO_API_URL` is used by the runtime and persistence-check scripts. Keep it aligned with the API address used during the demonstration.

## Check the database and schema

From `backend`, run:

```powershell
npm run db:check
```

The command reports the selected database, authenticated database account, MySQL version, and missing project tables. Confirm the database is `queuesmart_db`.

If tables are missing, create them with an account that has the required schema privileges.

```powershell
npm run db:migrate
npm run db:check
```

The migration script runs `backend/sql/001_schema.sql`, whose `CREATE TABLE IF NOT EXISTS` statements support initial setup. Future schema changes require appropriate migrations.

| Table              | Stored information                                               |
| ------------------ | ---------------------------------------------------------------- |
| `user_credentials` | Email, salted scrypt password digest, and role                   |
| `user_profiles`    | Profile name and optional contact/preferences                    |
| `auth_sessions`    | Hashed bearer tokens and session expiry                          |
| `services`         | Service description, expected duration, priority, and open state |
| `queues`           | One queue per service and its open/closed state                  |
| `queue_entries`    | Participation order, priority, status, and timestamps            |
| `history`          | Participation outcome and service-name snapshot                  |
| `notifications`    | User-specific events and read state                              |

A generated-column unique constraint permits at most one waiting entry per user across all queues. Terminal entries are retained so history and notification foreign keys remain valid.

These queries can be run in MySQL Workbench to inspect the current database.

```sql
USE queuesmart_db;
SHOW TABLES;
SELECT COUNT(*) AS users FROM user_credentials;
SELECT COUNT(*) AS services FROM services;
```

The earlier service-only seed remains available as `npm run db:seed:services`. Use the final demo seed below when preparing customer participation data. Additional schema details are in [docs/a4-docs/A4_DATABASE_DESIGN.md](docs/a4-docs/A4_DATABASE_DESIGN.md).

## Administrator setup

Use the administrator account already provisioned in the team's MySQL database.

For the first administrator in a fresh database, add these temporary settings to `backend/.env`. Replace the example values with the intended administrator details.

```dotenv
BOOTSTRAP_ADMIN_NAME=Demo Administrator
BOOTSTRAP_ADMIN_EMAIL=admin@example.test
BOOTSTRAP_ADMIN_PASSWORD=REPLACE_WITH_ADMIN_PASSWORD
```

The password must contain 8-128 characters. From `backend`, run:

```powershell
npm run db:bootstrap-admin
```

The script creates the initial administrator when the database has no administrator. If an administrator already exists, use that existing account. Remove the temporary `BOOTSTRAP_ADMIN_*` settings after initial provisioning.

Sign in at `http://localhost:5173/admin/login`. Public registration creates customer accounts with the `user` role.

## Prepare the final demo data

From `backend`, with `DEMO_PREFIX` and `DEMO_USER_PASSWORD` configured, run:

```powershell
npm run demo:seed
```

The script creates its fixture data in one transaction.

| Demo data                 | Created records                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Service                   | One open service named `Final Demo <DEMO_PREFIX>`, with a five-minute configured duration |
| Customers                 | Seven users named Demo Customer 1 through Demo Customer 7                                 |
| Historical activity       | Four served participations with completion timestamps three minutes apart                 |
| Active queue              | Customers 5 and 6 waiting in the demo service                                             |
| Interactive demo customer | Customer 7, ready to join through React                                                   |
| Activity records          | Matching participation history and notification records                                   |

Customer emails follow `<DEMO_PREFIX>-customer-<number>@example.test`. With the default prefix, sign in as:

```text
final-demo-customer-7@example.test
```

Use the password you configured in `DEMO_USER_PASSWORD`. Customer 7 joins the demo service through the UI, initially behind the two customers seeded into the queue. The historical records provide sample data for the smart-feature and reporting work.

`DEMO_PREFIX` accepts 1-32 lowercase letters, digits, or hyphens. The default value is `final-demo`.

Rerunning the seed with the same prefix detects the existing service and reuses the current dataset. Existing queue progress and customer passwords are retained. `DEMO_USER_PASSWORD` applies when the customers are first created. Change `DEMO_PREFIX` to create an additional dataset for a fresh rehearsal.

## Run the application

Complete the environment, schema, and account setup above. Open two terminals, each initially in the repository root.

### Backend terminal

```powershell
cd backend
npm ci
npm run db:check
npm run demo:seed
npm start
```

For development with automatic backend reloads, use `npm run dev`.

### Frontend terminal

```powershell
cd frontend
npm ci
npm run dev
```

Visit `http://localhost:5173` for the application. The backend normally listens at `http://127.0.0.1:3001`, and its health endpoint is `http://127.0.0.1:3001/api/health`.

Vite forwards `/api` requests to port `3001` through `frontend/vite.config.js`. If the backend port changes, update that proxy target and `DEMO_API_URL`. Vite may select another frontend port when `5173` is occupied, so use the URL printed in its terminal.

Use separate customer and administrator browser sessions for the team demonstration.

## Verify MySQL mode and persistence

Keep the frontend and backend running. Open an additional terminal in `backend`.

```powershell
npm run demo:check
```

The runtime check confirms that the running API reports `mysql` for overall storage and all four component storage fields. Verify data durability using the following sequence.

1. Sign in through React as the customer printed by `demo:seed`, normally `final-demo-customer-7@example.test`.
2. Join the seeded demo service.
3. From the additional backend terminal, capture the current records.

   ```powershell
   npm run demo:capture
   ```

4. In the backend server terminal, press `Ctrl+C`, then start Express again.

   ```powershell
   npm start
   ```

5. Once the backend has started, compare the stored records from the additional backend terminal.

   ```powershell
   npm run demo:verify
   ```

6. Reload the original customer browser tab and confirm that the session, queue position, and stored activity are still available.

The capture and verification scripts compare customer and queue identities, service details, history records, and notification IDs. They authenticate using the configured demo customer each time. The automated restart test below additionally reuses the original session tokens across a real backend-process restart.

The capture is saved locally at `backend/demo-persistence.snapshot.local.json`, which is covered by `.gitignore`. Complete verification before performing further queue actions, because serving, leaving, reordering, and changing services can alter the captured values.

After the persistence check, demonstrate administrator service management and queue actions, the smart estimate, and report generation with CSV download as those final features are completed. The live demo sequence is in [docs/final-docs/demo-and-submission.md](docs/final-docs/demo-and-submission.md).

## Automated verification

### Ordinary backend tests

From `backend`, run:

```powershell
npm test
```

This command loads no environment file automatically. Database suites run when `QUEUESMART_DB_TESTS=1` is explicitly present in the environment. Tests marked as TODO identify work still awaiting implementation.

### Local database tests

Use an isolated local MySQL instance for tests that create and delete fixture rows. Prepare `queuesmart_db` on that instance and create `backend/.env.test` with its connection details.

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=queuesmart_app
DB_PASSWORD=REPLACE_WITH_LOCAL_TEST_PASSWORD
DB_NAME=queuesmart_db
DB_SSL_CA_PATH=
QUEUESMART_DB_TESTS=1
```

Adjust the local port and credentials for your test instance. From `backend`, load the schema into that instance and run the tests.

```powershell
node --env-file=.env.test scripts/migrate.js
npm run test:db
npm run coverage:db
```

The database suites check for a local database host. The shared Aiven database is used for the application and manual demonstration.

The test at `backend/test/final-persistence.test.js` starts the actual backend process in full MySQL mode, creates test accounts and a service, performs customer/admin HTTP actions, restarts the process, and compares the records using the original session tokens. It also checks that the notification read state survives.

To run that test on its own with the local test environment:

```powershell
node --env-file=.env.test --test test/final-persistence.test.js
```

### Frontend checks

From `frontend`, run:

```powershell
npm run lint
npm run build
```

### GitHub Actions and coverage evidence

The workflow at [.github/workflows/a4.yml](.github/workflows/a4.yml) runs on pushes and pull requests. Its displayed name is **Assignment 4 checks**.

The workflow starts an isolated MySQL 8.4 service, creates the schema, enables database tests with `QUEUESMART_DB_TESTS=1`, runs backend tests and coverage, and checks the frontend lint and build. Its database credentials are configured for the temporary CI instance.

To inspect the results:

1. Open the repository's **Actions** tab.
2. Select **Assignment 4 checks** and the run for your branch or pull request.
3. Open the `validate` job.
4. Expand **Run backend tests and coverage**.
5. Find `final persistence survives a real backend process restart` and confirm that it executed successfully.
6. Download the **backend-coverage** artifact for `coverage-report.txt` and the schema file.

The current npm coverage scripts enforce 75% line and function coverage for measured backend code. The final work plan targets at least 80% overall backend coverage. Capture the actual coverage result from the final merged version for submission.

## Team workflow

The four final work areas are documented in [docs/final-docs/README.md](docs/final-docs/README.md). Members choose their work areas and record their actual contributions there.

| Work area                          | Starting points                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Integration and persistence        | Backend environment, startup wiring, demo scripts, and the real restart test           |
| Admin report screen and CSV export | Admin routes/navigation, `ReportsPage.jsx`, and `reportCsv.js`                         |
| Required smart feature             | `smartWait.js`, historical service data, and consistent `estimatedWait` values         |
| Reporting API and coverage         | `reports.repo.js`, the admin report route, database tests, and final coverage evidence |

Coordinate edits to shared files such as `backend/src/app.js`, `backend/src/server.js`, `backend/src/db/pool.js`, `frontend/src/api/`, and `.github/workflows/`. Preserve the API shapes documented in `docs/API.md`, including the `data` response wrapper and existing error codes.

Use feature branches based on the agreed `final` integration branch, review changes together, and rerun checks after merges. Each member should contribute code, tests or verification appropriate to the work area, and a live demo segment.

## Submission and supporting documents

The final group submission is one Word or PDF file uploaded to Canvas. Include the repository link, fresh backend coverage evidence, actual contributions from all four members, and an example generated report with an explanation of its data, generation process, and access permissions. All four members participate in the team demo.

| Document                                                                           | Purpose                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| [docs/API.md](docs/API.md)                                                         | Frontend/backend API contract                    |
| [docs/final-docs/README.md](docs/final-docs/README.md)                             | Final work-area division                         |
| [docs/final-docs/demo-and-submission.md](docs/final-docs/demo-and-submission.md)   | Final demo and submission checklist              |
| [docs/a4-docs/A4_DATABASE_DESIGN.md](docs/a4-docs/A4_DATABASE_DESIGN.md)           | Database tables, keys, privileges, and TLS setup |
| [docs/a4-docs/A4_INTEGRATION.md](docs/a4-docs/A4_INTEGRATION.md)                   | Earlier MySQL integration design                 |
| [docs/a4-docs/A4_TEAM_PLAN.md](docs/a4-docs/A4_TEAM_PLAN.md)                       | Assignment 4 work packages                       |
| [docs/a4-docs/A4_TEST_PLAN.md](docs/a4-docs/A4_TEST_PLAN.md)                       | Earlier test strategy                            |
| [docs/a4-docs/A4_SUBMISSION_CHECKLIST.md](docs/a4-docs/A4_SUBMISSION_CHECKLIST.md) | Assignment 4 submission background               |
| [A4_CHANGES.md](A4_CHANGES.md)                                                     | Earlier scaffold change history                  |
