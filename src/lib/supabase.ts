import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!url && !!anon;

export const supabase = createClient(url ?? 'http://localhost', anon ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vj-auth' },
});

/** Errores de red (sin conexión) vs errores reales del servidor. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return /fetch|network|load failed|timeout/i.test(msg);
}
