import { useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useQueues } from "../context/QueueContext";
export default function JoinQueuePage() {
  const { services, currentQueue, joinQueue, leaveQueue, loading, error: refreshError } = useQueues();
  const [selectedId, setSelectedId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const service = services.find((s) => s.id === Number(selectedId));
  async function act() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError("");
    setBusy(true);
    try {
      if (currentQueue) await leaveQueue(currentQueue.id);
      else if (service) await joinQueue(service.id);
      else setError("Select a service before joining.");
    } catch (err) {
      setError(err.message);
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Join Queue"
        description="Select an available event and join its ticket queue."
      />
      {loading && <p role="status">Loading queue information…</p>}
      {refreshError && <p role="alert" className="field-error">{refreshError}</p>}
      {!loading && !refreshError && services.length === 0 && <p>No services available.</p>}
      {busy && <p role="status">Updating your queue…</p>}
      <section className="panel" aria-busy={busy}>
        <label htmlFor="service">Service</label>
        <select
          id="service"
          value={selectedId}
          disabled={!!currentQueue || busy || loading}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Choose a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.isOpen}>
              {s.name}
              {s.isOpen ? "" : " (Closed)"}
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {currentQueue ? (
          <div className="service-card">
            <h2>{currentQueue.serviceName}</h2>
            <p>
              Position #{currentQueue.position} · {currentQueue.estimatedWait}{" "}
              minutes · {currentQueue.status}
            </p>
            <button className="danger" disabled={busy || loading} onClick={act}>
              Leave Queue
            </button>
          </div>
        ) : (
          service && (
            <div className="service-card">
              <h2>{service.name}</h2>
              <p>{service.description}</p>
              <p>
                Estimated wait for a new arrival: {service.estimatedWait}{" "}
                minutes
              </p>
              <button
                className="primary"
                disabled={busy || loading || !service.isOpen}
                onClick={act}
              >
                Join Queue
              </button>
            </div>
          )
        )}
      </section>
    </>
  );
}
