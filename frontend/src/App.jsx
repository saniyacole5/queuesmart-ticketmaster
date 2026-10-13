import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import RegisterPage from "./pages/RegisterPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import JoinQueuePage from "./pages/JoinQueuePage";
import QueueStatusPage from "./pages/QueueStatusPage";
import HistoryPage from "./pages/HistoryPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ServiceManagementPage from "./pages/ServiceManagementPage";
import QueueManagementPage from "./pages/QueueManagementPage";
import { NotificationProvider } from "./context/NotificationContext";
import { QueueProvider } from "./context/QueueContext";
import "./App.css";
import { api, session } from "./api/client";

export default function App() {
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(session.get()));
  useEffect(() => {
    let active = true;
    if (session.get()) {
      api("/auth/me")
        .then((user) => {
          if (active) setAccount(user);
        })
        .catch(() => {
          session.clear();
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }
    const expire = () => {
      session.clear();
      setAccount(null);
    };
    window.addEventListener("queuesmart-session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("queuesmart-session-expired", expire);
    };
  }, []);
  function handleLogin(user) {
    setAccount(user);
  }
  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch {
      /* Local sign-out still succeeds if the backend is unavailable. */
    }
    session.clear();
    sessionStorage.removeItem("queuesmart-account");
    setAccount(null);
  }
  if (checking) return <p role="status">Checking your session...</p>;
  return (
    <NotificationProvider key={account?.id ?? "guest"} account={account}>
      <QueueProvider account={account}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

          <Route
            path="/admin/login"
            element={<AdminLoginPage onLogin={handleLogin} />}
          />

          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={<ProtectedRoute account={account} allowedRole="user" />}
          >
            <Route
              element={<AppShell account={account} onLogout={handleLogout} />}
            >
              <Route path="/dashboard" element={<UserDashboardPage />} />
              <Route path="/join" element={<JoinQueuePage />} />
              <Route path="/status" element={<QueueStatusPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>
          </Route>

          <Route
            element={<ProtectedRoute account={account} allowedRole="admin" />}
          >
            <Route
              element={<AppShell account={account} onLogout={handleLogout} />}
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route
                path="/admin/services"
                element={<ServiceManagementPage />}
              />
              <Route path="/admin/queue" element={<QueueManagementPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </QueueProvider>
    </NotificationProvider>
  );
}
