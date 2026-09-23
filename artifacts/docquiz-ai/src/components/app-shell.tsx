import type { ReactNode } from 'react';
import { BookOpen, FileText, LayoutDashboard, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';

function Mark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]" aria-hidden="true">
      <BookOpen size={18} strokeWidth={2.2} />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const serverReady = health.isSuccess && health.data?.status === 'ok';

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="hidden min-h-[100dvh] w-[246px] shrink-0 flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] md:flex">
        <Link href="/" className="mb-14 flex items-center gap-3" data-testid="link-brand-home">
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

        <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold">
            <span className={`h-2 w-2 rounded-full ${health.isPending ? 'bg-[hsl(var(--accent))] pulse-soft' : serverReady ? 'bg-emerald-400' : 'bg-[hsl(var(--sidebar-foreground)/.35)]'}`} />
            {health.isPending ? 'Waking tutor' : serverReady ? 'Tutor online' : 'Tutor offline'}
          </div>
          <p className="text-xs leading-relaxed text-[hsl(var(--sidebar-foreground)/.55)]">Upload notes when you are ready to turn them into recall practice.</p>
        </div>
      </aside>

      <div className="min-w-0 md:pl-[246px]">
        <header className="flex h-[68px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-mobile-brand">
            <Mark />
            <span className="text-sm font-bold tracking-[-0.02em]">DocQuiz <span className="text-primary">AI</span></span>
          </Link>
          <Link href="/quiz" className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground" data-testid="link-mobile-quiz">
            <Sparkles size={14} /> Quiz
          </Link>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function FileTypeIcon({ type }: { type: string }) {
  return <FileText size={18} className={type.toLowerCase().includes('pdf') ? 'text-primary' : 'text-[hsl(165_38%_42%)]'} />;
}
