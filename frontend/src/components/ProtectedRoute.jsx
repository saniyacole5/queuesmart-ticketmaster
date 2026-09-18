import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ account, allowedRole }) {
  const location = useLocation();

  if (!account) {
    const loginRoute = allowedRole === "admin" ? "/admin/login" : "/login";
    return <Navigate to={loginRoute} replace state={{ from: location.pathname }} />;
  }

  if (account.role !== allowedRole) {
    const homeRoute = account.role === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={homeRoute} replace />;
  }

  return <Outlet />;
}
