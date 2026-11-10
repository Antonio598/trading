import type { Session } from '@supabase/supabase-js';
import { MotionConfig } from 'framer-motion';
import { BarChart3, BookOpen, CloudOff, ClipboardCheck, List, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ETClock } from './components/hud/ETClock';
import { RuleSheet, cx } from './components/hud/primitives';
import { supabase } from './lib/supabase';
import { Checklist } from './pages/checklist/Checklist';
import { CloseTrade } from './pages/CloseTrade';
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
import { Library } from './pages/Library';
import { Login } from './pages/Login';
import { Plan } from './pages/Plan';
import { Trades } from './pages/Trades';
import { useJournal } from './state/journal';

function Boot() {
  return (
    <div id="boot">
      <div className="boot-ring" />
      <div className="boot-text">VELEZ&nbsp;HUD</div>
    </div>
  );
}

function SyncBadge() {
  const { pending, syncing, online, sync } = useJournal();
  if (!online)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-warn" role="status">
        <CloudOff size={13} /> Sin internet{pending ? ` · ${pending} por subir` : ''}
      </span>
    );
  if (pending || syncing)
    return (
      <button onClick={() => sync()} className="inline-flex items-center gap-1 text-[11px] text-cyan-neon" aria-label="Sincronizar">
        <RefreshCw size={13} className={cx(syncing && 'animate-spin')} /> {pending || ''}
      </button>
    );
  return null;
}

function Shell() {
  const profile = useJournal((s) => s.profile);
  const hasPlan = !!profile && profile.r_value > 0;
  const nav = [
    { to: '/', label: 'Nuevo', Icon: ClipboardCheck },
    { to: '/trades', label: 'Trades', Icon: List },
    { to: '/progreso', label: 'Progreso', Icon: BarChart3 },
    { to: '/reglas', label: 'Reglas', Icon: BookOpen },
    { to: '/plan', label: 'Plan', Icon: SlidersHorizontal },
  ];
  return (
    <MotionConfig reducedMotion={profile?.reduce_motion ? 'always' : 'user'} transition={{ duration: 0.2 }}>
      <header className="sticky top-0 z-30 border-b border-cyan-neon/10 bg-void/90 px-4 pb-2 pt-[max(env(safe-area-inset-top),8px)] backdrop-blur-md">
        <div className="mx-auto max-w-xl">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-[11px] font-bold tracking-[0.3em] text-cyan-neon">VELEZ·HUD</span>
            <SyncBadge />
          </div>
          <ETClock />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-3">
        <Routes>
          <Route path="/" element={hasPlan ? <Checklist /> : <Navigate to="/plan" replace />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/:id" element={<CloseTrade />} />
          <Route path="/progreso" element={<Suspense fallback={<Boot />}><Dashboard /></Suspense>} />
          <Route path="/feedback" element={<Navigate to="/progreso" replace />} />
          <Route path="/reglas" element={<Library />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cyan-neon/15 bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition', isActive ? 'text-cyan-neon' : 'text-ink-dim')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} style={isActive ? { filter: 'drop-shadow(0 0 6px #00E5FF)' } : undefined} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <RuleSheet />
    </MotionConfig>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { init, reset, loaded, sync } = useJournal();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) void init(session.user.id, session.user.email ?? null);
    else if (session === null) reset();
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => {
      useJournal.setState({ online: true });
      void sync();
    };
    const off = () => useJournal.setState({ online: false });
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [sync]);

  if (session === undefined) return <Boot />;
  if (!session) return <Login />;
  if (!loaded) return <Boot />;
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
