import { useState } from "react";
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

export default function App() {
  const [account, setAccount] = useState(() => {
    const savedAccount = sessionStorage.getItem("queuesmart-account");

    try {
      return savedAccount ? JSON.parse(savedAccount) : null;
    } catch {
      sessionStorage.removeItem("queuesmart-account");
      return null;
    }
  });

  function handleLogin(nextAccount) {
    const sessionAccount = {
      id: nextAccount.id,
      name: nextAccount.name,
      email: nextAccount.email,
      role: nextAccount.role,
    };

    sessionStorage.setItem("queuesmart-account", JSON.stringify(sessionAccount));
    setAccount(sessionAccount);
  }

  function handleLogout() {
    sessionStorage.removeItem("queuesmart-account");
    setAccount(null);
  }

  return (
    <NotificationProvider>
      <QueueProvider>
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
              element={
                <AppShell account={account} onLogout={handleLogout} />
              }
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
              element={
                <AppShell account={account} onLogout={handleLogout} />
              }
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
