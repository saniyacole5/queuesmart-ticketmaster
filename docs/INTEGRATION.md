# Integrating the completed A2 frontend

Apply the overlay to the reviewed checkout, or compare files manually when your current branch differs. Keep existing frontend package.json, lockfile, CSS, AppShell, ProtectedRoute and other components/assets. No replacement of your repo's root README is required.

| Existing A2 file                | A3 behavior                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| src/App.jsx                     | Restores the account through GET auth/me; manages API login/logout and remounts provider state when user changes |
| pages/LoginPage, AdminLoginPage | Calls login API instead of mockUsers; role resolved by backend                                                   |
| pages/RegisterPage              | Adds required display name; POST register creates a usable account                                               |
| api/client.js (new)             | Shared fetch, bearer token handling, structured errors, expiry event                                             |
| context/QueueContext            | GET state polling; backend mutation methods; aggregate queue counts for dashboards                               |
| pages/ServiceManagementPage     | Uses expectedDuration; awaits service create/patch; displays errors                                              |
| pages/AdminDashboardPage        | API services/counts and open/close patch                                                                         |
| pages/QueueManagementPage       | API queues/serve/remove/move; administrator priority selector; mutation errors                                   |
| pages/JoinQueuePage             | API services, join and own leave; closed queues disabled                                                         |
| pages/QueueStatusPage           | Real current entry; simulation removed; poll updates position/wait                                               |
| pages/UserDashboardPage         | Backend services/current entry; truthful no-active-queue fallback                                                |
| pages/HistoryPage               | API participation records and empty state                                                                        |
| context/NotificationContext     | Polls backend events, marks read through API, separates local UI feedback                                        |
| vite.config.js                  | Development API proxy to localhost:3001                                                                          |

`mockData.js` and `mockUsers.js` can remain in the repo for A2 history, but no overlaid production screen imports them. They do not establish authentication or displayed queue history in this integration.

Queue context mutations return Promises; the included handlers await them and catch errors. Any new call sites must do the same. Read operations start with empty arrays/null, so initial asynchronous loads are safe. `QueueManagementPage` starts without a selected service until data loads; member 3 should improve the default selection. Add pending controls across remaining mutation forms as listed in TEAM_PLAN.

Data flow: browser -> Vite /api proxy -> Express route/authorization -> module -> in-memory store -> JSON -> React state. Mutation results refresh state immediately; other sessions update within roughly three seconds. A three-second poll is sufficient for A3; do not label this implementation as WebSocket real-time push.

For API debugging, browser Network should show requests to `/api/auth/login`, `/api/state`, `/api/notifications` and the mutation endpoint. Do not publish authentication tokens/screenshots showing them. A 401 triggers local session reset; reconnect/restart API then log in again. Frontend route guards improve navigation, but backend middleware is the authority.

Use two separate browser profiles/incognito windows for user/admin, because session tokens are held in sessionStorage. You can also log in several registered users in separate contexts to demonstrate ordering and notifications.

## Session lifetime, reload and restart (Member 1)

**A server restart invalidates every browser session.** Sessions live in `store.sessions`, an in-memory `Map` rebuilt by `createStore()` on boot, so restarting the API discards every issued token. The browser keeps its token — `sessionStorage` is not touched by a server restart — so the two sides disagree until the next request, and that request fails with 401.

Registered accounts are lost the same way: `store.users` is rebuilt on boot and re-seeded with only the two demo accounts. An account created through the registration form before a restart cannot log in afterwards; the password is not wrong, the user no longer exists. Expect to re-register during a demo if the API is restarted mid-run.

Three distinct ways a session ends, all verified against a running stack:

| Trigger | What the user sees |
| --- | --- |
| Token expires (`SESSION_TTL_MINUTES`, default 60) | The next request returns 401; the token is cleared and the app returns to `/login`. |
| API restarts while a page is open | The three-second `/api/state` and `/api/notifications` polls return 401 within one interval, so the page ejects itself to `/login` without a reload. |
| API restarts, then the page is reloaded | `App.jsx` restores through `GET /auth/me`, receives 401, clears the stale token and redirects to `/login`. |

The two restart rows reach `/login` through different code paths. An open page is ejected by the `queuesmart-session-expired` event that `api/client.js` dispatches on any non-login 401. A reload instead fails inside the `/auth/me` restore in `App.jsx`, whose `catch` clears the token directly. Both end with the stale token removed from `sessionStorage`; neither leaves the user on a protected route showing empty data.

While the token is still valid, a reload is non-destructive: the account is restored from `GET /auth/me` and the current route is preserved, including deep routes such as `/history`. The brief `Checking your session...` message is that restore in flight.

Expiry is detected lazily, on the next request — not on a timer. The `expiresAt` returned by login is informational; the frontend does not schedule anything against it, so an idle tab can sit on a protected route past expiry until something polls. With the three-second state/notification polls running on every protected screen, that window is about three seconds in practice.

To demonstrate expiry without waiting an hour, start the API with a short TTL: `SESSION_TTL_MINUTES=0.1 npm start` gives six-second sessions. A session is valid up to its final millisecond and rejected exactly at `expiresAt` (`backend/test/auth-member.test.js` pins that boundary).
