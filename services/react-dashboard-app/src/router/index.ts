import { createRouter, createRoute, createRootRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/components/LoginPage";
import { Dashboard } from "@/pages/Dashboard";
import { Securities } from "@/pages/Securities";
import { SecurityDetail } from "@/pages/SecurityDetail";
import { Portfolios } from "@/pages/Portfolios";
import { PortfolioDetail } from "@/pages/PortfolioDetail";
import { Holdings } from "@/pages/Holdings";
import { EditorPage } from "@/pages/Editor";

const rootRoute = createRootRoute({ component: AppLayout });

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Dashboard });
const securitiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/securities", component: Securities });
const securityDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/securities/$id", component: SecurityDetail });
const portfoliosRoute = createRoute({ getParentRoute: () => rootRoute, path: "/portfolios", component: Portfolios });
const portfolioDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: "/portfolios/$id", component: PortfolioDetail });
const holdingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/holdings", component: Holdings });
const editorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/editor", component: EditorPage });

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  securitiesRoute,
  securityDetailRoute,
  portfoliosRoute,
  portfolioDetailRoute,
  holdingsRoute,
  editorRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
