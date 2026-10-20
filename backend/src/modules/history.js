import { fail } from "../shared/errors.js";
import { choice } from "../shared/validation.js";

const FINAL_OUTCOMES = ["Served", "Left Queue", "Removed"];

export function createHistory(
  store,
  clock = () => new Date().toISOString(),
) {
  return {
    joined(entry, service) {
      const exists = store.history.some(
        (record) => record.id === entry.id,
      );

      if (exists) {
        fail(
          409,
          "HISTORY_EXISTS",
          "History already exists for this queue participation.",
        );
      }

      const record = {
        id: entry.id,
        userId: entry.userId,
        serviceId: service.id,
        serviceName: service.name,
        joinedAt: entry.joinedAt,
        date: entry.joinedAt,
        endedAt: null,
        outcome: "Waiting",
      };

      store.history.unshift(record);

      return { ...record };
    },

    finish(entry, outcome) {
      choice({ outcome }, "outcome", FINAL_OUTCOMES);

      const record = store.history.find(
        (item) => item.id === entry.id,
      );

      if (!record) {
        fail(
          404,
          "HISTORY_NOT_FOUND",
          "Queue participation history not found.",
        );
      }

      if (record.outcome !== "Waiting") {
        if (record.outcome !== outcome) {
          fail(
            409,
            "HISTORY_ALREADY_FINISHED",
            "This queue participation already has a final outcome.",
          );
        }

        // Repeating the same completion preserves the original timestamp.
        return { ...record };
      }

      record.outcome = outcome;
      record.endedAt = clock();

      return { ...record };
    },

    list(userId) {
      return store.history
        .filter((record) => record.userId === userId)
        .map((record) => ({ ...record }));
    },
  };
}