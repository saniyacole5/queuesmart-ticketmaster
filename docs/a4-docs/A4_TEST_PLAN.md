# A4 tests, coverage and database-safe CI

## Local baseline and current tools

Backend Node.js 24 test runner (`npm test`) and V8 coverage (`npm run coverage`, configured to enforce 75% line and 75% function coverage). Frontend (`npm run lint`, `npm run build`). The included `backend/test/a4-schema.test.js` is **only scaffold validation** and does not test real persistence.

## Must-add MySQL-backed integration tests

| Area | Example measurable tests |
|---|---|
| Authentication | Registration and second login after backend restart; no plaintext password; duplicate canonical email maps 409; wrong role 403; expiration/logout invalidates session |
| Services | Create/read/update after restart; duration bounds; case-insensitive name conflict 409; services and queues rows agree about open status |
| Queue | 2 simultaneous joins by same user -> only 1 waiting row; FIFO/tier sorting; serve/remove/leave; no unauthorized leave; move boundaries; open/closed checks |
| History | Joined/terminal transition, immutable service-name snapshot after rename, user-scoped queries, survive backend restart |
| Notifications | Joined and almost-ready once per participation, mark-read ownership, persistence after restart |
| Frontend | Data displayed from real SQL; visible loading, empty, failure state; admin/user separate sessions |

**Isolation:** GitHub Actions example `.github/workflows/a4.yml` runs an ephemeral MySQL 8.4 service with temporary CI-only credentials (`ci_only_password`), creates schema, and checks DB reachability. The workflow needs extra real integration tests from members; do not interpret green CI as proof that app.js uses SQL. Do not use the production Aiven database in GitHub CI.

## Evidence for final submission

Capture actual `SHOW TABLES`, `SHOW CREATE TABLE`, FK-related queries, screenshots of Aiven Workbench data after UI operations, output of `npm test`, `npm run coverage`, frontend lint/build, and after-restart persistence. Save the coverage output as needed in the group's report, not fabricated numbers. Do not include live passwords, bearer tokens, private keys or session hashes in screenshots.

## Testing note

Original A3 tests may assume synchronous modules and seed accounts. Converting to async MySQL will require test refactors with isolated fixtures; do not remove tests merely to hide regressions. Node coverage may need relevant include/exclude tuning once repositories are imported. Report actual total coverage with tested source scope.
