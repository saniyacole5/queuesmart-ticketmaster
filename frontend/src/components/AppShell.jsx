import { NavLink, Outlet } from "react-router-dom";
import NotificationCenter from "./NotificationCenter";

const userLinks = [
  ["/dashboard", "Dashboard"],
  ["/join", "Join queue"],
  ["/status", "Queue status"],
  ["/history", "History"],
];

const adminLinks = [
  ["/admin", "Admin dashboard"],
  ["/admin/services", "Services"],
  ["/admin/queue", "Manage queue"],
];

function RoleNavigation({ links }) {
  return (
    <nav>
      {links.map(([to, label]) => (
        <NavLink key={to} to={to}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell({ account, onLogout }) {
  const sectionLabel =
    account.role === "admin" ? "ADMINISTRATOR" : "USER";

  const loginRoute =
    account.role === "admin" ? "/admin/login" : "/login";

  const initials = account.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>Q</span> QueueSmart
        </div>

        <p className="nav-label">{sectionLabel}</p>

        {account.role === "admin" ? (
          <RoleNavigation links={adminLinks} />
        ) : (
          <RoleNavigation links={userLinks} />
        )}

        <NavLink
          className="sign-out"
          to={loginRoute}
          onClick={onLogout}
        >
          Sign out
        </NavLink>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <strong>QueueSmart TicketManager</strong>

          <NotificationCenter />

          <span className="avatar" title={account.name}>
            {initials}
          </span>
        </header>

        <main>
          <div className="mobile-notifications">
            <NotificationCenter />
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}