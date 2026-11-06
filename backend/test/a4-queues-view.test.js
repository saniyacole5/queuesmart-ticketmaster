// MEMBER 3: pure queue derivation logic, no database required.
import test from "node:test";
import assert from "node:assert/strict";
import { decorateEntries, findMoveNeighbour } from "../src/modules/queueView.js";
import { createQueues } from "../src/modules/queues.js";

// SQL mode ignores the in-memory store entirely, so the fakes stay null.
const sqlQueues = (repository) =>
  createQueues(null, null, null, undefined, repository);

test("decorateEntries numbers positions from 1 and derives wait from duration", () => {
  const out = decorateEntries(
    [
      { id: 7, priority: "standard" },
      { id: 8, priority: "standard" },
      { id: 9, priority: "standard" },
    ],
    { name: "Box Office", expectedDuration: 5 },
  );

  assert.deepEqual(
    out.map((e) => e.position),
    [1, 2, 3],
  );
  assert.deepEqual(
    out.map((e) => e.estimatedWait),
    [0, 5, 10],
  );
  assert.deepEqual(
    out.map((e) => e.status),
    ["Almost Ready", "Almost Ready", "Waiting"],
  );
  assert.equal(out[0].serviceName, "Box Office");
});

test("findMoveNeighbour refuses edges and cross-tier moves", () => {
  const ordered = [
    { id: 1, priority: "priority" },
    { id: 2, priority: "standard" },
    { id: 3, priority: "standard" },
  ];

  assert.equal(findMoveNeighbour(ordered, 1, "up"), null); // top edge
  assert.equal(findMoveNeighbour(ordered, 3, "down"), null); // bottom edge
  assert.equal(findMoveNeighbour(ordered, 2, "up"), null); // would cross tier
  assert.equal(findMoveNeighbour(ordered, 2, "down").id, 3); // same tier
});

test("SQL mode delegates join and preserves validation", async () => {
  const calls = [];
  const queues = sqlQueues({
    joinQueue: async (args) => (calls.push(["join", args]), { id: 1, position: 1 }),
    adjustEntry: async (args) => (calls.push(["adjust", args]), []),
  });

  await queues.join({ id: 7 }, 3, {});
  assert.deepEqual(calls[0], ["join", { userId: 7, serviceId: 3 }]);

  // Identity and priority come from server policy, never the request body.
  await assert.rejects(
    () => queues.join({ id: 7 }, 3, { priority: "priority" }),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );

  await assert.rejects(
    () => queues.priority(1, { priority: "urgent" }),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );

  await assert.rejects(
    () => queues.move(1, { direction: "sideways" }),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR",
  );

  // Rejected input never reached the repository.
  assert.equal(calls.filter(([name]) => name === "adjust").length, 0);
});

test("SQL mode maps each action to its repository call", async () => {
  const calls = [];
  const record = (name) => async (args) => (calls.push([name, args]), []);
  const queues = sqlQueues({
    listActiveEntriesByService: record("list"),
    finishEntry: record("finish"),
    serveNext: record("serve"),
    adjustEntry: record("adjust"),
  });

  await queues.snapshot(3);
  await queues.leave({ id: 7 }, 11);
  await queues.serve(3);
  await queues.remove(12);
  await queues.priority(13, { priority: "priority" });
  await queues.move(14, { direction: "up" });

  assert.deepEqual(calls, [
    ["list", 3],
    ["finish", { entryId: 11, outcome: "Left Queue", actingUserId: 7 }],
    ["serve", { serviceId: 3 }],
    ["finish", { entryId: 12, outcome: "Removed", isAdmin: true }],
    ["adjust", { entryId: 13, priority: "priority" }],
    ["adjust", { entryId: 14, direction: "up" }],
  ]);
});

// Review Focus 2
test("mine returns null when the user has no active entry", async () => {
  const queues = sqlQueues({ findActiveEntryForUser: async () => null });

  assert.equal(await queues.mine(7), null);
});

test("memory mode is unchanged when no repository is supplied", () => {
  const queues = createQueues(
    { entries: [], services: [], nextId: () => 1 },
    { emit() {}, close() {} },
    { joined() {}, finish() {} },
  );

  // Still the synchronous A3 contract, not a Promise-returning shim.
  assert.deepEqual(queues.snapshot.constructor.name, "Function");
  assert.equal(queues.mine(7), null);
});
