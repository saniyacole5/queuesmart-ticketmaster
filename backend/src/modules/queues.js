// MEMBER 3: queue lifecycle, priority rules, concurrent/duplicate request tests.
import { fail } from "../shared/errors.js";
import { getService } from "./services.js";
import { orderEntries, estimateWait } from "./waitTime.js";
import * as v from "../shared/validation.js";
export function createQueues(
  store,
  notifications,
  history,
  clock = () => new Date().toISOString(),
) {
  function ordered(serviceId) {
    return orderEntries(store.entries.filter((e) => e.serviceId === serviceId));
  }
  function snapshot(serviceId) {
    const service = getService(store, serviceId);
    return ordered(serviceId).map((e, index) => ({
      ...e,
      position: index + 1,
      estimatedWait: estimateWait(index + 1, service.expectedDuration),
      serviceName: service.name,
      status: index < 2 ? "Almost Ready" : "Waiting",
    }));
  }
  function find(id) {
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) fail(404, "ENTRY_NOT_FOUND", "Active queue entry not found.");
    return entry;
  }
  function close(serviceId) {
    notifications.close(ordered(serviceId), getService(store, serviceId));
  }
  function finish(entry, outcome) {
    store.entries = store.entries.filter((e) => e.id !== entry.id);
    history.finish(entry, outcome);
    notifications.emit(
      entry.userId,
      entry.id,
      outcome,
      `Queue participation in ${getService(store, entry.serviceId).name}: ${outcome}.`,
    );
    close(entry.serviceId);
    return { ...entry, outcome };
  }
  return {
    snapshot,
    mine(userId) {
      const entry = store.entries.find((e) => e.userId === userId);
      return entry
        ? snapshot(entry.serviceId).find((e) => e.id === entry.id)
        : null;
    },
    join(user, serviceId, body) {
      v.object(body, []); // Identity and priority always come from server policy.
      const service = getService(store, serviceId);
      if (!service.isOpen) fail(409, "QUEUE_CLOSED", "This queue is closed.");
      // Keep the duplicate check and insertion synchronous: concurrent HTTP joins
      // cannot interleave in this single-process, in-memory A3 implementation.
      // A persistent/multi-process implementation must enforce this transactionally.
      if (store.entries.some((e) => e.userId === user.id))
        fail(409, "ALREADY_QUEUED", "Leave your active queue first.");
      const entry = {
        id: store.nextId(),
        userId: user.id,
        serviceId,
        name: user.name,
        joinedAt: clock(),
        priority: "standard",
        order: store.nextId(),
      };
      store.entries.push(entry);
      history.joined(entry, service);
      notifications.emit(
        user.id,
        entry.id,
        "joined",
        `You joined ${service.name}.`,
      );
      close(serviceId);
      return snapshot(serviceId).find((e) => e.id === entry.id);
    },
    leave(user, id) {
      const entry = find(id);
      if (entry.userId !== user.id)
        fail(403, "FORBIDDEN", "You can only leave your own queue.");
      return finish(entry, "Left Queue");
    },
    serve(serviceId) {
      if (!getService(store, serviceId).isOpen)
        fail(409, "QUEUE_CLOSED", "Reopen the queue before serving.");
      const next = ordered(serviceId)[0];
      if (!next) fail(409, "QUEUE_EMPTY", "Nobody is waiting.");
      return finish(next, "Served");
    },
    remove(id) {
      return finish(find(id), "Removed");
    },
    priority(id, body) {
      v.object(body, ["priority"]);
      const value = v.choice(body, "priority", ["standard", "priority"]);
      const entry = find(id);
      entry.priority = value;
      close(entry.serviceId);
      return snapshot(entry.serviceId).find((e) => e.id === id);
    },
    move(id, body) {
      v.object(body, ["direction"]);
      const direction = v.choice(body, "direction", ["up", "down"]);
      const entry = find(id),
        items = ordered(entry.serviceId),
        index = items.findIndex((e) => e.id === id);
      const neighbour = items[index + (direction === "up" ? -1 : 1)];
      if (!neighbour || neighbour.priority !== entry.priority)
        fail(
          409,
          "MOVE_NOT_ALLOWED",
          "Move only within the same priority tier.",
        );
      [entry.order, neighbour.order] = [neighbour.order, entry.order];
      close(entry.serviceId);
      return snapshot(entry.serviceId);
    },
  };
}
