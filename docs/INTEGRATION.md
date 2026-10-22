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

Queue context mutations return Promises; the included handlers await them and catch errors. Any new call sites must do the same. Read operations start with empty arrays/null, so initial asynchronous loads are safe. `QueueManagementPage` derives its first-service selection after data loads and retains a valid selection across refreshes. Serve/remove/move/priority controls and service selection stay disabled for the full mutation and state-refresh cycle; a synchronous guard prevents overlapping clicks. Join/leave has the same click guard. Queue pages expose loading and refresh failures. Other members own pending controls on their forms as listed in TEAM_PLAN.

Data flow: browser -> Vite /api proxy -> Express route/authorization -> module -> in-memory store -> JSON -> React state. Mutation results refresh state immediately; other sessions update within roughly three seconds. A three-second poll is sufficient for A3; do not label this implementation as WebSocket real-time push.

For API debugging, browser Network should show requests to `/api/auth/login`, `/api/state`, `/api/notifications` and the mutation endpoint. Do not publish authentication tokens/screenshots showing them. A 401 triggers local session reset; reconnect/restart API then log in again. Frontend route guards improve navigation, but backend middleware is the authority.

Use two separate browser profiles/incognito windows for user/admin, because session tokens are held in sessionStorage. You can also log in several registered users in separate contexts to demonstrate ordering and notifications.
