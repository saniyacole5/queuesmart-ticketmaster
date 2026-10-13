import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
export default function QueueStatusPage() {
  const { currentQueue: queue } = useQueues();
  return (
    <>
      <PageHeader
        title="Queue Status"
        description="Status refreshes from the backend every three seconds."
      />
      <section className="status-card">
        {queue ? (
          <>
            <p className="eyebrow">{queue.serviceName}</p>
            <h2>Your Position</h2>
            <strong className="position">#{queue.position}</strong>
            <p>
              Estimated Wait Time:{" "}
              <strong>{queue.estimatedWait} minutes</strong>
            </p>
            <StatusBadge>{queue.status}</StatusBadge>
            <p>There are {queue.position - 1} customers ahead of you.</p>
          </>
        ) : (
          <p>You are not currently waiting. Visit Join Queue or History.</p>
        )}
      </section>
    </>
  );
}
