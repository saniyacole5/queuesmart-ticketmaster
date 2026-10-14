# Assignment 3: Back-End Development & API Implementation

**QueueSmart TicketManager**

## 1. GitHub repository link (5 points)

https://github.com/saniyacole5/queuesmart-ticketmaster

Backend path: `/backend`; unit tests: `/backend/test`.
Backend code and tests pushed: [verify yes/date].
Final test command/result: [fill].
Coverage command/result and measured scope: [fill final lines/branches/functions; startup file excluded].
Frontend integration validation: [fill actual demo, lint/build results].

## 2. Backend technologies (2 points)

The proposed implementation uses JavaScript on Node.js 24 with Express 5. Node.js aligns with the A1 backend plan and keeps a shared language with the existing React frontend. Express supplies REST routing, JSON parsing, authentication middleware and consistent error handling. Separate authentication, service, queue, wait-time, notification and history modules map to the QueueSmart design. APIs supply data to the A2 React/Vite screens.

For A3, users/sessions/services/queue entries/history/notifications are held in arrays and maps. MySQL is planned in A1 and the stack screenshot, but not implemented here because A3 explicitly defers database persistence. Node's built-in test runner covers core logic and validation, and V8 coverage reports the final measured percentage.

[Update framework/version/testing text if your team's final implementation differs. Add final decisions discussed by the group.]

## 3. Team contributions (3 points)

| Group member name | What is your contribution?                                   | Discussion notes               |
| ----------------- | ------------------------------------------------------------ | ------------------------------ |
| Ayman Almasree    | [Actual completed code, tests, integration; commit/PR links] | [Actual discussions/decisions] |
| Saniya Cole       | [Actual completed code, tests, integration; commit/PR links] | [Actual discussions/decisions] |
| Isabel Buentello  | [Actual completed code, tests, integration; commit/PR links] | [Actual discussions/decisions] |
| Israel Tolentino  | [Actual completed code, tests, integration; commit/PR links] | [Actual discussions/decisions] |

A1 names are prefilled only. Contribution/discussion claims are intentionally blank. Confirm meaningful and comparable work for every member through GitHub authorship, not just this table. One member uploads one final Word/PDF to Canvas. Do not submit code/ZIP to Canvas.
