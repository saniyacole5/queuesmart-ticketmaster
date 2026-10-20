import { fail } from "../shared/errors.js";

const ALMOST_READY_LIMIT = 2;

export function createNotifications(
  store,
  clock = () => new Date().toISOString(),
) {
  function emit(userId, entryId, event, message) {
    const existing = store.notifications.find(
      (notification) =>
        notification.userId === userId &&
        notification.entryId === entryId &&
        notification.event === event,
    );

    if (existing) {
      return { ...existing };
    }

    const notification = {
      id: store.nextId(),
      userId,
      entryId,
      event,
      message,
      type: "info",
      read: false,
      createdAt: clock(),
    };

    store.notifications.unshift(notification);

    return { ...notification };
  }

  return {
    emit,

    close(ordered, service) {
      ordered
        .slice(0, ALMOST_READY_LIMIT)
        .forEach((entry) => {
          emit(
            entry.userId,
            entry.id,
            "almost-ready",
            `You are close to being served in ${service.name}.`,
          );
        });
    },

    list(userId) {
      return store.notifications
        .filter((notification) => notification.userId === userId)
        .map((notification) => ({ ...notification }));
    },

    markRead(userId, id) {
      const notification = store.notifications.find(
        (item) => item.userId === userId && item.id === id,
      );

      if (!notification) {
        fail(
          404,
          "NOTIFICATION_NOT_FOUND",
          "Notification not found.",
        );
      }

      notification.read = true;

      return { ...notification };
    },
  };
}
