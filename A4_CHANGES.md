# A4 Changes

## New files

- `backend/sql/001_schema.sql` — empty-schema definition, **no automatic data insertion**.
- `backend/sql/002_demo_services.sql` — **optional** sample services and queue metadata.
- `backend/scripts/check-db.js`, `backend/scripts/migrate.js`, `backend/scripts/seed-services.js` — local CLI helpers.
- `backend/src/db/transaction.js` — transaction helper for queue mutation work.
- `backend/src/db/mappers.js` — SQL snake_case to existing API camelCase transforms.
- `backend/src/repositories/{users,services,queues,activity}.repo.js` — **unimplemented member interfaces**, not deceptively working persistence.
- `backend/test/a4-schema.test.js` — non-destructive SQL / data-mapper scaffold tests.
- `docs/A4_DATABASE_DESIGN.md`, `docs/A4_TEAM_PLAN.md`, `docs/A4_INTEGRATION.md`, `docs/A4_TEST_PLAN.md`, `docs/A4_SUBMISSION_CHECKLIST.md` — implementation/documentation handoffs.
- `.github/workflows/a4.yml` — proposed MySQL-backed CI example.

## Deliberately NOT included / changed

- No `.env`, passwords, Aiven service-user passwords, private keys, or secrets.
- No edits to `backend/src/app.js` or existing A3 modules yet. The existing API remains in-memory until integrated; see A4_INTEGRATION.md.
