import { LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Chips, Notice } from '../components/hud/primitives';
import { supabase, supabaseConfigured } from '../lib/supabase';

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bear' | 'bull' | 'info'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg({ tone: 'bear', text: error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error)
          setMsg({
            tone: 'bear',
            text: /confirmation email/i.test(error.message)
              ? 'El servidor no puede enviar correos de confirmación (SMTP sin configurar). Si ya tienes cuenta en tus otras apps, entra con ese mismo correo y contraseña.'
              : error.message,
          });
        else if (!data.session) setMsg({ tone: 'info', text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' });
      }
    } catch (err) {
      setMsg({ tone: 'bear', text: `No se pudo conectar con el servidor: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <img src="/icons/icon.svg" alt="" className="mx-auto mb-4 h-16 w-16" style={{ filter: 'drop-shadow(0 0 16px rgba(0,229,255,.45))' }} />
        <h1 className="font-display text-2xl font-black tracking-[0.2em] text-cyan-neon">VELEZ HUD</h1>
        <p className="mt-1 text-sm text-ink-dim">Checklist · Bitácora · Feedback</p>
      </div>
      {!supabaseConfigured && (
        <Notice tone="bear" title="Falta configuración">
          Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local.
        </Notice>
      )}
      <form onSubmit={submit} className="hud-panel space-y-3 p-5">
        <Chips
          ariaLabel="Modo"
          cols={2}
          options={[
            { id: 'in', label: 'Entrar' },
            { id: 'up', label: 'Crear cuenta' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <label className="block">
          <span className="hud-label mb-1.5 block">Correo</span>
          <input className="hud-input !font-sans !text-base" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="hud-label mb-1.5 block">Contraseña</span>
          <input
            className="hud-input !font-sans !text-base"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>
          {mode === 'in' ? <LogIn size={18} /> : <UserPlus size={18} />}
          {busy ? 'Conectando…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
