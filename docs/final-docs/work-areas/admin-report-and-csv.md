# Admin report screen and CSV export

Give administrators a screen to generate and download a queue report.

## Implementation

- Add **Reports** to the existing admin navigation and protected admin routes.
- Display customer participation history, service and queue activity, and usage statistics from the reporting API.
- Add a CSV download that includes the report details and statistics from the same API response. Handle loading, empty results, and request errors.

Start with `frontend/src/App.jsx`, `frontend/src/components/AppShell.jsx`, and `frontend/src/api/client.js`.

## Completion checks

- [ ] An administrator can open Reports and generate a report from MySQL data.
- [ ] The CSV opens in a spreadsheet and shows the same records and totals as the screen.
- [ ] A customer account cannot open the admin report screen.

Agree on the response fields with the member working on the reporting API. Share one actual CSV generated using demo data for the submission.
