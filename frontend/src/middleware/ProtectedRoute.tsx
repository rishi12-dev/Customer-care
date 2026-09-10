import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

export function ProtectedRoute({ adminOnly = false, allowedRoles }: { adminOnly?: boolean; allowedRoles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading secure workspace...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/search" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/search" replace />;
  return <Outlet />;
}
