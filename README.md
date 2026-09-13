# QueueSmart TicketManager - JavaScript

QueueSmart is a React front-end prototype for managing service queues. Assignment 2 is front-end only, so mock data and simulated actions are allowed. The backend folder is reserved for future Node.js work.

## Technology

- React with JavaScript
- Vite development/build tool
- React Router for page navigation
- ESLint for code checks
- CSS for styling

## Requirements

Install Git, Node.js, and a code editor such as VS Code. Confirm Node and npm are available:

```bash
node --version
npm --version
```

## Set up the project

```bash
git clone https://github.com/saniyacole5/queuesmart-ticketmaster.git
cd queuesmart-ticketmaster/frontend
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Useful commands

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm install`     | Install packages from `package.json` |
| `npm run dev`     | Start the local development server   |
| `npm run lint`    | Check the code with ESLint           |
| `npm run build`   | Create and verify a production build |
| `npm run preview` | Preview the production build locally |

## Project structure

```text
queuesmart-ticketmaster/
├── backend/                  Future Node.js backend
└── frontend/
    ├── public/               Static files
    ├── src/
    │   ├── components/       Reusable interface components
    │   ├── data/             Temporary mock data
    │   ├── pages/            One file per required screen
    │   ├── App.jsx           Application routes
    │   ├── App.css           Shared application styles
    │   └── main.jsx          React entry point
    ├── package.json
    └── vite.config.js
```

## Required screens and routes

| Screen             | Route             | Page file                   |
| ------------------ | ----------------- | --------------------------- |
| Login              | `/login`          | `LoginPage.jsx`             |
| Registration       | `/register`       | `RegisterPage.jsx`          |
| User dashboard     | `/dashboard`      | `UserDashboardPage.jsx`     |
| Join queue         | `/join`           | `JoinQueuePage.jsx`         |
| Queue status       | `/status`         | `QueueStatusPage.jsx`       |
| History            | `/history`        | `HistoryPage.jsx`           |
| Admin dashboard    | `/admin`          | `AdminDashboardPage.jsx`    |
| Service management | `/admin/services` | `ServiceManagementPage.jsx` |
| Queue management   | `/admin/queue`    | `QueueManagementPage.jsx`   |

The login page is implemented as a reference. The remaining pages intentionally contain TODO templates.

## How to implement another screen

1. Create a branch from the latest `main`.
2. Open the matching file in `frontend/src/pages`.
3. Identify the screen data and place it in component state or `src/data/mockData.js`.
4. Build the JSX structure.
5. Add client-side validation where the screen has a form.
6. Put screen-specific styles in a CSS file beside the page.
7. Test the screen in the browser.
8. Run `npm run lint` and `npm run build`.
9. Commit and push only related work.

## Team Git workflow

```bash
git switch main
git pull origin main
git switch -c feature/name-of-screen
```

After making and testing changes:

```bash
git status
git add frontend/src/pages/YourPage.jsx
git commit -m "Implement the name-of-screen screen"
git push -u origin feature/name-of-screen
```

Open a pull request on GitHub. Each member should use their own branch and GitHub account because assignment contributions are evaluated through commit history.

Do not commit `node_modules`, `dist`, passwords, API keys, or `.env` files.
