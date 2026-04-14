import { HeadContent, Scripts, createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { api } from "@/lib/api";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 text-gray-900">404</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-2">Page Not Found</p>
        <p className="text-gray-600 mb-8">The page you are looking for does not exist.</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  // const displayBalance = typeof user?.balance === 'number'
  //     ? user.balance : parseFloat(user?.balance || "0");

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.request("/api/auth/me"),
    enabled: isAuthenticated,
    refetchInterval: 5000
  });

  const userBalance = profile?.balance ?? user?.balance ?? 0;
  const displayBalance = typeof userBalance === 'number' ? userBalance : parseFloat(userBalance || "0");

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-blue-600 tracking-tighter">
            BET-MARKET
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link to="/" className="[&.active]:text-blue-600 hover:text-blue-500">Dashboard</Link>
            <Link to="/leaderboard" className="[&.active]:text-blue-600 hover:text-blue-500">Leaderboard</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Task 8: Displaying the User Balance */}
              <div className="text-right mr-2 hidden sm:block">
                <p className="text-[10px] uppercase text-slate-400 font-bold leading-none">Balance</p>
                <p className="text-sm font-mono font-bold text-green-600">
                  ${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <Link to="/profile">
                <Button variant="ghost">Profile</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
            </>
          ) : (
            <Link to="/auth/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div className="flex flex-col min-h-screen bg-slate-50">  
              <Navbar />

              <main className="flex-1">
                {children}
              </main>

              <TanStackDevtools
                config={{
                  position: "bottom-right",
                }}
                plugins={[
                  {
                    name: "Tanstack Router",
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
            </div>
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
