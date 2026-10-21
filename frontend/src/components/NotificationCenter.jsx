import { useNotifications } from "../context/NotificationContext";

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationCenter() {
  const {
    notifications,
    markRead,
    syncStatus,
    readError,
    readingIds,
  } = useNotifications();

  const unread = notifications.filter(
    (item) => !item.read,
  ).length;

  const statusLabel =
    syncStatus === "error"
      ? "Retrying"
      : syncStatus === "recovered"
        ? "Updated"
        : "";

  return (
    <section
      className="notification-center"
      aria-label="Notifications"
    >
      <details>
        <summary>
          Notifications{" "}
          {unread > 0 && (
            <span className="notification-count">
              {unread} new
            </span>
          )}

          {statusLabel && (
            <small role="status"> · {statusLabel}</small>
          )}
        </summary>

        <div className="notification-list">
          {syncStatus === "loading" && (
            <p role="status">Loading notifications...</p>
          )}

          {syncStatus === "error" && (
            <p className="field-error">
              Notification updates are temporarily unavailable.
              Retrying automatically.
            </p>
          )}

          {syncStatus === "recovered" && (
            <p>Notification updates restored.</p>
          )}

          {readError && (
            <p role="alert" className="field-error">
              {readError}
            </p>
          )}

          {notifications.length > 0
            ? notifications.map((item) => (
                <div
                  className={`notification-item ${
                    item.read ? "read" : ""
                  }`}
                  key={item.id}
                >
                  <p>{item.message}</p>
                  <small>{formatTime(item.createdAt)}</small>

                  {!item.read && (
                    <button
                      type="button"
                      disabled={readingIds.includes(item.id)}
                      onClick={() => markRead(item.id)}
                      aria-label={`Mark notification as read: ${item.message}`}
                    >
                      {readingIds.includes(item.id)
                        ? "Saving..."
                        : "Mark read"}
                    </button>
                  )}
                </div>
              ))
            : ["idle", "ready", "recovered"].includes(
                  syncStatus,
                ) && (
                <p>
                  No notifications yet. Queue updates will
                  appear here.
                </p>
              )}
        </div>
      </details>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {notifications[0]?.message || ""}
      </div>
    </section>
  );
}