import { LogOut, Save } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chips, NeonCheck, Notice, NumField, Panel, usd } from '../components/hud/primitives';
import { mlptStatus } from '../domain/risk';
import { DEFAULT_PROFILE, type Profile, type Timeframe } from '../domain/types';
import { supabase } from '../lib/supabase';
import { InstallPanel } from '../components/InstallApp';
import { useJournal } from '../state/journal';

function Field({ children, hint }: { children: React.ReactNode; hint: React.ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-1 text-xs leading-snug text-ink-dim">{hint}</p>
    </div>
  );
}

export function Plan() {
  const stored = useJournal((s) => s.profile);
  const { saveProfile, email, pending, syncError } = useJournal();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile>(stored ?? DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const firstTime = !(stored?.r_value && stored.r_value > 0);
  const up = (patch: Partial<Profile>) => {
    setP({ ...p, ...patch });
    setSaved(false);
  };
  const mlpt = mlptStatus(p);
  const pct = p.max_daily_loss > 0 ? Math.round((p.mlpt / p.max_daily_loss) * 100) : 0;
  const suggestedMlpt = Math.round(p.max_daily_loss / 3);
  const valid = p.r_value > 0 && p.account_size > 0 && p.max_daily_loss > 0 && p.timeframes.length > 0;

  async function save() {
    await saveProfile(p);
    setSaved(true);
    if (firstTime) navigate('/');
  }

  const toggleTf = (t: Timeframe) =>
    up({ timeframes: p.timeframes.includes(t) ? p.timeframes.filter((x) => x !== t) : [...p.timeframes, t].sort((a, b) => a - b) });

  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink">Mi plan</h1>

      {firstTime && (
        <div className="hud-panel space-y-2 p-4">
          <div className="tracking-[-0.02em] text-base font-bold text-ink">Bienvenido 👋</div>
          <p className="text-sm text-ink-dim">La app funciona en 3 pasos:</p>
          <ol className="space-y-1.5 text-sm text-ink">
            <li>
              <b className="text-accent">1.</b> Antes de entrar a un trade, llena la <b>checklist</b>. Te dice si el trade vale la pena.
            </li>
            <li>
              <b className="text-accent">2.</b> Cuando salgas, <b>cierra el trade</b> y marca qué hiciste mal (si aplica).
            </li>
            <li>
              <b className="text-accent">3.</b> Revisa <b>Progreso</b> para ver en qué estás fallando.
            </li>
          </ol>
          <p className="text-sm text-ink-dim">Primero, cuéntanos cuánto arriesgas. Solo lo haces una vez.</p>
        </div>
      )}

      <Panel title="Tu dinero y tu riesgo">
        <div className="space-y-4">
          <Field hint="Cuánto dinero tienes para operar.">
            <NumField label="Tamaño de tu cuenta" prefix="$" value={p.account_size || null} onChange={(v) => up({ account_size: v ?? 0 })} />
          </Field>
          <Field
            hint={
              <>
                Lo máximo que aceptas perder <b className="text-ink">en un solo trade</b>. A esto se le llama <b className="text-accent">R</b>: si
                pierdes esto, perdiste "1R". Mantenlo igual casi siempre.
              </>
            }
          >
            <NumField label="R · riesgo por trade" prefix="$" value={p.r_value || null} onChange={(v) => up({ r_value: v ?? 0 })} />
          </Field>
          <Field hint="Si pierdes esto en un día, dejas de operar ese día.">
            <NumField label="Pérdida máxima del día" prefix="$" value={p.max_daily_loss || null} onChange={(v) => up({ max_daily_loss: v ?? 0 })} />
          </Field>
          <Field hint="Tu tope si un trade sale muy mal (por ejemplo, un hueco). Debe ser entre 25% y 50% de tu pérdida máxima del día.">
            <NumField label="Pérdida máxima por trade (MLPT)" prefix="$" value={p.mlpt || null} onChange={(v) => up({ mlpt: v ?? 0 })} />
          </Field>
        </div>
        <div className="mt-3 space-y-2">
          {mlpt === 'ok' && <Notice tone="bull">Tu MLPT está bien: es el {pct}% de tu pérdida del día.</Notice>}
          {(mlpt === 'bajo' || mlpt === 'alto') && (
            <Notice tone="warn" title={`Tu MLPT es el ${pct}% de tu pérdida del día`}>
              Debe estar entre {usd(p.max_daily_loss * 0.25, 0)} y {usd(p.max_daily_loss * 0.5, 0)}.{' '}
              <button className="font-bold text-accent underline" onClick={() => up({ mlpt: suggestedMlpt })}>
                Usar {usd(suggestedMlpt, 0)}
              </button>
            </Notice>
          )}
          {mlpt === 'sin_datos' && p.max_daily_loss > 0 && (
            <button className="btn-ghost w-full" onClick={() => up({ mlpt: suggestedMlpt })}>
              Sugerir MLPT: {usd(suggestedMlpt, 0)}
            </button>
          )}
        </div>
      </Panel>

      <Panel title="Límite de trades" hint="Para no sobreoperar. Déjalo vacío si no quieres límite.">
        <NumField label="Máximo de trades por día" integer value={p.max_trades_day} onChange={(v) => up({ max_trades_day: v && v > 0 ? v : null })} />
      </Panel>

      <Panel title="Gráficos que usas" hint="Elige los que operas. Aparecerán como opción en la checklist.">
        <Chips multi ariaLabel="Gráficos" cols={4} options={([1, 2, 5, 15] as Timeframe[]).map((t) => ({ id: t, label: `${t} min` }))} value={p.timeframes} onChange={toggleTf} />
      </Panel>

      <Panel title="Pantalla">
        <NeonCheck checked={p.reduce_motion} onChange={(v) => up({ reduce_motion: v })} label="Reducir animaciones" />
      </Panel>

      <button className="btn-primary w-full" disabled={!valid} onClick={save}>
        <Save size={18} /> {saved ? 'Guardado ✓' : firstTime ? 'Guardar y empezar' : 'Guardar'}
      </button>
      {!valid && <p className="text-center text-xs text-ink-dim">Llena tu cuenta, tu R y tu pérdida máxima del día.</p>}

      <InstallPanel />

      {!firstTime && (
        <Panel title="Cuenta">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="truncate text-ink">{email}</div>
              <div className="text-xs text-ink-dim">{pending > 0 ? `${pending} cambio(s) por subir (se suben solos)` : 'Todo guardado en la nube'}</div>
              {syncError && <div className="text-xs text-bear">No se pudo guardar algo: {syncError}</div>}
            </div>
            <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
