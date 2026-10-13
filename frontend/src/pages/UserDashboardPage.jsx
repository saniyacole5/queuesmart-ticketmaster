import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";

export default function UserDashboardPage() {
  const { notifications } = useNotifications();
  const { currentQueue: active, services } = useQueues();
  const currentQueue = active || {
    position: "-",
    serviceName: "No active queue",
    estimatedWait: 0,
    status: "Not Queued",
  };

  return (
    <>
      <PageHeader
        title="User Dashboard"
        description="View your current queue, available services, and recent notifications."
        action={
          <Link className="button primary" to="/join">
            Join a Queue
          </Link>
        }
      />

      <section className="stats">
        <article>
          <small>CURRENT POSITION</small>
          <strong>#{currentQueue.position}</strong>
          <span>{currentQueue.serviceName}</span>
        </article>

        <article>
          <small>ESTIMATED WAIT</small>
          <strong>{currentQueue.estimatedWait} min</strong>
          <span>Current estimated wait time</span>
        </article>

        <article>
          <small>QUEUE STATUS</small>
          <StatusBadge>{currentQueue.status}</StatusBadge>
          <span>Your current queue status</span>
        </article>
      </section>

      <div className="grid-two align-start">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Current Queue</h2>
              <p>Your active ticket queue.</p>
            </div>

            <Link className="button secondary small" to="/status">
              View Status
            </Link>
          </div>

          <div className="list-row">
            <div>
              <strong>{currentQueue.serviceName}</strong>
              <p>
                Position #{currentQueue.position} · Approximately{" "}
                {currentQueue.estimatedWait} minutes
              </p>
            </div>

            <StatusBadge>{currentQueue.status}</StatusBadge>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Notifications</h2>
              <p>Recent queue updates.</p>
            </div>
          </div>

          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div className="notice" key={notification.id}>
                <span>●</span>
                <div>
                  <p>{notification.message}</p>
                  <small>{notification.createdAt}</small>
                </div>
              </div>
            ))
          ) : (
            <p>No new notifications.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Available Services</h2>
            <p>Queues currently available to join.</p>
          </div>

          <Link className="button secondary small" to="/join">
            View All
          </Link>
        </div>

        {services.map((service) => (
          <div className="list-row" key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <p>{service.description}</p>
            </div>

            <span className="badge open">{service.estimatedWait} min wait</span>
          </div>
        ))}
      </section>
    </>
  );
}
