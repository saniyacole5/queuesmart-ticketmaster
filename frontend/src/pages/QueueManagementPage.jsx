import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";

export default function QueueManagementPage() {
  const {
    services,
    entriesForService,
    serveNext,
    removeEntry,
    moveEntry,
    setPriority,
  } = useQueues();
  const { notify } = useNotifications();

  const [selectedId, setSelectedId] = useState(services[0]?.id ?? "");
  const [error, setError] = useState("");

  const selectedService = services.find(
    (service) => service.id === Number(selectedId),
  );
  const entries = selectedService ? entriesForService(selectedService.id) : [];

  function handleSelect(event) {
    const { value } = event.target;

    setSelectedId(value);
    setError(value ? "" : "Select a service to manage its queue.");
  }

  async function handleServeNext() {
    if (!selectedService) {
      setError("Select a service to manage its queue.");
      return;
    }

    let served;
    try {
      served = await serveNext(selectedService.id);
    } catch (error) {
      setError(error.message);
      return;
    }

    notify(
      served
        ? `${served.name} was served in ${selectedService.name}.`
        : `${selectedService.name} has nobody waiting.`,
      served ? "success" : "info",
    );
  }

  async function handleRemove(entry) {
    try {
      await removeEntry(entry.id);
    } catch (error) {
      setError(error.message);
      return;
    }
    notify(`${entry.name} was removed from the queue.`, "info");
  }

  async function handleMove(entry, direction) {
    try {
      await moveEntry(entry.id, direction);
    } catch (error) {
      setError(error.message);
      return;
    }
    notify(
      `${entry.name} moved ${direction} in ${selectedService.name}.`,
      "info",
    );
  }

  return (
    <>
      <PageHeader
        title="Queue Management"
        description="Select a service, reorder or remove users, and serve the next person."
        action={
          <button
            type="button"
            className="button primary"
            onClick={handleServeNext}
            disabled={
              !selectedService ||
              !selectedService.isOpen ||
              entries.length === 0
            }
          >
            Serve next user
          </button>
        }
      />

      <section className="panel form-panel">
        <label htmlFor="queue-service">
          Service
          <select
            id="queue-service"
            value={selectedId}
            required
            onChange={handleSelect}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "queue-service-error" : undefined}
          >
            <option value="">Select a service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p id="queue-service-error" className="field-error">
            {error}
          </p>
        )}
      </section>

      {selectedService && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{selectedService.name}</h2>
              <p>
                {entries.length} waiting · {selectedService.estimatedWait} min
                expected wait
              </p>
            </div>

            <StatusBadge>
              {selectedService.isOpen ? "Open" : "Closed"}
            </StatusBadge>
          </div>

          {!selectedService.isOpen && (
            <p className="empty">
              This queue is closed. Reopen it from the Admin Dashboard to serve
              users.
            </p>
          )}

          {entries.length === 0 ? (
            <p className="empty">Nobody is waiting in this queue.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Name</th>
                    <th>Joined</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="queue-position">#{index + 1}</td>
                      <td>{entry.name}</td>
                      <td>{new Date(entry.joinedAt).toLocaleTimeString()}</td>
                      <td>
                        <select
                          aria-label={`Priority for ${entry.name}`}
                          value={entry.priority}
                          onChange={async (e) => {
                            try {
                              await setPriority(entry.id, e.target.value);
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          <option value="standard">Standard</option>
                          <option value="priority">Priority</option>
                        </select>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleMove(entry, "up")}
                            disabled={
                              index === 0 ||
                              entries[index - 1]?.priority !== entry.priority
                            }
                            aria-label={`Move ${entry.name} up`}
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleMove(entry, "down")}
                            disabled={
                              index === entries.length - 1 ||
                              entries[index + 1]?.priority !== entry.priority
                            }
                            aria-label={`Move ${entry.name} down`}
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            className="button small danger"
                            onClick={() => handleRemove(entry)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
