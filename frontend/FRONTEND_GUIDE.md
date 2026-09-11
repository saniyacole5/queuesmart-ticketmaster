# QueueSmart Frontend Guide

This starter is intentionally incomplete. It provides routing, folders, one component file per required screen, and TODO checklists. Your team supplies each screen's JSX, state, validation, and mock data.

## Run the project

```bash
npm install
npm run dev
```

Run `npm run lint` and `npm run build` before committing.

## Where to work

- `src/pages/`: one file for each required screen
- `src/components/`: shared layout and display components
- `src/data/mockData.js`: empty placeholder arrays for your team's mock data
- `src/App.jsx`: route-to-screen mapping
- `src/App.css`: shared visual system and responsive layout

## Assignment screen routes

| Required screen    | Route             | File                              |
| ------------------ | ----------------- | --------------------------------- |
| Login              | `/login`          | `pages/LoginPage.jsx`             |
| Registration       | `/register`       | `pages/RegisterPage.jsx`          |
| User dashboard     | `/dashboard`      | `pages/UserDashboardPage.jsx`     |
| Join queue         | `/join`           | `pages/JoinQueuePage.jsx`         |
| Queue status       | `/status`         | `pages/QueueStatusPage.jsx`       |
| History            | `/history`        | `pages/HistoryPage.jsx`           |
| Admin dashboard    | `/admin`          | `pages/AdminDashboardPage.jsx`    |
| Service management | `/admin/services` | `pages/ServiceManagementPage.jsx` |
| Queue management   | `/admin/queue`    | `pages/QueueManagementPage.jsx`   |

## Team workflow

Give each teammate one or more page files. Create a separate branch for each feature, keep commits focused, and merge through pull requests so the contribution history is clear.

Each page currently renders only its assignment checklist. Replace the `ScreenTemplate` in that page with your implementation. Keep the requirements visible in comments while developing so rubric items are not missed.
