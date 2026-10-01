import { useNotifications } from "../context/NotificationContext";

export default function NotificationCenter() {
  const { notifications, markRead } = useNotifications();
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <section className="notification-center" aria-label="Notifications">
      <details>
        <summary>
          Notifications{" "}
          {unread > 0 && (
            <span className="notification-count">{unread} new</span>
          )}
        </summary>

        <div className="notification-list">
          {notifications.length === 0 ? (
            <p>No notifications yet. Queue updates will appear here.</p>
          ) : (
            notifications.map((item) => (
              <div
                className={`notification-item ${item.read ? "read" : ""}`}
                key={item.id}
              >
                <p>{item.message}</p>
                <small>{item.createdAt}</small>

                {!item.read && (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    aria-label={`Mark notification as read: ${item.message}`}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </details>

      <div className="sr-only" role="status" aria-live="polite">
        {notifications[0]?.message || ""}
      </div>
    </section>
  );
}