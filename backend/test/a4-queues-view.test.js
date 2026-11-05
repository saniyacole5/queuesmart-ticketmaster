// MEMBER 3: pure queue derivation logic, no database required.
import test from "node:test";
import assert from "node:assert/strict";
import { decorateEntries, findMoveNeighbour } from "../src/modules/queueView.js";

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
