# QueueSmart API (Assignment 3)

Node.js 24 + Express 5; ES modules; built-in Node test runner and V8 coverage. No database packages/connections. The store resets on restart.

Run `npm ci`, then `npm run dev` (watch) or `npm start`. Run `npm test` / `npm run coverage`. Coverage checks at least 75% lines and functions across `src`, excluding only the server startup file; branch coverage is reported for review. Assignment target is 70-80%, with meaningful tests preferred over a perfect score. Do not exclude business modules to improve the result.

Optional: copy `.env.example` to `.env`. The server binds to localhost. Dev integration uses the Vite proxy, so no cross-origin credential configuration is needed. This is a single-process classroom demo, with local seeded accounts and in-memory opaque bearer sessions. Tokens expire after 60 minutes by default and logout revokes them. Public registration always creates `user`; admins are seeded by server policy. Scrypt hashes are salted; hashes/passwords never appear in API user responses.

The baseline uses synchronous hashing and in-process arrays/maps for simplicity. Owner 1's burst/login task addresses event-loop blocking. Multi-process queues, payments, ticket inventory, SMS/email, appointment booking, and production hosting are not A3 requirements and are not implemented. History means queue participation, not proof of ticket purchase.

For code owners and API details, see the ZIP's docs, or `../docs/a3/` after applying it to the repository.
