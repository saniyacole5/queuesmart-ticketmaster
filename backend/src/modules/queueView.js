// MEMBER 3: pure derivation shared by the in-memory and SQL queue paths.
// These functions never touch the database: callers pass an already-ordered
// list, so the same ordering rule can be proven once and reused everywhere.
import { estimateWait } from "./waitTime.js";

// Positions 1 and 2 are "close to being served" (docs/API.md).
export const ALMOST_READY_LIMIT = 2;

// `entries` must already be ordered by priority tier, then order, then id.
export function decorateEntries(entries, service) {
  return entries.map((entry, index) => {
    const position = index + 1;

    return {
      ...entry,
      position,
      estimatedWait: estimateWait(position, service.expectedDuration),
      serviceName: service.name,
      status: index < ALMOST_READY_LIMIT ? "Almost Ready" : "Waiting",
    };
  });
}

// Admin move is an override within one tier: it swaps neighbours, and never
// promotes an entry past the tier boundary or off either end of the queue.
export function findMoveNeighbour(ordered, entryId, direction) {
  const index = ordered.findIndex((entry) => entry.id === entryId);
  if (index === -1) return null;

  const neighbour = ordered[index + (direction === "up" ? -1 : 1)];
  if (!neighbour || neighbour.priority !== ordered[index].priority) return null;

  return neighbour;
}
