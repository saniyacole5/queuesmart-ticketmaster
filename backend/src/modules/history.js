export function createHistory(store, clock = () => new Date().toISOString()) {
  return {
    joined(entry, service) {
      store.history.unshift({ id: entry.id, userId: entry.userId, serviceId: service.id,
        serviceName: service.name, joinedAt: entry.joinedAt, date: entry.joinedAt, endedAt: null, outcome: 'Waiting' });
    },
    finish(entry, outcome) {
      const record = store.history.find(h => h.id === entry.id);
      record.outcome = outcome; record.endedAt = clock();
    },
    list: userId => store.history.filter(h => h.userId === userId).map(h => ({ ...h })),
  };
}
