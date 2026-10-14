# Four-person implementation plan

Names are from A1; this allocation is proposed, not a statement of work already done. Swap members if useful, keeping four comparable packages. Each member owns module refinements, validation/tests, frontend integration verification and PR evidence. Required review/completion tasks below turn the reference foundation into your team's implementation. Do not claim scaffold-generated code as personally authored work.

| Member | Primary backend files                                                                             | Frontend responsibility                                                            | Branch                             |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| 1      | `modules/auth.js`, `shared/validation.js`; own `test/auth-member.test.js`                         | Login, admin login, registration, App session restore                              | `feature/a3-auth`                  |
| 2      | `modules/services.js`, `modules/waitTime.js`; own `test/services-member.test.js`                  | ServiceManagementPage, AdminDashboardPage                                          | `feature/a3-services-wait`         |
| 3      | `modules/queues.js`; own `test/queues-member.test.js`                                             | QueueContext, JoinQueuePage, QueueStatusPage, QueueManagementPage                  | `feature/a3-queues`                |
| 4      | `modules/notifications.js`, `modules/history.js`; own `test/history-notifications-member.test.js` | NotificationContext, HistoryPage, UserDashboardPage; CI, demo, submission assembly | `feature/a3-notifications-history` |

Paths above are relative to `backend/src` unless prefixed with `test` (relative to `backend`). Frontend paths are under `frontend/src`. Shared `app.js` / API client / store changes require a short interface discussion. Each member can request route changes. Everyone reviews another member's PR. Existing starter test files remain; add separate member test files to reduce conflicts.

## Member 1: Authentication and validation

Reference already supplies registration, login, stored roles, token sessions, expiry and role middleware.

Required team work:

- Replace synchronous credential hashing/verification with async `node:crypto` scrypt (promisified or callback). Make register/login and their Express routes await it; resolve duplicate registration atomically after hashing so simultaneous registrations cannot create duplicate email identities.
- Improve login/registration pending-state UX so a double click cannot issue overlapping submits. Verify field errors (types/lengths), network errors and successful redirect. Keep administrator creation out of public registration.
- Add your own tests: password lengths 7/8/128/129, whitespace-only name, email case duplicates, duplicate simultaneous registrations, expiry exactly at the boundary, token revoked by logout, wrong role, and payloads trying to set role/ID. Ensure no response returns credential material.
- Verify session reload and expiry behavior in the A2 routes. Add a note describing whether server restarts invalidate browser sessions.

Acceptance: user registration can log in, both demo roles work, wrong credentials return 401, user cannot call admin routes (403), and pending/error states are visible. Tests pass with the asynchronous implementation.

## Member 2: Services and wait-time estimation

Reference supplies create/list/partial update; duration and actual wait are distinct.

Required team work:

- Add a clear duplicate-service-name rule (trim/case-insensitive conflict 409 on create or rename). Updates to the same service's current name must be allowed; conflict must leave original fields unchanged.
- Add service form pending controls and a visible empty/loading state for the admin list. Verify updates preserve queue-open state and use numeric `expectedDuration`, not numeric strings.
- Add own tests: field limits 100/101 and 500/501, duration 1/480 accepted and 0/481 rejected, boolean types, invalid priorities, empty updates, conflict names, and wait estimates for positions 1/2/5.
- Demonstrate that editing duration immediately changes estimates for already waiting users after refresh, without changing their order or historical service name.

Acceptance: only admins mutate services; four required service fields appear in API data, invalid input returns structured 400 errors, and UI duration never uses the dynamic `estimatedWait` field.

## Member 3: Queue lifecycle and ordering

Reference supplies join/leave, role-restricted queue view/serve, admin remove/priority/move and backend-derived status.

Required team work:

- Add pending/error controls to admin serve/remove/move/priority actions; prevent duplicate clicks while a mutation is in flight. Ensure first-service selection after async loading is sensible, instead of requiring a stale initial ID.
- Review/document policy: one active queue per user; higher entry priority first then arrival order; manual movement is an explicit admin override only within the same priority tier; service priority is metadata. If the team chooses a different policy, change tests/contracts/UI together.
- Add own HTTP tests for two simultaneous joins by the same user (one 201, one 409), separate users preserving order, an admin unable to join a user queue, leave after serve (404), closing a queue while people wait, unknown entry IDs, cross-service isolation and move boundaries.
- Verify the user cannot choose an identity or claim priority, and cannot leave another user's entry.

Acceptance: full join -> status -> leave/serve workflow changes the backend state and the UI; position/wait are calculated from ordered entries; no fake “simulate” button controls real status.

## Member 4: Notifications, history and end-to-end evidence

Reference records participation at join, ends it on leave/serve/remove, emits joined/almost-ready/terminal events and exposes only a user's records.

Required team work:

- Add notification polling-error feedback with a successful-refresh recovery state; current reference silently tolerates poll failure. Keep local action feedback distinct from persisted backend event notifications.
- Add own tests for close threshold 2 vs 3, repeated reorder/priority changes not duplicating “almost ready”, leaving and rejoining producing new events/history, read membership, rename preserving historical name, and no user seeing another user's history/notifications.
- Run the two-browser demonstration after all merges. Capture real test/coverage outputs and actual frontend/API evidence. Review the CI workflow and resolve failures caused by integrated changes.
- Assemble the submission PDF/Word from the provided template, collecting actual contributions/discussion notes from each member and verifying GitHub authorship. Document assistance/reference use if your course requires it.

Acceptance: join and close events are returned to the frontend; history records survive navigation but reset on API restart; no real email/SMS or database; submitted contribution claims match real commits.

## Merge and review sequence

1. Agree on endpoint names, validation bounds and policy using API.md. One member imports the foundation in a clearly labeled commit.
2. Branch from that shared foundation. All four members can implement their own package concurrently.
3. Auth async route changes and services rules merge first, then queue UX/tests, then notifications/history and evidence. Each PR includes its own code changes, tests, before/after example and reviewer.
4. After every merge run backend tests/coverage and frontend lint/build. Rebase other branches to keep contracts aligned.
5. Final joint review uses REQUIREMENTS.md and DEMO_CHECKLIST.md. Record actual discussion decisions (not fabricated notes).

Use GitHub accounts configured with each person's own author identity. Do not invent commits or assign author names to generated work. TAs review meaningful contributions and test execution; the assignment says non-contributors receive zero. Each member should make real module, test and integration improvements, not only a README edit.
