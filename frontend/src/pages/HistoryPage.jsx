import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useQueues } from "../context/QueueContext";

export default function HistoryPage() {
  const { history, loading, error } = useQueues();

  return (
    <>
      <PageHeader
        title="Queue History"
        description="Review your queue participation and outcomes."
      />

      <section className="panel">
        {loading && (
          <p role="status">Loading your queue history...</p>
        )}

        {error && (
          <p role="alert" className="field-error">
            {error}
            {history.length > 0 &&
              " Showing your last loaded history."}
          </p>
        )}

        {history.length > 0 ? (
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
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {new Date(
                        record.joinedAt,
                      ).toLocaleString()}
                    </td>

                    <td>{record.serviceName}</td>

                    <td>
                      <StatusBadge>
                        {record.outcome}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !loading &&
          !error && <p>No queue history yet.</p>
        )}
      </section>
    </>
  );
}
