import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { services } from "../data/mockData";
import { useNotifications } from "../context/NotificationContext";

export default function JoinQueuePage() {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useNotifications();

  const selectedService = services.find(
    (service) => service.id === Number(selectedServiceId)
  );

  function handleServiceChange(event) {
    setSelectedServiceId(event.target.value);
    setJoined(false);
    setError("");
  }

  function handleJoinQueue() {
    if (selectedService) {
      setJoined(true);
      notify(
        `You joined ${selectedService.name}. Estimated wait: ${selectedService.estimatedWait} minutes.`,
        "success"
      );
    } else {
      setError("Select a service before joining a queue.");
    }
  }

  function handleLeaveQueue() {
    setJoined(false);
    notify(`You left ${selectedService.name}.`, "info");
  }

  return (
    <>
      <PageHeader
        title="Join Queue"
        description="Select an available event and join its ticket queue."
      />

      <section className="panel">
        <label className="compact-label" htmlFor="service">
          Select a service
          <select
            id="service"
            value={selectedServiceId}
            onChange={handleServiceChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "service-error" : undefined}
          >
            <option value="">Choose a service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="field-error" id="service-error">
            {error}
          </p>
        )}

        {selectedService && (
          <div className="service-card">
            <h2>{selectedService.name}</h2>
            <p>{selectedService.description}</p>

            <dl>
              <div>
                <dt>Estimated Wait</dt>
                <dd>{selectedService.estimatedWait} minutes</dd>
              </div>
            </dl>

            {!joined ? (
              <button
                className="primary"
                type="button"
                onClick={handleJoinQueue}
              >
                Join Queue
              </button>
            ) : (
              <>
                <p className="success-message">
                  You have joined the queue for {selectedService.name}.
                </p>

                <button
                  className="danger"
                  type="button"
                  onClick={handleLeaveQueue}
                >
                  Leave Queue
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}