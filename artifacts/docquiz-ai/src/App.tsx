import { type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import QuizPage from '@/pages/quiz';
import AuthPage from '@/pages/auth';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span className="font-mono-ui text-xs uppercase tracking-widest text-muted-foreground">
            Loading session…
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        {/* Authentication Routes */}
        <Route path="/login">
          {() => <AuthPage initialView="login" />}
        </Route>
        <Route path="/register">
          {() => <AuthPage initialView="register" />}
        </Route>
        <Route path="/phone-login">
          {() => <AuthPage initialView="phone-step1" />}
        </Route>
        <Route path="/forgot-password">
          {() => <AuthPage initialView="forgot-password" />}
        </Route>

        {/* Authenticated Application Routes */}
        <Route path="/">
          {() => <ProtectedRoute component={Home} />}
        </Route>
        <Route path="/quiz">
          {() => <ProtectedRoute component={QuizPage} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

