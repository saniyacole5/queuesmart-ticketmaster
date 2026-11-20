import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell } from "../../frontend/src/utils/reportCsv.js";

test("CSV cells preserve quotes, commas, newlines, zero and empty values", () => {
  assert.equal(escapeCsvCell('A, "B"'), '"A, ""B"""');
  assert.equal(escapeCsvCell("A\nB"), '"A\nB"');
  assert.equal(escapeCsvCell(0), "0");
  assert.equal(escapeCsvCell(null), "");
  assert.equal(escapeCsvCell("=1+1"), "'=1+1");
});

test.todo("CSV-1: CSV includes the same customer, participation, service and total values as its report snapshot");
