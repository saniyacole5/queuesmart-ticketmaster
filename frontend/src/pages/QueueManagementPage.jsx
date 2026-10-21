import { useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
import { useNotifications } from "../context/NotificationContext";

export default function QueueManagementPage() {
  const {
    services,
    loading,
    error: refreshError,
    entriesForService,
    serveNext,
    removeEntry,
    moveEntry,
    setPriority,
  } = useQueues();
  const { notify } = useNotifications();

  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const pendingRef = useRef(false);
  const [pending, setPending] = useState("");
  // Derive a fallback after asynchronous loading; retain a valid user selection.
  const selectedService = services.find(
    (service) => service.id === Number(selectedId),
  ) ?? services[0];
  const entries = selectedService ? entriesForService(selectedService.id) : [];

  function handleSelect(event) {
    setSelectedId(event.target.value);
    setError("");
  }

  async function runAction(label, action, message) {
    // A ref also guards clicks arriving before React renders disabled controls.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(label);
    setError("");
    try {
      const result = await action();
      notify(message(result), "success");
    } catch (requestError) {
      setError(requestError.message || "Queue update failed. Please try again.");
    } finally {
      pendingRef.current = false;
      setPending("");
    }
  }

  function handleServeNext() {
    if (!selectedService) return;
    return runAction("Serving next user", () => serveNext(selectedService.id),
      (served) => `${served.name} was served in ${selectedService.name}.`);
  }

  function handleRemove(entry) {
    return runAction("Removing user", () => removeEntry(entry.id),
      () => `${entry.name} was removed from the queue.`);
  }

  function handleMove(entry, direction) {
    return runAction("Moving user", () => moveEntry(entry.id, direction),
      () => `${entry.name} moved ${direction} in ${selectedService.name}.`);
  }

  function handlePriority(entry, priority) {
    return runAction("Updating priority", () => setPriority(entry.id, priority),
      () => `Priority updated for ${entry.name}.`);
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
              Boolean(pending) || loading ||
              !selectedService ||
              !selectedService.isOpen ||
              entries.length === 0
            }
          >
            Serve next user
          </button>
        }
      />

      {loading && <p role="status">Loading queues…</p>}
      {refreshError && <p role="alert" className="field-error">{refreshError}</p>}
      {!loading && !refreshError && services.length === 0 && <p>No services available.</p>}
      {pending && <p role="status">{pending}…</p>}
      <section className="panel form-panel" aria-busy={Boolean(pending)}>
        <label htmlFor="queue-service">
          Service
          <select
            id="queue-service"
            value={selectedService?.id ?? ""}
            disabled={Boolean(pending) || loading || services.length === 0}
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
          <p role="alert" id="queue-service-error" className="field-error">
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

          <p>Priority entries come first, then arrival order. Manual moves are
            allowed only within the same priority tier. Service priority does not change this order.</p>
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
                      <td className="queue-position">#{entry.position}</td>
                      <td>{entry.name}</td>
                      <td>{new Date(entry.joinedAt).toLocaleTimeString()}</td>
                      <td>
                        <select
                          aria-label={`Priority for ${entry.name}`}
                          value={entry.priority}
                          disabled={Boolean(pending)}
                          onChange={(event) => handlePriority(entry, event.target.value)}
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
                              Boolean(pending) ||
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
                              Boolean(pending) ||
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
                            disabled={Boolean(pending)}
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
