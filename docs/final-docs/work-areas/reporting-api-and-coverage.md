# Reporting API and coverage

Provide the administrator report data from MySQL and capture coverage from the final merged backend.

## Implementation

- Add a report endpoint that uses the existing administrator check.
- Return the customer list and participation history, service details and queue activity, and per-service statistics. Include served visits, distinct customers served, and average wait in minutes from joining to **Serve Next**. Compute the average from served records and show when a service has no served entries.
- Test administrator access, customer access denial, expected totals, and empty data. Agree on the response fields with the member working on the report screen and CSV.

Start with `backend/src/app.js`, `backend/src/repositories/activity.repo.js`, `backend/sql/001_schema.sql`, and the existing backend tests.

## Completion checks

- [ ] The administrator report includes the demo service and its newest queue activity after **Serve Next**.
- [ ] The same demo data produces the expected served count and average wait.
- [ ] Run `npm run coverage:db` in `backend` against an isolated MySQL test database with `QUEUESMART_DB_TESTS=1`. Aim for at least 80% overall backend coverage and capture a screenshot or summary of the final run.

Share the final coverage evidence and the report metric definitions for the submission.
