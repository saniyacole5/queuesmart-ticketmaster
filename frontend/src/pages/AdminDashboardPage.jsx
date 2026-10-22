import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";
import { useState } from "react";
export default function AdminDashboardPage() {
  const { services, queueLength, toggleQueueOpen, loading, error: loadError,} = useQueues();
  const [pendingId, setPendingId] = useState(null);
  const { notify } = useNotifications();

  const totalWaiting = services.reduce(
    (total, service) => total + queueLength(service.id),
    0
  );
  const openCount = services.filter((service) => service.isOpen).length;

  async function handleToggle(service) {
    if (pendingId !== null || loading) return;
    setPendingId(service.id);

    try {
    await toggleQueueOpen(service.id);

    notify(
      `${service.name} was ${service.isOpen ? "closed" : "opened"}.`,
      service.isOpen ? "info" : "success",
    );
  } catch (error) {
    notify(error.message, "error");
  } finally {
    setPendingId(null);
  }
}

if (loading) {
  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Monitor every service queue and open or close them as needed."
      />
      <p role="status">Loading service queues...</p>
    </>
  );
}

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Monitor every service queue and open or close them as needed."
        action={
          <Link className="button primary" to="/admin/services">
            Manage Services
          </Link>
        }
      />
{loadError && (
  <p role="alert" className="field-error">
    {loadError}
  </p>
)}
      <section className="stats">
        <article>
          <small>TOTAL SERVICES</small>
          <strong>{services.length}</strong>
          <span>Services configured in the system</span>
        </article>

        <article>
          <small>PEOPLE WAITING</small>
          <strong>{totalWaiting}</strong>
          <span>Across every active queue</span>
        </article>

        <article>
          <small>OPEN QUEUES</small>
          <strong>
            {openCount} / {services.length}
          </strong>
          <span>Queues currently accepting users</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Service Queues</h2>
            <p>Current queue length and status for each service.</p>
          </div>

          <Link className="button secondary small" to="/admin/queue">
            Manage Queues
          </Link>
        </div>

        {services.length === 0 ? (
          <p className="empty">{loadError ? "Service information is currently unavailable."
            : "No services have been created yet."}
          </p>
        ) : (
          services.map((service) => (
            <div className="list-row" key={service.id}>
              <div>
                <strong>{service.name}</strong>
                <p>{service.description}</p>
                <p>
                  {queueLength(service.id)} waiting ·{" "}
                  {service.expectedDuration} min per user ·{" "}
                  {service.priority} priority
                </p>
              </div>

              <div className="actions">
                <StatusBadge>
                  {service.isOpen ? "Open" : "Closed"}
                </StatusBadge>

                <button
                  type="button"
                  className={`button small ${
                    service.isOpen ? "danger" : "primary"
                  }`}
                  disabled={pendingId !== null || loading}
                  onClick={() => handleToggle(service)}
                >
                  {pendingId === service.id
                    ? "Updating..."
                    : service.isOpen
                      ? "Close queue"
                      : "Open queue"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
