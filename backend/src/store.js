// A4 seam: replace this store with repositories; keep module/API contracts stable.
export function createStore() {
  let sequence = 100;
  return {
    nextId: () => ++sequence,
    users: [], sessions: new Map(), entries: [], history: [], notifications: [],
    services: [
      { id: 1, name: 'Concert Ticket Queue', description: 'Queue for available concert tickets.', expectedDuration: 12, priority: 'high', isOpen: true },
      { id: 2, name: 'Texans Ticket Queue', description: 'Queue for available Texans tickets.', expectedDuration: 20, priority: 'medium', isOpen: true },
      { id: 3, name: 'Rockets Ticket Queue', description: 'Queue for available Rockets tickets.', expectedDuration: 3, priority: 'low', isOpen: false },
    ],
  };
}
