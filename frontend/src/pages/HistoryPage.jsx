import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";
export default function HistoryPage() {
  const { history } = useQueues();
  return (
    <>
      <PageHeader
        title="Queue History"
        description="Your queue participation, returned by the backend."
      />
      <section className="panel">
        {history.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Joined</th>
                  <th>Service</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.date).toLocaleString()}</td>
                    <td>{h.serviceName}</td>
                    <td>
                      <StatusBadge>{h.outcome}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No queue history yet.</p>
        )}
      </section>
    </>
  );
}
