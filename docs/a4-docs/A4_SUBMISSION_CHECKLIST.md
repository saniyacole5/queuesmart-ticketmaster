# Assignment 4 group submission checklist

- [ ] `queuesmart_db` on Aiven has the eight reviewed SQL tables, primary keys, foreign keys and indexes; provide DDL printout in submission.
- [ ] Shared schema migration and any updates are in GitHub source control and reproducible on fresh MySQL.
- [ ] Backend registration/login/profile/services/queue/history/notifications use **SQL**, not old `store.js` in production routes.
- [ ] React frontend reads real backend data; empty/loading/error cases and permissions are correct.
- [ ] Data persists after stopping/restarting Express, proven by Workbench query and UI checks.
- [ ] Concurrent joins and terminal state transitions use database constraints and transactions.
- [ ] Auth/admin setup is safe; no plaintext passwords, role self-assignment, secret in code, `.env` or password in GitHub.
- [ ] Separate user and admin sessions verified and no cross-user history/notification leakage.
- [ ] Backend test and coverage results captured from **final merged code**; goal at least 75% line/function threshold configured in project or any different exact course requirement.
- [ ] Frontend lint and build pass and screenshot/demo verification is captured.
- [ ] One group Word/PDF includes repository link, complete SQL schema with primary/foreign keys, genuine test/coverage evidence and actual contributions of all four members.
- [ ] Confirm assignment due date and submission venue directly with current course instructions.
- [ ] All four members reviewed their allocated changes; contribution narratives match real Git commits.
