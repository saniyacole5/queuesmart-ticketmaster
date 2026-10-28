# Assignment 4 — relational database design and Aiven access

## Where the data lives

Use Aiven MySQL 8.4 service `queuesmart-mysql`, database **`queuesmart_db`**. `defaultdb` is an unrelated Aiven default. `queuesmart_app` is a real Aiven **service user**.

Aiven connection:

```dotenv
DB_HOST=queuesmart-mysql-queuesmart-ticketmaster.i.aivencloud.com
DB_PORT=15771
DB_USER=queuesmart_app
DB_NAME=queuesmart_db
DB_SSL_CA_PATH=./certs/ca.pem
```

The private `DB_PASSWORD` is intentionally absent. The tracked `backend/certs/ca.pem` is public certificate material. Use SSL certificate verification for remote Aiven connections. MySQL Workbench needs host, port, user-specific password, chosen `queuesmart_db`, and the public CA certificate. All teammates may connect with `queuesmart_app`.

## Diagram — keys and relations

```text
user_credentials (PK id, UNIQUE email)
  ├── user_profiles (PK/FK user_id -> user_credentials.id)
  ├── auth_sessions (FK user_id -> user_credentials.id)
  ├── queue_entries (FK user_id -> user_credentials.id)
  ├── history (FK user_id -> user_credentials.id)
  └── notifications (FK user_id -> user_credentials.id)

services (PK id, UNIQUE name)
  ├── queues (PK id, UNIQUE FK service_id -> services.id)
  │   └── queue_entries (PK id, FK queue_id -> queues.id)
  │        ├── history (PK/FK id -> queue_entries.id)
  │        └── notifications (FK entry_id -> queue_entries.id)
  └── history (FK service_id -> services.id)
```

Full reproducible DDL: [`backend/sql/001_schema.sql`](../backend/sql/001_schema.sql). The implementation model preserves A3 public API field names while SQL uses snake_case.

| Table              | Main purpose and important rules                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `user_credentials` | Credential ID, canonical email unique, scrypt hex salt/digest, admin/user role                                 |
| `user_profiles`    | One-to-one user name, optional contact and preferences                                                         |
| `auth_sessions`    | Store SHA-256 token hashes, not raw bearer tokens; expiry verified on every authenticated request              |
| `services`         | Name unique under case-insensitive collation; duration 1–480; priority and is_open                             |
| `queues`           | One queue for each service; open/closed, created timestamp                                                     |
| `queue_entries`    | Durable participation, FIFO sequence inside priority tier; generated unique active user to prevent double join |
| `history`          | One per queue entry, joined/ended timestamp, outcome, service name snapshot unaffected by service rename       |
| `notifications`    | Per-user event/message/read/timestamp and unique (entry_id, event) to suppress duplicate almost-ready messages |

**Consistency decisions:** 1) The existing API reads `services.isOpen`, but Assignment 4 requires a Queue table with open/closed; `services.is_open` and `queues.status` must be updated **atomically** in the same transaction. 2) Queue entries are **soft-finished** (`status='served'/'left'/'removed'`) rather than deleted. All active counts and order queries must filter `status='waiting'`. 3) Existing user-facing queue order uses priority first, then monotonic `order_seq`, then ID. A manual move swaps `order_seq` only within the same tier. Use a transaction and row locks when allocating positions or moving entries. 4) `entryId` is shared by history PK, matching the A3 API.

Never run destructive or fixture-cleanup tests against the live shared database. CI should create a separate ephemeral MySQL service or isolated test schema.
