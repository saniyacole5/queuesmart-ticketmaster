# API contract

Base `/api`; JSON request/response. Success is `{ "data": ... }`. Errors are `{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input.", "fields": { "expectedDuration": "Must be a whole number 1-480." } } }`.

All except health/register/login require `Authorization: Bearer <token>`. Role/identity are resolved server-side. IDs are positive integer JSON numbers; URL IDs are digit strings. ISO UTC timestamps are returned; UI formats them for the local timezone. Errors: 400 validation/JSON, 401 missing/expired/invalid credentials, 403 role/ownership, 404 missing service/entry/notification/route, 409 duplicate/closed/empty/move conflict, 413 oversized body, 500 generic unexpected failure. Body limit 16 KB. Unknown body fields are rejected.

| Method/path                             | Access                 | Body                                                           | Data returned                                       |
| --------------------------------------- | ---------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| GET /health                             | Public                 | none                                                           | status/storage                                      |
| POST /auth/register                     | Public                 | name, email, password                                          | public user; 201                                    |
| POST /auth/login                        | Public                 | email, password, optional expectedRole                         | token, expiresAt, user                              |
| GET /auth/me                            | Signed in              | none                                                           | public user                                         |
| POST /auth/logout                       | Signed in              | `{}`                                                           | loggedOut true                                      |
| GET /services                           | Signed in              | none                                                           | service views, queue lengths and new-arrival wait   |
| POST /services                          | Admin                  | name, description, expectedDuration, priority, optional isOpen | new service; 201                                    |
| PATCH /services/:id                     | Admin                  | subset of service fields, at least one                         | updated service                                     |
| GET /queues/me                          | User                   | none                                                           | current entry with status/position/wait, or null    |
| GET /services/:id/queue                 | Admin                  | none                                                           | ordered queue, names and calculated positions/waits |
| POST /services/:id/queue                | User                   | `{}`                                                           | new active entry; 201                               |
| DELETE /queue-entries/:id               | User, own entry        | none                                                           | ended entry, outcome Left Queue                     |
| POST /services/:id/serve-next           | Admin                  | `{}`                                                           | ended entry, outcome Served                         |
| DELETE /admin/queue-entries/:id         | Admin                  | none                                                           | ended entry, outcome Removed                        |
| PATCH /admin/queue-entries/:id/priority | Admin                  | priority: standard or priority                                 | recalculated entry                                  |
| POST /admin/queue-entries/:id/move      | Admin                  | direction: up or down                                          | recalculated service queue                          |
| GET /notifications                      | Signed in, own records | none                                                           | backend event notifications                         |
| PATCH /notifications/:id/read           | Signed in, own record  | `{}`                                                           | notification with read true                         |
| GET /history                            | User, own records      | none                                                           | participation history                               |
| GET /state                              | Signed in              | none                                                           | services, queueEntries, currentQueue, history       |

`/state` is the integration convenience endpoint. Admins see ordered queues across services; regular users receive `queueEntries: []`, only their current entry/history and aggregate service counts. It never trusts a client role or exposes another user's history/notifications. Frontend polls state and notifications every three seconds and refreshes state after successful mutations.

## Field limits and shapes

- User `name`: trimmed string 1-100; `email`: canonical lowercase, valid address syntax, 3-254; `password`: string 8-128 (not trimmed). Confirm password is a UI check, not sent. Registration rejects role/userId extras. Public user: id, name, email, role.
- Service `name`: trimmed 1-100; `description`: trimmed 1-500; `expectedDuration`: JSON integer 1-480 minutes; `priority`: low/medium/high; `isOpen`: boolean, defaults true on creation. No client-created IDs. Partial updates validate the complete patch before mutating.
- Entry `priority`: standard/priority. Joining always grants standard; admins can change it. `order` is a server-controlled sequence; `joinedAt` is an audit timestamp. APIs expose order but never accept it in user requests.
- Queue ordering: priority tier first, then arrival sequence, then entry ID for ties. Default is FIFO within tier. Admin move is an explicit override swapping sequence values only within the same tier and service. Moving past a tier or edge returns 409. Higher service priority is metadata; it does not reorder entries across independent event queues.
- One active queue per user across services. Joining again returns 409; leaving first permits rejoin and creates a new history record. Closed service rejects joins and serve-next; admins can still view, remove, reorder or update priority.
- Current-entry wait = `(position - 1) * expectedDuration`. The first person waits zero by this simple model. Service `estimatedWait` = current queue length \* expectedDuration for a new standard arrival; it is not the per-person duration. Existing positions/waits recompute after all queue changes and service edits.
- Close threshold is positions 1 or 2. Almost-ready notification fires once per participation, including immediately after join if already close. Reordering out and back into the threshold doesn't duplicate it; rejoining gets a new entry/event. Terminal leave/serve/remove emits another event.
- History is recorded at join as Waiting and updated on terminal action, with joinedAt/endedAt. Historical service name is a snapshot. Backend notifications have numeric IDs, event, userId, entryId, message, type, read, createdAt. Local UI feedback IDs start with `local-` and are not stored by the API.

Example registration body:

```json
{
  "name": "Taylor User",
  "email": "taylor@example.com",
  "password": "Password1"
}
```

Example service create body:

```json
{
  "name": "Festival Ticket Queue",
  "description": "General admission tickets",
  "expectedDuration": 5,
  "priority": "medium",
  "isOpen": true
}
```

## A4 extension seam

Replace arrays/maps with repositories and transactional queue operations in A4, while preserving these API names/shapes. The current single-process synchronous queue mutations are atomic within the JS event loop; there is no cross-process or durable consistency. No ORM, database config or simulated database connection is included in A3. SessionStorage bearer tokens and seeded demo accounts are a local classroom setup, not a production deployment design.
