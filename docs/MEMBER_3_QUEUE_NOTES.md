# Member 3: queue lifecycle and ordering

Implemented against repository base `3eb4a4e162489014d18c18559733ada973edcea7` on local branch `feature/a3-queues`.

## Changes

- QueueManagementPage derives a sensible first-service selection after asynchronous loading. A valid selection survives refreshes; a missing selection falls back to the first service.
- Serve, remove, move and priority actions share a synchronous in-flight guard, disabled controls, visible progress, accessible errors and success feedback. Service selection stays locked during a mutation. Errors clear on the next action and controls recover in `finally`.
- QueueManagementPage displays backend positions and explains tier-limited manual moves. Buttons also reflect tier/edge restrictions.
- JoinQueuePage guards overlapping join/leave requests and shows progress, initial loading, empty services and refresh failures. QueueStatusPage does not mistake the initial load or a failed refresh for an absent entry.
- Existing QueueContext was reviewed and retained: it already awaits backend mutations and refreshes state, exposes loading/errors, and rejects stale refresh results. No shared API/store/app contract changes were needed.
- Existing queue business behavior was retained. Added a code comment documenting why duplicate-check/insertion must remain synchronous in this in-memory implementation.
- Added six HTTP tests in `backend/test/queues-member.test.js`.

## Reviewed policy (existing API contract retained)

1. A user can have only one active queue entry across all services. Joining accepts an empty object only; identity and standard priority come from the server. Admins cannot join user queues.
2. Entry priority sorts before arrival sequence; entry ID breaks ties. Service priority is metadata and does not reorder people.
3. Manual moves are an explicit administrator override, swapping order only between adjacent entries in the same service and priority tier. Tier crossings and edge moves return 409. Original joinedAt remains an audit timestamp.
4. Closing preserves waiting users and blocks join/serve. View, leave, removal, movement and priority changes remain available.
5. Position and wait come from the ordered backend snapshot. Wait is `(position - 1) * expectedDuration`. No simulation changes status.
6. Ownership is checked on leave; a served/removed/left entry is no longer active and returns 404 on subsequent leave. Rejoin creates a new participation.

These are documented implementation findings, not a claim that a team meeting or peer review occurred.

## Verification performed

Environment: Node v24.19.0, 2026-10-21.

- `cd backend && npm run coverage`: 44/44 tests pass; 100% lines, 100% functions, 98% branches overall. Queue module has 100% line/function/branch coverage. The command enforces 75% minimum lines/functions.
- `cd frontend && npm run lint`: passed.
- `cd frontend && npm run build`: passed.
- `git diff --check`: passed.

New HTTP tests cover concurrent duplicate joins both within/across services (one 201, one 409, one history record); FIFO/priority/manual movement; position/wait recalculation; cross-service isolation; admin/user restrictions; client identity/priority/order injection; ownership; leave after serve; close while waiting; unknown entries/services; edge/tier boundaries; successful leave/rejoin/removal.

Browser verification could not run: this environment lacked a browser executable and the Chromium download returned invalid archives. Do not claim browser demo evidence or screenshots from this run. HTTP tests verify backend state; lint/build verify frontend compilation, not browser interactions.

## Browser handoff check

Start the API with `cd backend && npm ci && npm start` and the frontend in another terminal with `cd frontend && npm ci && npm run dev`. Use separate user/admin browser profiles (demo credentials are in the project README).

1. Open `/admin/queue` directly and confirm the first service appears after loading; switch service and verify polling retains the selection.
2. Join three users in arrival order. Verify their status positions/waits and the administrator's ordered table.
3. Promote the third entry, move adjacent entries within a tier, and confirm tier/edge buttons are disabled. Confirm the other service remains unchanged.
4. Throttle requests in browser developer tools. For each serve/remove/move/priority action, confirm pending text, locked controls and a single mutation request despite repeated clicks. Trigger a failed request, then retry; confirm the error clears and controls recover.
5. Serve a user and confirm their status/history refresh. Leave another user's own queue through Join Queue, then rejoin.
6. Close a queue while users wait; verify they remain visible, serve/join are disabled, and leave/admin management still work.

## Integration and authorship

These changes were prepared with AI assistance and published through the connected GitHub account for review. Publication does not establish personal authorship of the reference scaffold or completion of a team review. Record assistance as required by the course. Peer review and the browser walkthrough remain team follow-up items.
