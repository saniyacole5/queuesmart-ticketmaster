import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";

export default function AdminDashboardPage() {
  const { services, queueLength, toggleQueueOpen } = useQueues();
  const { notify } = useNotifications();

  const totalWaiting = services.reduce(
    (total, service) => total + queueLength(service.id),
    0
  );
  const openCount = services.filter((service) => service.isOpen).length;

  async function handleToggle(service) {
    try { await toggleQueueOpen(service.id); }
    catch (error) { notify(error.message, 'error'); return; }
    notify(
      `${service.name} was ${service.isOpen ? "closed" : "opened"}.`,
      service.isOpen ? "info" : "success"
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
          <p className="empty">No services have been created yet.</p>
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
                  onClick={() => handleToggle(service)}
                >
                  {service.isOpen ? "Close queue" : "Open queue"}
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
