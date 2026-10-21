import test from "node:test";
import assert from "node:assert/strict";

import { createNotifications } from "../src/modules/notifications.js";
import { createQueues } from "../src/modules/queues.js";

import { createStore } from "../src/store.js";
import { createHistory } from "../src/modules/history.js";

const JOINED_AT = "2026-10-20T14:00:00.000Z";
const ENDED_AT = "2026-10-20T14:30:00.000Z";

function fixture() {
  const store = createStore();
  let currentTime = ENDED_AT;

  const history = createHistory(store, () => currentTime);

  const service = {
    id: 1,
    name: "Concert Ticket Queue",
  };

  const entry = {
    id: 101,
    userId: 7,
    joinedAt: JOINED_AT,
  };

  return {
    history,
    service,
    entry,
    setTime(value) {
      currentTime = value;
    },
  };
}

test("history: joining records the initial participation details", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);

  assert.deepEqual(history.list(entry.userId), [
    {
      id: entry.id,
      userId: entry.userId,
      serviceId: service.id,
      serviceName: service.name,
      joinedAt: JOINED_AT,
      date: JOINED_AT,
      endedAt: null,
      outcome: "Waiting",
    },
  ]);
});

test("history: lists only the requested user's records, newest first", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);
  history.joined({ ...entry, id: 102, userId: 8 }, service);
  history.joined(
    {
      ...entry,
      id: 103,
      joinedAt: "2026-10-20T14:10:00.000Z",
    },
    service,
  );

  assert.deepEqual(
    history.list(7).map((record) => record.id),
    [103, 101],
  );

  assert.deepEqual(
    history.list(8).map((record) => record.id),
    [102],
  );

  assert.deepEqual(history.list(999), []);
});

test("history: preserves the original service name and join time", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);

  service.name = "Renamed Ticket Queue";
  entry.joinedAt = "2026-10-20T15:00:00.000Z";

  history.finish(entry, "Served");

  const [record] = history.list(entry.userId);

  assert.equal(record.serviceName, "Concert Ticket Queue");
  assert.equal(record.joinedAt, JOINED_AT);
  assert.equal(record.date, JOINED_AT);
});

for (const outcome of ["Served", "Left Queue", "Removed"]) {
  test(`history: records ${outcome} with a completion timestamp`, () => {
    const { history, service, entry } = fixture();

    history.joined(entry, service);
    history.finish(entry, outcome);

    const [record] = history.list(entry.userId);

    assert.equal(record.outcome, outcome);
    assert.equal(record.endedAt, ENDED_AT);
    assert.equal(record.joinedAt, JOINED_AT);
    assert.equal(history.list(entry.userId).length, 1);
  });
}

test("history: rejects invalid outcomes without changing the record", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);
  const before = history.list(entry.userId);

  for (const outcome of [
    "Waiting",
    "Cancelled",
    "served",
    "",
    undefined,
    null,
    42,
  ]) {
    assert.throws(
      () => history.finish(entry, outcome),
      (error) =>
        error.status === 400 &&
        error.code === "VALIDATION_ERROR" &&
        typeof error.fields.outcome === "string",
    );
  }

  assert.deepEqual(history.list(entry.userId), before);
});

test("history: rejects duplicate participation records", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);

  assert.throws(
    () => history.joined(entry, service),
    (error) =>
      error.status === 409 &&
      error.code === "HISTORY_EXISTS",
  );

  assert.equal(history.list(entry.userId).length, 1);
});

test("history: missing participation returns a controlled error", () => {
  const { history, entry } = fixture();

  assert.throws(
    () => history.finish(entry, "Served"),
    (error) =>
      error.status === 404 &&
      error.code === "HISTORY_NOT_FOUND",
  );

  assert.deepEqual(history.list(entry.userId), []);
});

test("history: repeating completion preserves the original end time", () => {
  const { history, service, entry, setTime } = fixture();

  history.joined(entry, service);
  const first = history.finish(entry, "Served");

  setTime("2026-10-20T16:00:00.000Z");

  const repeated = history.finish(entry, "Served");

  assert.deepEqual(repeated, first);
  assert.equal(repeated.endedAt, ENDED_AT);
  assert.equal(history.list(entry.userId).length, 1);
});

test("history: a final outcome cannot be replaced by another outcome", () => {
  const { history, service, entry } = fixture();

  history.joined(entry, service);
  history.finish(entry, "Served");

  const before = history.list(entry.userId);

  assert.throws(
    () => history.finish(entry, "Removed"),
    (error) =>
      error.status === 409 &&
      error.code === "HISTORY_ALREADY_FINISHED",
  );

  assert.deepEqual(history.list(entry.userId), before);
});

test("history: returned objects cannot change stored participation", () => {
  const { history, service, entry } = fixture();

  const joined = history.joined(entry, service);
  joined.serviceName = "Changed outside the module";

  const listed = history.list(entry.userId);
  listed[0].outcome = "Removed";
  listed.length = 0;

  const finished = history.finish(entry, "Served");
  finished.endedAt = "Changed outside the module";

  const [stored] = history.list(entry.userId);

  assert.equal(stored.serviceName, "Concert Ticket Queue");
  assert.equal(stored.outcome, "Served");
  assert.equal(stored.endedAt, ENDED_AT);
});
function notificationFixture() {
    const store = createStore();
    let tick = 0;

    const clock = () =>
      new Date(
        Date.parse(JOINED_AT) + tick++ * 1000,
      ).toISOString();

    const history = createHistory(store, clock);
    const notifications = createNotifications(store, clock);
    const queues = createQueues(
      store,
      notifications,
      history,
      clock,
    );

    const people = [1, 2, 3].map((id) => ({
      id,
      name: `User ${id}`,
      role: "user",
    }));

    return { history, notifications, queues, people };
  }

  function countEvents(notifications, userId, event) {
    return notifications
      .list(userId)
      .filter((notification) => notification.event === event)
      .length;
  }

  test("notifications: repeated events preserve the original notification", () => {
    const { notifications } = notificationFixture();

    const first = notifications.emit(
      1,
      201,
      "joined",
      "You joined Concert Ticket Queue.",
    );

    assert.ok(Number.isSafeInteger(first.id));
    assert.equal(first.read, false);
    assert.equal(first.type, "info");
    assert.equal(first.createdAt, JOINED_AT);

    notifications.markRead(1, first.id);

    const repeated = notifications.emit(
      1,
      201,
      "joined",
      "A different message from a repeated trigger.",
    );

    assert.equal(repeated.id, first.id);
    assert.equal(repeated.createdAt, first.createdAt);
    assert.equal(repeated.message, first.message);
    assert.equal(repeated.read, true);
    assert.equal(notifications.list(1).length, 1);

    const nextVisit = notifications.emit(
      1,
      202,
      "joined",
      "You joined again.",
    );

    assert.notEqual(nextVisit.id, first.id);
    assert.equal(nextVisit.read, false);
    assert.equal(notifications.list(1).length, 2);
  });

  test("notifications: positions 1 and 2 are close, position 3 is not", () => {
    const { queues, notifications, people } =
      notificationFixture();

    for (const person of people) {
      queues.join(person, 1, {});
    }

    assert.equal(queues.mine(2).position, 2);
    assert.equal(queues.mine(3).position, 3);

    assert.equal(
      countEvents(notifications, 1, "almost-ready"),
      1,
    );
    assert.equal(
      countEvents(notifications, 2, "almost-ready"),
      1,
    );
    assert.equal(
      countEvents(notifications, 3, "almost-ready"),
      0,
    );

    for (const person of people) {
      assert.equal(
        countEvents(notifications, person.id, "joined"),
        1,
      );
    }
  });

  test("notifications: serving advances position 3 and triggers almost-ready", () => {
    const { queues, notifications, people } =
      notificationFixture();

    for (const person of people) {
      queues.join(person, 1, {});
    }

    assert.equal(
      countEvents(notifications, 3, "almost-ready"),
      0,
    );

    queues.serve(1);

    assert.equal(queues.mine(3).position, 2);
    assert.equal(queues.mine(3).status, "Almost Ready");
    assert.equal(
      countEvents(notifications, 3, "almost-ready"),
      1,
    );
  });

  test("notifications: repeated moves and priority changes do not duplicate close events", () => {
    const { queues, notifications, people } =
      notificationFixture();

    const entries = people.map((person) =>
      queues.join(person, 1, {}),
    );
    const third = entries[2];

    queues.move(third.id, { direction: "up" });
    assert.equal(queues.mine(3).position, 2);

    queues.move(third.id, { direction: "down" });
    assert.equal(queues.mine(3).position, 3);

    queues.move(third.id, { direction: "up" });
    queues.priority(third.id, { priority: "priority" });
    queues.priority(third.id, { priority: "standard" });

    assert.equal(
      countEvents(notifications, 3, "almost-ready"),
      1,
    );
    assert.equal(
      countEvents(notifications, 3, "joined"),
      1,
    );
  });

  test("notifications/history: rejoining creates distinct visits and lifecycle events", () => {
    const { queues, notifications, history, people } =
      notificationFixture();
    const person = people[0];

    const left = queues.join(person, 1, {});
    queues.leave(person, left.id);

    const served = queues.join(person, 1, {});
    queues.serve(1);

    const removed = queues.join(person, 2, {});
    queues.remove(removed.id);

    assert.equal(
      new Set([left.id, served.id, removed.id]).size,
      3,
    );

    for (const [entry, outcome] of [
      [left, "Left Queue"],
      [served, "Served"],
      [removed, "Removed"],
    ]) {
      const events = notifications
        .list(person.id)
        .filter((notification) => notification.entryId === entry.id)
        .map((notification) => notification.event);

      assert.deepEqual(
        events.sort(),
        ["joined", "almost-ready", outcome].sort(),
      );
    }

    assert.deepEqual(
      history.list(person.id).map((record) => record.outcome),
      ["Removed", "Served", "Left Queue"],
    );

    assert.ok(
      history.list(person.id).every((record) => record.endedAt),
    );

    assert.deepEqual(notifications.list(people[1].id), []);
    assert.deepEqual(history.list(people[1].id), []);
  });

  test("notifications: read changes require ownership and can be repeated", () => {
    const { notifications } = notificationFixture();

    const own = notifications.emit(
      1,
      201,
      "joined",
      "User 1 joined.",
    );

    notifications.emit(2, 202, "joined", "User 2 joined.");
    const otherUserBefore = notifications.list(2);

    assert.throws(
      () => notifications.markRead(2, own.id),
      (error) =>
        error.status === 404 &&
        error.code === "NOTIFICATION_NOT_FOUND",
    );

    assert.throws(
      () => notifications.markRead(1, 999999),
      (error) =>
        error.status === 404 &&
        error.code === "NOTIFICATION_NOT_FOUND",
    );

    assert.equal(notifications.list(1)[0].read, false);

    const firstRead = notifications.markRead(1, own.id);
    const repeatedRead = notifications.markRead(1, own.id);

    assert.deepEqual(repeatedRead, firstRead);
    assert.equal(firstRead.read, true);
    assert.equal(firstRead.createdAt, own.createdAt);
    assert.equal(notifications.list(1).length, 1);
    assert.deepEqual(notifications.list(2), otherUserBefore);
  });

  test("notifications: lists are isolated, newest first, and protect stored records", () => {
    const { notifications } = notificationFixture();

    const first = notifications.emit(
      1,
      201,
      "joined",
      "First notification.",
    );
    const other = notifications.emit(
      2,
      202,
      "joined",
      "Another user's notification.",
    );
    const newest = notifications.emit(
      1,
      203,
      "joined",
      "Newest notification.",
    );

    assert.deepEqual(
      notifications.list(1).map((item) => item.id),
      [newest.id, first.id],
    );
    assert.deepEqual(
      notifications.list(2).map((item) => item.id),
      [other.id],
    );
    assert.deepEqual(notifications.list(999), []);

    first.message = "Changed outside the module.";

    const repeated = notifications.emit(
      1,
      201,
      "joined",
      "Repeated trigger.",
    );
    repeated.createdAt = "Changed outside the module.";

    const listed = notifications.list(1);
    listed[0].read = true;
    listed.pop();

    const marked = notifications.markRead(1, first.id);
    marked.read = false;

    const stored = notifications.list(1);

    assert.equal(stored.length, 2);
    assert.equal(stored[0].read, false);
    assert.equal(stored[1].message, "First notification.");
    assert.equal(stored[1].createdAt, JOINED_AT);
    assert.equal(stored[1].read, true);
  });