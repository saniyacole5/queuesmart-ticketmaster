import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { services } from "../data/mockData";

export default function JoinQueuePage() {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [joined, setJoined] = useState(false);

  const selectedService = services.find(
    (service) => service.id === Number(selectedServiceId)
  );

  function handleServiceChange(event) {
    setSelectedServiceId(event.target.value);
    setJoined(false); // Reset joined state when changing service
  }

  function handleJoinQueue() {
    if (selectedService) {
      setJoined(true);
    }
  }

  function handleLeaveQueue() {
    setJoined(false);
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
          >
            <option value="">Choose a service</option>
            
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        {selectedService && (
          <div className="service-card">
            <h2>{selectedService.name}</h2>
            <p>{selectedService.description}</p>

            <d1>
              <div>
                <dt>Estimated Wait</dt>
                <dd>{selectedService.estimatedWait} minutes</dd>
              </div>
            </d1>
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