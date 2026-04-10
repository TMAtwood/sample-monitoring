import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, TrendingUp, Briefcase, PieChart, Code2, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/securities", icon: TrendingUp, label: "Securities" },
  { to: "/portfolios", icon: Briefcase, label: "Portfolios" },
  { to: "/holdings", icon: PieChart, label: "Holdings" },
  { to: "/editor", icon: Code2, label: "Editor" },
] as const;

export function Sidebar() {
  const { logout } = useAuth();
  const router = useRouterState();
  const currentPath = router.location.pathname;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground min-h-screen">
      <div className="p-4 border-b border-white/10">
        <img src="/geode-logo-white.png" alt="Geode Capital" className="h-10" />
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent border-l-3 border-geode-green"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-sidebar-foreground/60 mb-2">Thomas Atwood</div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-white transition-colors">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
