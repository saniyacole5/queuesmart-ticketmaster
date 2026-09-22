import ScreenTemplate from "../components/ScreenTemplate";
import { useNotifications } from "../context/NotificationContext";

export default function UserDashboardPage() {
  const { notifications } = useNotifications();

  return (
    <>
      <ScreenTemplate
        title="User Dashboard"
        description="The user's overview after signing in."
        requirements={[
          "Show current queue status",
          "Show active services",
          "Show a notifications summary",
        ]}
      />

      <section className="panel">
        <h2>Recent notifications</h2>

        {notifications.length ? (
          notifications.slice(0, 3).map((item) => (
            <p key={item.id}>
              {item.message} <small>{item.time}</small>
            </p>
          ))
        ) : (
          <p>No updates yet. Join a queue to see notifications here.</p>
        )}
      </section>
    </>
  );
}