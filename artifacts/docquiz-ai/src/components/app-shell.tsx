import type { ReactNode } from 'react';
import { BookOpen, FileText, LayoutDashboard, LogIn, LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function Mark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]" aria-hidden="true">
      <BookOpen size={18} strokeWidth={2.2} />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
    </span>
  );
}

function getInitials(name?: string): string {
  if (!name) return 'DQ';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const serverReady = health.isSuccess && health.data?.status === 'ok';

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="hidden min-h-[100dvh] w-[246px] shrink-0 flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] md:flex">
        <Link href="/" className="mb-10 flex items-center gap-3" data-testid="link-brand-home">
          <Mark />
          <span>
            <span className="block text-[15px] font-bold tracking-[-0.02em]">DocQuiz <span className="text-[hsl(var(--sidebar-primary))]">AI</span></span>
            <span className="font-mono-ui mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--sidebar-foreground)/.52)]">active recall desk</span>
          </span>
        </Link>

        <div className="mb-3 px-3 font-mono-ui text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.4)]">Workspace</div>
        <nav className="space-y-1" aria-label="Main navigation">
          <Link href="/" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${location === '/' ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid="link-nav-library">
            <LayoutDashboard size={16} /> Library
          </Link>
          <Link href="/quiz" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${location === '/quiz' ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid="link-nav-quiz">
            <Sparkles size={16} /> Current quiz
          </Link>
        </nav>

        {/* User Account Section */}
        <div className="mt-auto space-y-3">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.45)] p-2.5 text-left transition-colors hover:bg-[hsl(var(--sidebar-accent))]"
                  data-testid="button-user-profile"
                >
                  <Avatar className="h-9 w-9 ring-1 ring-[hsl(var(--accent)/.4)]">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-[hsl(var(--accent))] text-xs font-bold text-accent-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[hsl(var(--sidebar-foreground))]">{user.name}</p>
                    <p className="truncate text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">{user.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-3 py-2">
                  <p className="text-xs font-bold text-foreground">{user.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive focus:bg-destructive/10 focus:text-destructive"
                  data-testid="button-logout"
                >
                  <LogOut size={14} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--sidebar-accent))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-[hsl(var(--sidebar-primary))] hover:text-[hsl(var(--sidebar-primary-foreground))]"
              data-testid="link-sidebar-login"
            >
              <LogIn size={14} /> Sign in
            </Link>
          )}

          {/* Tutor Server Status */}
          <div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.3)] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className={`h-2 w-2 rounded-full ${health.isPending ? 'bg-[hsl(var(--accent))] pulse-soft' : serverReady ? 'bg-emerald-400' : 'bg-[hsl(var(--sidebar-foreground)/.35)]'}`} />
              {health.isPending ? 'Waking tutor' : serverReady ? 'Tutor online' : 'Tutor offline'}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.55)]">Upload notes to create AI recall sets.</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:pl-[246px]">
        <header className="flex h-[68px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-mobile-brand">
            <Mark />
            <span className="text-sm font-bold tracking-[-0.02em]">DocQuiz <span className="text-primary">AI</span></span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/quiz" className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground" data-testid="link-mobile-quiz">
              <Sparkles size={13} /> Quiz
            </Link>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                      <AvatarFallback className="bg-[hsl(var(--accent))] text-[10px] font-bold text-accent-foreground">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-xs font-bold text-foreground">{user.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut size={14} /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function FileTypeIcon({ type }: { type: string }) {
  return <FileText size={18} className={type.toLowerCase().includes('pdf') ? 'text-primary' : 'text-[hsl(165_38%_42%)]'} />;
}

