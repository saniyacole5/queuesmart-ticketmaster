// Member work area - Admin report screen and CSV export.
import { useState } from "react";
import { api } from "../api/client";
import { buildReportCsv } from "../utils/reportCsv";
import "./ReportsPage.css";

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateReport() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      setReport(await api("/admin/reports"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    setError("");
    try {
      const csv = buildReportCsv(report);
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "queuesmart-report.csv";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  return (
    <section className="reports-page">
      <div className="page-header">
        <h1>Reports</h1>
        <div className="actions">
          <button className="button primary" disabled={loading} onClick={generateReport}>
            {loading ? "Generating..." : "Generate report"}
          </button>
          <button className="button secondary" disabled={!report || loading} onClick={downloadReport}>
            Download CSV
          </button>
        </div>
      </div>
      {loading && <p role="status">Loading report data...</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
      {report && (
        <>
          <p>Generated {new Date(report.generatedAt).toLocaleString()}</p>
          <section className="stats" aria-label="Queue usage totals">
            <article>
              <small>SERVED VISITS</small>
              <strong>{report.totals.servedVisits}</strong>
            </article>
            <article>
              <small>CUSTOMERS SERVED</small>
              <strong>{report.totals.distinctCustomersServed}</strong>
            </article>
            <article>
              <small>AVERAGE WAIT</small>
              <strong>{report.totals.averageWaitMinutes === null ? "No served visits" : `${report.totals.averageWaitMinutes} min`}</strong>
            </article>
          </section>
          <section className="panel">
            <h2>Customers</h2>
            {report.customers.length === 0 ? <p>No customers found.</p> : (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Email</th>
                      <th scope="col">Participations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.customers.map(customer => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.participationCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Services and queue activity</h2>
            {report.services.length === 0 ? <p>No services found.</p> : (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Details</th>
                      <th scope="col">Queue</th>
                      <th scope="col">Waiting</th>
                      <th scope="col">Visits</th>
                      <th scope="col">Served visits</th>
                      <th scope="col">Customers served</th>
                      <th scope="col">Average wait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.services.map(service => (
                      <tr key={service.id}>
                        <td>{service.name}</td>
                        <td>{service.description}</td>
                        <td>{service.isOpen ? "Open" : "Closed"}</td>
                        <td>{service.waitingCount}</td>
                        <td>{service.participationCount}</td>
                        <td>{service.servedVisits}</td>
                        <td>{service.distinctCustomersServed}</td>
                        <td>
                          {service.averageWaitMinutes === null
                            ? "No served visits"
                            : `${service.averageWaitMinutes} min`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Participation history</h2>
            {report.participations.length === 0 ? <p>No queue activity found.</p> : (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Service</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Ended</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">Wait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.participations.map(visit => (
                      <tr key={visit.entryId}>
                        <td>{visit.customerName}</td>
                        <td>{visit.serviceName}</td>
                        <td>{new Date(visit.joinedAt).toLocaleString()}</td>
                        <td>
                          {visit.endedAt
                            ? new Date(visit.endedAt).toLocaleString()
                            : "Waiting"}
                        </td>
                        <td>{visit.outcome}</td>
                        <td>{visit.waitMinutes === null ? "" : `${visit.waitMinutes} min`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
