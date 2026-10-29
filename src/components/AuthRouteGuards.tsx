import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "../stores/authStore";

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireGuest() {
  const user = useAuthStore((state) => state.user);

  return user ? <Navigate to="/projects" replace /> : <Outlet />;
}
