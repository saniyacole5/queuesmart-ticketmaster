# QueueSmart TicketManager — Assignment 3

QueueSmart is a ticket queue management application with a React frontend and a Node.js/Express backend. Assignment 2 established the frontend screens. Assignment 3 connects those screens to backend APIs for authentication, services, queues, wait estimates, notifications, and participation history.

Repository: [queuesmart-ticketmaster](https://github.com/saniyacole5/queuesmart-ticketmaster)

The backend scaffold provides a working foundation. Each member must complete their selected work package, add meaningful tests, verify frontend integration, and document their actual contributions. See [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) for completion tasks and acceptance criteria.

## Technology and Assignment 3 scope

| Area                 | Technology / approach                           |
| -------------------- | ----------------------------------------------- |
| Frontend             | React, JavaScript, React Router, CSS            |
| Frontend tooling     | Vite and ESLint                                 |
| Backend              | Node.js 24 and Express                          |
| API                  | HTTP endpoints with JSON requests and responses |
| Backend testing      | Built-in Node.js test runner and V8 coverage    |
| Assignment 3 storage | In-memory arrays and maps                       |
| Planned persistence  | MySQL in Assignment 4                           |

Assignment 3 uses in-memory storage. Users created through registration, sessions, queue entries, notifications, and history reset when the backend restarts. Seeded demonstration accounts and services are recreated on startup. Real email/SMS delivery, payments, and production hosting are outside this foundation.

## Install Node.js and npm

Install Node.js on your computer once. Then install project dependencies separately inside `backend` and `frontend`.

### Windows

1. Open the [official Node.js download page](https://nodejs.org/en/download).
2. Select **Node.js 24 LTS** and the **Windows Installer (.msi)** for your computer.
3. Run the installer using its default options, including npm and adding Node.js to PATH.
4. Close and reopen VS Code so its terminal picks up the installation.
5. Open **Terminal → New Terminal** and check:

   ```bash
   node --version
   npm --version
   ```

Node should show `v24.x.x`; npm should display a version number. The npm version bundled with Node.js 24 is sufficient for this project.

If you installed an earlier Node.js version with the Windows installer, install Node.js 24 using the same method. If you use a version manager, select/install Node.js 24 through that manager instead.

On macOS or Linux, use the official download page's instructions for your operating system or your existing version manager, then verify both commands above.

Also install Git and a code editor such as VS Code. Python is not required to install dependencies or run the project.

## Get the project

For a new local copy:

```bash
git clone https://github.com/saniyacole5/queuesmart-ticketmaster.git
cd queuesmart-ticketmaster
```

If you already have a local copy, open it in VS Code. Commit or otherwise preserve your current work before switching branches or pulling updates. Start new work from the latest shared foundation on `main`.

## Run the project

Run the backend and frontend in **two separate terminals**. Both examples begin in the repository root, `queuesmart-ticketmaster`.

### Terminal 1: backend

```bash
cd backend
npm ci
npm run dev
```

`npm ci` installs dependencies from `package-lock.json`. Both `package.json` and `package-lock.json` must be present in the backend folder.

Check the API in your browser:

```text
http://127.0.0.1:3001/api/health
```

A JSON response containing `"status":"ok"` confirms that the API is running.

### Terminal 2: frontend

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

Keep both terminals running while using the application. Press `Ctrl+C` in a terminal to stop its server. On later runs, use `npm run dev` in each folder; reinstall dependencies when the lockfile changes.

The Vite development proxy forwards `/api` requests to `http://127.0.0.1:3001`. If you change the backend port, update the proxy target in `frontend/vite.config.js` too. The backend runs with defaults without a `.env` file; optional settings are described in `backend/.env.example`.

### Local demonstration accounts

| Role          | Email                  | Password    |
| ------------- | ---------------------- | ----------- |
| User          | `user@queuesmart.com`  | `User1234`  |
| Administrator | `admin@queuesmart.com` | `Admin1234` |

Use these accounts for local testing. Register additional users to test separate queues and account permissions. These two accounts are re-seeded on every boot, so they always work; accounts you register yourself do not survive a restart. A restart always invalidates your browser session and the app returns you to the sign-in page — see [Session lifetime, reload and restart](docs/INTEGRATION.md#session-lifetime-reload-and-restart-member-1).

## Project layout

All team documentation is in **`/docs` at the repository root**.

| Location                                     | Purpose                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `README.md`                                  | Project overview, setup, run instructions, and team workflow                    |
| `backend/package.json` / `package-lock.json` | Backend commands and dependency versions                                        |
| `backend/src/server.js`                      | Starts the API server                                                           |
| `backend/src/app.js`                         | Express routes, authentication checks, and error handling                       |
| `backend/src/store.js`                       | In-memory application data                                                      |
| `backend/src/modules/`                       | Six backend modules                                                             |
| `backend/src/shared/`                        | Shared input validation and error utilities                                     |
| `backend/test/`                              | Backend unit and API tests                                                      |
| `frontend/src/api/`                          | Shared API request client                                                       |
| `frontend/src/context/`                      | Queue and notification state connected to the API                               |
| `frontend/src/pages/` / `components/`        | Application screens and reusable UI                                             |
| `frontend/vite.config.js`                    | Frontend development configuration and API proxy                                |
| `docs/`                                      | Requirements, member work packages, API contract, integration, and verification |

Preserve the completed Assignment 2 layout and styling when integrating backend behavior. Replace mock data and simulated actions with API calls. Display backend responses, handle errors, and prevent repeated submissions while requests are pending.

## Documentation reading order

Read this root README first, then the `/docs` files in the following order:

| Order | Document                                    | Purpose / when to use it                                                                                    |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | [REQUIREMENTS.md](docs/REQUIREMENTS.md)     | Understand each Assignment 3 requirement and its code, tests, and demonstration evidence.                   |
| 2     | [TEAM_PLAN.md](docs/TEAM_PLAN.md)           | Choose a member work package; review tasks, acceptance criteria, and merge order.                           |
| 3     | [API.md](docs/API.md)                       | Agree on endpoints, request/response fields, permissions, validation, and queue rules before changing code. |
| 4     | [INTEGRATION.md](docs/INTEGRATION.md)       | Connect the existing frontend screens to the backend and preserve the Assignment 2 design.                  |
| 5     | [VERIFICATION.md](docs/VERIFICATION.md)     | Review the foundation's checks, limitations, and remaining team verification.                               |
| 6     | [DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md) | Test the complete user/admin workflow after integration and before submission.                              |

Everyone should read documents 1–4 before starting their selected package. Use documents 5–6 throughout testing and the final joint review. Generate fresh test and coverage results from the final merged code.

## Four-member work packages

Member numbers identify work packages. They are not assigned to specific people. Each person should choose a package with the team and record the selection in `docs/TEAM_PLAN.md`.

| Member package | Primary responsibility                                               | Frontend integration                                                        |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Member 1       | Authentication, registration, sessions, roles, and shared validation | User/admin login, registration, and session restoration                     |
| Member 2       | Service management and wait-time estimation                          | Service management and administrator dashboard                              |
| Member 3       | Queue lifecycle, priority, ordering, and queue permissions           | Join/leave, queue status, queue context, and administrator queue management |
| Member 4       | Notifications and participation history                              | Notification context, history, and user dashboard                           |

Each member is responsible for implementation refinements, validation, tests, frontend verification, and a reviewable pull request for their package. Everyone participates in final integration, the demo checklist, and contribution documentation.

Discuss changes to shared files such as `app.js`, `store.js`, contexts, or the API client before editing them. Keep API behavior and frontend expectations aligned with `docs/API.md`.

## Team Git workflow

After preserving any current local changes, create a feature branch from the latest `main`:

```bash
git switch main
git pull origin main
git switch -c feature/a3-auth
```

Suggested branch names:

| Member package | Branch                             |
| -------------- | ---------------------------------- |
| Member 1       | `feature/a3-auth`                  |
| Member 2       | `feature/a3-services-wait`         |
| Member 3       | `feature/a3-queues`                |
| Member 4       | `feature/a3-notifications-history` |

Before committing, run the relevant checks and inspect `git status` and `git diff`. Stage the specific files you changed, commit with a clear message, and push your branch. For example, for Member 1:

```bash
git status
git diff
git add backend/src/modules/auth.js backend/test/auth-member.test.js
git commit -m "Improve authentication validation and add boundary tests"
git push -u origin feature/a3-auth
```

Use your actual changed paths; the member test file in this example is created as part of the work package. Include any related route, validation, or frontend changes you made.

Open a pull request to `main` with a summary, test results, and any API changes. Have another member review it. Follow the merge sequence in `docs/TEAM_PLAN.md`, and rerun integration checks after merges.

**Conflict resolution is shared.** The member whose branch has conflicts should work with the members who edited the affected files, preserve the intended behavior, and rerun checks before merging. No single member is assigned responsibility for all push or merge conflicts. Avoid force-pushing shared branches.

Use your own GitHub account and author identity for your contributions. Do not commit `node_modules`, `dist`, coverage output, `.env`, or private credentials. When adding a dependency, commit both the relevant `package.json` and `package-lock.json`.

## Tests and verification

From the repository root, run the backend checks:

```bash
cd backend
npm test
npm run coverage
```

The scaffold's coverage command also runs the tests and enforces at least **75% line coverage and 75% function coverage** for the measured backend code; server startup is excluded. Add meaningful boundary, permissions, lifecycle, and integration tests as features change.

In a separate terminal starting at the repository root, run frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

A successful build verifies that the frontend compiles. Complete [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md) with separate user/admin browser sessions to verify actual behavior across the frontend and backend.

If retained, `.github/workflows/a3.yml` automates the backend coverage and frontend lint/build checks on GitHub. It is optional for local development. A workflow stored only in `ci/` will not run as a GitHub Action.

## Troubleshooting

| Problem                           | What to check                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `npm` is not recognized | Reopen VS Code after installation. On Windows, use `where.exe node` and `where.exe npm` to check which installation is found.                                                                                   |
| PowerShell blocks `npm.ps1`       | Use Command Prompt as the VS Code terminal, or run `npm.cmd` instead of `npm`.                                                                                                                                  |
| `npm ci` fails                    | Confirm you are in `backend` or `frontend` and that its manifest and lockfile are present and consistent. For an intentional dependency change, use `npm install` to update the lockfile and commit both files. |
| Frontend requests fail            | Keep the backend running, check `/api/health`, and verify the Vite proxy target and backend port match.                                                                                                         |
| Port is already in use            | Stop the other server using that port, or agree on a replacement port and update the relevant configuration.                                                                                                    |
| Queue data disappears             | Backend restarts reset in-memory data. Recreate test users/queue entries as needed.                                                                                                                             |

`npm run build` creates frontend build files; it does not start the backend or configure production hosting. Use the two development servers above for the Assignment 3 local demonstration.

## Before submission

1. Review every requirement in `docs/REQUIREMENTS.md` against the final implementation.
2. Merge all reviewed member work and rerun backend tests/coverage and frontend lint/build.
3. Complete the two-browser demo checklist and resolve integration issues together.
4. Push the final backend, frontend integration, tests, and documentation to GitHub.
5. Prepare the required group Word/PDF document with the repository link, backend technology and design rationale, actual member contributions, and discussion notes. Agree together on who assembles and submits it.
6. Submit the group document through Canvas according to Assignment 3. Keep code and tests in GitHub and confirm the deadline and submission details in Canvas.

The final submission should reflect each member's actual implementation, testing, integration, and review work.
