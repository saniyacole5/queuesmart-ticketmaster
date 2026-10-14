# Final A3 demo and evidence checklist

Use a fresh API process; do not assume generated starter evidence proves your final merged code.

1. Run backend tests and coverage. Save the terminal report using `npm run coverage > coverage-report.txt 2>&1` (PowerShell/cmd/bash compatible). Run frontend lint and build; record command/results, Node version and final commit hash.
2. In one browser, register a named user. Confirm duplicate email and invalid/missing fields show errors. Log in and reload; account restores via API.
3. In a separate browser profile, log in as seeded administrator. Create a service with all four required fields. Edit its duration and priority; close/open it. Verify input boundaries and API-only admin access.
4. Register/login three regular users in separate sessions and join Concert in order. Expected durations initially 12: positions 1/2/3 -> waits 0/12/24. Each gets a joined notification; first two get almost-ready immediately, third when promoted into top two.
5. Admin views queue. Mark the third user priority; that user becomes first with wait 0. Standard users retain arrival order. Manual move works only within a tier. Attempt to move past a tier boundary; explain the policy.
6. Edit expected duration to 5. User waits update within one poll; orders stay fixed. Do not confuse duration with the wait displayed to a new arrival.
7. Admin serves next. The selected user exits the active queue; history is Served. Remaining positions/waits update and eligible close notification appears once. Serve an empty or closed queue -> 409.
8. Another user leaves. History is Left Queue. Rejoin creates new participation and new joined notification. Admin removal records Removed, without claiming a ticket was purchased.
9. Mark a notification read. Refresh the page; backend read state remains until API restart. Verify history and notifications do not contain another user's records.
10. Try duplicate join, join closed service, unknown service ID, numeric-string duration, oversized description, invalid priority, user -> admin operation, and leave another user's entry. Record status codes and structured error fields.
11. Restart API: registered users/queues/history/notifications reset. Old tokens get 401; seeded accounts can sign in again. Demonstrate this is deliberate A3 memory-only behavior.
12. Everyone reviews requirements and final GitHub commit authors/PRs. Fill truthful contribution/discussion rows; submit one final Word/PDF to Canvas. Code/tests must already be in the repository. Do not upload this scaffold ZIP as the Canvas submission.

Recommended evidence: final coverage report, GitHub PR/commit links, one services/queue/history screenshot per feature, and request/response examples with authentication tokens redacted. Keep screenshots optional unless your instructor requires them.
