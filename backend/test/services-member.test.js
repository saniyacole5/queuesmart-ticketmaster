import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";
import { createQueues } from "../src/modules/queues.js";
import { createHistory } from "../src/modules/history.js";
import { createNotifications } from "../src/modules/notifications.js";
import {
    createServices,
    getService,
} from "../src/modules/services.js";
import { estimateWait } from "../src/modules/waitTime.js";

function setup() {
    const store = createStore();
    return { store, services: createServices(store) };
}

// A valid service that each test can customize.
function serviceBody(overrides = {}) {
    return {
        name: "Member 2 Test Event",
        description: "Tickets for test event",
        expectedDuration: 5,
        priority: "medium",
        ...overrides,
    };
}

function expectValidationError(action) {
    assert.throws(
        action,
        (error) =>
            error.status === 400 &&
            error.code === "VALIDATION_ERROR",
    );
}

test("services: duplicate creation ignores case and surrounding spaces", () => {
  const { services } = setup();
  services.create(serviceBody());

  const before = services.list();

  assert.throws(
    () =>
      services.create(
        serviceBody({ name: "  MEMBER 2 TEST EVENT  " }),
      ),
    (error) => error.status === 409,
  );

  assert.deepEqual(services.list(), before);
});

test("services: conflicting rename leaves all fields unchanged", () => {
  const { services, store } = setup();
  services.create(serviceBody());

  const second = services.create(
    serviceBody({ name: "Another Test Event", isOpen: false }),
  );
  const before = { ...second };

  assert.throws(
    () =>
      services.update(second.id, {
        name: "  member 2 test event  ",
        description: "This should not be saved.",
        expectedDuration: 20,
        isOpen: true,
      }),
    (error) => error.status === 409,
  );

  assert.deepEqual(getService(store, second.id), before);
});

test("services: keeping its own name is allowed and preserves closed state", () => {
  const { services } = setup();
  const created = services.create(serviceBody({ isOpen: false }));

  const updated = services.update(created.id, {
    name: "  MEMBER 2 TEST EVENT  ",
    expectedDuration: 10,
  });

  assert.equal(updated.name, "MEMBER 2 TEST EVENT");
  assert.equal(updated.expectedDuration, 10);
  assert.equal(updated.isOpen, false);
});

test("services: name and description length boundaries", () => {
  for (const [field, maximum] of [
    ["name", 100],
    ["description", 500],
  ]) {
    for (const length of [1, maximum]) {
      const { services } = setup();
      const created = services.create(
        serviceBody({ [field]: "x".repeat(length) }),
      );

      assert.equal(created[field].length, length);
    }

    for (const value of ["", "   ", "x".repeat(maximum + 1)]) {
      const { services } = setup();

      expectValidationError(() =>
        services.create(serviceBody({ [field]: value })),
      );
    }
  }
});

test("services: duration accepts boundaries and rejects invalid types or values", () => {
  for (const duration of [1, 480]) {
    const { services } = setup();
    const created = services.create(
      serviceBody({ expectedDuration: duration }),
    );

    assert.equal(created.expectedDuration, duration);
  }

  for (const duration of [0, 481, 1.5, "5", true, null]) {
    const { services } = setup();

    expectValidationError(() =>
      services.create(serviceBody({ expectedDuration: duration })),
    );
  }
});

test("services: isOpen requires a boolean and defaults to true", () => {
  const { services } = setup();
  assert.equal(services.create(serviceBody()).isOpen, true);

  for (const value of [true, false]) {
    const { services: freshServices } = setup();
    assert.equal(
      freshServices.create(serviceBody({ isOpen: value })).isOpen,
      value,
    );
  }

  for (const value of ["true", "false", 0, 1, null]) {
    expectValidationError(() =>
      services.create(serviceBody({ isOpen: value })),
    );
  }
});

test("services: priority accepts only low, medium, or high", () => {
  for (const priority of ["low", "medium", "high"]) {
    const { services } = setup();
    assert.equal(
      services.create(serviceBody({ priority })).priority,
      priority,
    );
  }

  for (const priority of ["urgent", "HIGH", "", 1, null]) {
    const { services } = setup();

    expectValidationError(() =>
      services.create(serviceBody({ priority })),
    );
  }
});

test("services: invalid updates never partially change a service", () => {
  const { services, store } = setup();
  const created = services.create(serviceBody({ isOpen: false }));
  const before = { ...created };

  const invalidUpdates = [
    {},
    { name: "x".repeat(101) },
    { description: "x".repeat(501) },
    { name: "Changed", expectedDuration: "5" },
    { expectedDuration: 0 },
    { expectedDuration: 481 },
    { priority: "urgent" },
    { isOpen: "false" },
    { id: 999 },
  ];

  for (const update of invalidUpdates) {
    expectValidationError(() => services.update(created.id, update));
    assert.deepEqual(getService(store, created.id), before);
  }
});

test("wait: positions 1, 2, and 5 use the expected duration", () => {
  assert.equal(estimateWait(1, 5), 0);
  assert.equal(estimateWait(2, 5), 5);
  assert.equal(estimateWait(5, 5), 20);
});

test("wait: invalid positions and durations are rejected", () => {
  for (const args of [
    [0, 5],
    [-1, 5],
    [1.5, 5],
    ["2", 5],
    [2, 0],
    [2, 481],
    [2, "5"],
  ]) {
    assert.throws(() => estimateWait(...args), RangeError);
  }
});

test("service edits refresh waits without changing queue order or history", () => {
  const { store, services } = setup();
  const history = createHistory(store);
  const notifications = createNotifications(store);
  const queues = createQueues(store, notifications, history);

  const service = services.create(
    serviceBody({ expectedDuration: 5 }),
  );
  const originalName = service.name;

  const people = [101, 102, 103].map((id) => ({
    id,
    name: `Test User ${id}`,
    role: "user",
  }));

  for (const person of people) {
    queues.join(person, service.id, {});
  }

  const before = queues.snapshot(service.id);
  const historyBefore = people.map((person) =>
    history.list(person.id),
  );

  assert.deepEqual(
    before.map((entry) => entry.estimatedWait),
    [0, 5, 10],
  );

  // Change duration and name while people are waiting.
  services.update(service.id, {
    expectedDuration: 10,
    name: "Renamed Test Event",
  });

  // Reading a fresh snapshot recalculates the wait times.
  const after = queues.snapshot(service.id);

  assert.deepEqual(
    after.map((entry) => entry.estimatedWait),
    [0, 10, 20],
  );

  // The same people remain in the same positions.
  assert.deepEqual(
    after.map((entry) => [entry.id, entry.position]),
    before.map((entry) => [entry.id, entry.position]),
  );

  assert.equal(queues.mine(103).estimatedWait, 20);

  // Active queue information uses the updated name.
  for (const entry of after) {
    assert.equal(entry.serviceName, "Renamed Test Event");
  }

  // Existing history stays unchanged, including its original name.
  assert.deepEqual(
    people.map((person) => history.list(person.id)),
    historyBefore,
  );

  for (const person of people) {
    assert.equal(history.list(person.id)[0].serviceName, originalName);
  }
});