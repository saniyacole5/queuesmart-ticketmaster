import test from "node:test";
import assert from "node:assert/strict";
import { estimateSmartWait } from "../src/modules/smartWait.js";

test("smart wait scaffold preserves the configured-duration fallback", () => {
  assert.equal(estimateSmartWait(3, 5), 10);
  assert.equal(estimateSmartWait(1, 5), 0);
  assert.throws(() => estimateSmartWait(0, 5), RangeError);
});

test.todo("SMART-1/2: a three-minute median with two people ahead yields six minutes");
test.todo("SMART-1: ignore idle gaps, non-positive intervals, and invalid timestamps");
test.todo("SMART-2: fewer than three usable intervals uses configured duration");
test.todo("SMART-3: service lists and current queue use the same estimate from real MySQL history");
