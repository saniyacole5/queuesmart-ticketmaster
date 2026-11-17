# Integration and persistence

Make the existing React, Express, and MySQL components easy to start together and verify from a fresh checkout.

## Implementation

- Update the setup instructions to reflect the current MySQL code. Coordinate changes to shared API wiring with the reporting and smart-feature work.
- Use the existing database scripts to prepare a repeatable demo with an administrator, customer accounts, an open service, and enough waiting and served entries for the demo.
- Add an integration check for customer login, joining, admin service and queue actions, and history after the backend restarts.

Start with `backend/.env.example`, `backend/src/app.js`, `backend/src/server.js`, and `backend/scripts/`.

## Completion checks

- [ ] The demo backend has `AUTH_STORAGE`, `SERVICES_STORAGE`, `QUEUE_STORAGE`, and `ACTIVITY_STORAGE` set to `mysql`. The `/api/health` response reports `data.storage` as `mysql`.
- [ ] A customer can log in and join through React. The same queue entry is visible after an Express restart and page reload.
- [ ] The team can reproduce the demo setup from the instructions, including separate customer and administrator sessions.

Share the setup steps and demo fixture details with the team before rehearsal.
