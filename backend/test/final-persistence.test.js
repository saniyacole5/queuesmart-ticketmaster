import test from "node:test";

// Member work area - Integration and persistence.
// Use QUEUESMART_DB_TESTS=1 and the existing localhost-only test convention.
// Reuse createFixtures from test/helpers/queue-fixtures.js for tracked cleanup.
test.todo("INTEGRATION-3: a real backend process restart preserves user session, queue entry, history, and notifications");
// Suggested implementation sequence:
// 1. Create tracked user/admin/service fixtures in isolated MySQL.
// 2. Start src/server.js on a free port with all four storage modes mysql.
// 3. Login through HTTP, join, save token and entry/history/notification IDs.
// 4. Stop the child process and await its exit. Start a fresh process.
// 5. Use the SAME token for /auth/me, /queues/me, /history and /notifications.
// 6. Assert the same IDs, position and service details.
// 7. Stop the child and clean up only fixture rows in FK order.
