import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { currentQueue } from "../data/mockData";

export default function QueueStatusPage() {
  return (
    <>
      <PageHeader
        title="Queue Status"
        description="Track your current position and estimated wait time."
        />

        <section className="status-card">
          <p className="eyebrow">{currentQueue.serviceName}</p>
          
          <h2>Your Position</h2>
          
          <strong className="position">
            #{currentQueue.position}
          </strong>

          <p>
            Estimated Wait Time:{" "}
            <strong>{currentQueue.estimatedWait} minutes</strong>
          </p>

          <StatusBadge>{currentQueue.status}</StatusBadge>
          
          <div className="progress">
            <span></span>
          </div>

          <div className="step-row">
            <span>Joined</span>
            <span>Waiting</span>
            <span>Almost Ready</span>
            <span>Served</span>
          </div>

          <p>
            There are {currentQueue.position - 1} customers ahead of you.
          </p>

          <button className="danger" type="button">
            Leave Queue
          </button>
        </section>
    </>
  );
}
