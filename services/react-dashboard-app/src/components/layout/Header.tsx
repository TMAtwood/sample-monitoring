import { useRouterState } from "@tanstack/react-router";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/securities": "Securities",
  "/portfolios": "Portfolios",
  "/holdings": "Holdings",
  "/editor": "Config Editor",
};

export function Header() {
  const router = useRouterState();
  const path = router.location.pathname;
  const title = pageTitles[path] ?? (path.startsWith("/securities/") ? "Security Detail" : path.startsWith("/portfolios/") ? "Portfolio Detail" : "");

  return (
    <header className="h-16 border-b bg-white flex items-center px-6">
      <h1 className="text-lg font-semibold text-geode-green-dark">{title}</h1>
    </header>
  );
}
