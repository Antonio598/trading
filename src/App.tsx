import type { Session } from '@supabase/supabase-js';
import { MotionConfig } from 'framer-motion';
import { BarChart3, BookOpen, CloudOff, List, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
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
      <div className="boot-text">Velez</div>
    </div>
  );
}

function SyncBadge() {
  const { pending, syncing, online, sync } = useJournal();
  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-[12px] font-bold text-warn" role="status">
        <CloudOff size={13} /> Sin internet{pending ? ` · ${pending} por subir` : ''}
      </span>
    );
  if (pending || syncing)
    return (
      <button onClick={() => sync()} className="inline-flex items-center gap-1.5 rounded-full bg-void-3 px-3 py-1 text-[12px] font-bold text-ink-dim" aria-label="Sincronizar">
        <RefreshCw size={13} className={cx(syncing && 'animate-spin')} /> {syncing ? 'Guardando' : `${pending} por subir`}
      </button>
    );
  return null;
}

/** Barra inferior: cuatro secciones y, al centro, el botón para un trade nuevo. */
function BottomNav() {
  const side = (to: string, label: string, Icon: typeof List) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx('flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition', isActive ? 'text-ink' : 'text-ink-dim hover:text-ink/80')
      }
    >
      {({ isActive }) => (
        <>
          <span className={cx('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-accent/[0.16] text-accent')}>
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.05] bg-void-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Secciones">
      <div className="mx-auto grid h-[68px] max-w-xl grid-cols-5 px-2">
        {side('/trades', 'Trades', List)}
        {side('/progreso', 'Progreso', BarChart3)}
        <NavLink to="/" end aria-label="Nuevo trade" className="flex flex-col items-center justify-start" title="Nuevo trade">
          {({ isActive }) => (
            <span
              className={cx(
                'mt-1.5 grid h-[52px] w-[52px] place-items-center rounded-[18px] bg-accent text-void transition active:scale-95',
                isActive && 'ring-4 ring-accent/25',
              )}
            >
              <Plus size={28} strokeWidth={2.6} />
            </span>
          )}
        </NavLink>
        {side('/reglas', 'Reglas', BookOpen)}
        {side('/plan', 'Plan', SlidersHorizontal)}
      </div>
    </nav>
  );
}

function Shell() {
  const profile = useJournal((s) => s.profile);
  const hasPlan = !!profile && profile.r_value > 0;
  return (
    <MotionConfig reducedMotion={profile?.reduce_motion ? 'always' : 'user'} transition={{ duration: 0.2 }}>
      <header className="sticky top-0 z-30 bg-void/85 px-5 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex min-h-[28px] items-center justify-between">
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
              Velez<span className="text-accent">.</span>
            </span>
            <SyncBadge />
          </div>
          <ETClock />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 pt-4">
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
      <BottomNav />
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
