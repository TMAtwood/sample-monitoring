import { Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/auth/AuthContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const router = useRouterState();

  if (router.location.pathname === "/login") {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
