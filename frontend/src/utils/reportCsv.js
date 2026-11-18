// Member work area - Admin report screen and CSV export.
export function escapeCsvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  // Spreadsheet applications may evaluate user-supplied text as a formula.
  if (typeof value === "string" && /^[=+\-@\t\r\n]/.test(text)) {
    text = "'" + text;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildReportCsv(report) {
  if (!report) throw new Error("Generate a report before downloading CSV.");

  // TODO(CSV-1) Build labelled sections for report.generatedAt, totals,
  // customers, services, and participations. Match the fields displayed on
  // ReportsPage. Map every cell through escapeCsvCell and join rows with CRLF.
  // Keep 0 as 0 and null averages blank. Export this exact report snapshot.
  throw new Error("CSV export is awaiting implementation.");
}
