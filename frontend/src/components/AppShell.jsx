import { NavLink, Outlet } from "react-router-dom";
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
export default function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>Q</span> QueueSmart
        </div>
        <p className="nav-label">USER</p>
        <nav>
          {userLinks.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="nav-label">ADMINISTRATOR</p>
        <nav>
          {adminLinks.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink className="sign-out" to="/login">
          Sign out
        </NavLink>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <strong>QueueSmart TicketManager</strong>
          <span className="avatar">SC</span>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
