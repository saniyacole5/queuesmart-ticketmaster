// OWNER 4: notifications/history, integration/demo evidence; delivery is in memory.
import { fail } from '../shared/errors.js';
export function createNotifications(store, clock = () => new Date().toISOString()) {
  function emit(userId, entryId, event, message) {
    if (store.notifications.some(n => n.entryId === entryId && n.event === event)) return;
    store.notifications.unshift({ id: store.nextId(), userId, entryId, event, message, type: 'info', read: false, createdAt: clock() });
  }
  return {
    emit,
    close(ordered, service) {
      ordered.slice(0, 2).forEach(entry => emit(entry.userId, entry.id, 'almost-ready', `You are close to being served in ${service.name}.`));
    },
    list: userId => store.notifications.filter(n => n.userId === userId).map(n => ({ ...n })),
    markRead(userId, id) {
      const n = store.notifications.find(n => n.userId === userId && n.id === id);
      if (!n) fail(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      n.read = true; return { ...n };
    },
  };
}
