import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { queueHistory } from "../data/mockData";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="Queue History"
        description="View queues the user previously joined."
      />

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Outcome</th>
              </tr>
            </thead>
            
            <tbody>
              {queueHistory.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>{entry.serviceName}</td>
                  <td>
                    <StatusBadge>{entry.outcome}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
