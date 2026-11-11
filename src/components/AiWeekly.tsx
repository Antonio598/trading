import { BookOpen, Sparkles, Target, ThumbsUp, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MIN_TRADES_FOR_AI, buildWeeklyStats } from '../domain/aiPayload';
import { RULES } from '../domain/rules';
import { applyFilters, mondayKey } from '../domain/stats';
import { etDayKey } from '../domain/time';
import type { TradeRecord } from '../domain/types';
import { analyzeWeek, loadReports, type SavedReport } from '../lib/ai';
import { Notice, Panel, hasRule, openRule } from './hud/primitives';

function RuleLink({ id }: { id: string }) {
  if (!hasRule(id)) return null;
  return (
    <button onClick={() => openRule(id)} className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-accent">
      <BookOpen size={13} /> Repasar: {RULES[id].title}
    </button>
  );
}

const fmtWeek = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};

export function AiWeekly({ trades, online }: { trades: TradeRecord[]; online: boolean }) {
  const week = mondayKey(etDayKey());
  const weekTrades = useMemo(() => applyFilters(trades, { period: 'semana', setup: 'all', direction: 'all' }), [trades]);
  const closed = weekTrades.filter((t) => t.status === 'closed').length;
  const [saved, setSaved] = useState<SavedReport | null>(() => loadReports()[week] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enough = closed >= MIN_TRADES_FOR_AI;
  const hasNewData = saved ? closed > saved.closed : true;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setSaved(await analyzeWeek(buildWeeklyStats(weekTrades, week)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = saved?.report;

  return (
    <Panel title="Tu coach con IA" hint={`Analiza tu semana (desde el lunes ${fmtWeek(week)}) y te dice qué hacer la próxima.`}>
      {!r && !enough && (
        <p className="text-sm text-ink-dim">
          Necesitas al menos {MIN_TRADES_FOR_AI} trades cerrados esta semana. Llevas {closed}.
        </p>
      )}

      {r && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-ink">{r.resumen}</p>

          <div className="border border-accent/40 bg-accent/[0.06] p-3">
            <div className="hud-label flex items-center gap-1.5 text-accent">
              <Target size={14} aria-hidden /> Tu regla de la semana
            </div>
            <div className="mt-1 tracking-[-0.02em] text-base font-bold text-ink">{r.regla_semana.titulo}</div>
            <p className="mt-1 text-sm text-ink">{r.regla_semana.por_que}</p>
            <p className="mt-1 text-sm text-ink-dim">
              <b className="text-ink">Cómo:</b> {r.regla_semana.como_aplicarla}
            </p>
            <RuleLink id={r.regla_semana.regla_id} />
          </div>

          <div>
            <div className="hud-label mb-1.5 flex items-center gap-1.5 text-bear">
              <TriangleAlert size={14} aria-hidden /> Lo que más te cuesta
            </div>
            <ol className="space-y-2.5">
              {r.errores.map((e, i) => (
                <li key={i} className="rounded-ctl bg-void-3 p-3.5">
                  <div className="font-semibold text-ink">
                    {i + 1}. {e.titulo}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-dim">{e.evidencia}</p>
                  <p className="mt-1 text-sm text-ink">
                    <b>Qué hacer:</b> {e.que_hacer}
                  </p>
                  <RuleLink id={e.regla_id} />
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="hud-label mb-1.5 flex items-center gap-1.5 text-bull">
              <ThumbsUp size={14} aria-hidden /> Lo que haces bien
            </div>
            <ul className="space-y-2">
              {r.fortalezas.map((f, i) => (
                <li key={i} className="rounded-ctl bg-void-3 p-3.5">
                  <div className="font-semibold text-ink">{f.titulo}</div>
                  <p className="mt-0.5 text-sm text-ink-dim">{f.detalle}</p>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-ink-dim">
            Analizado con {saved!.closed} trades ·{' '}
            {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(saved!.generated_at))}. La IA puede
            equivocarse: revisa cada punto contra tus trades.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Notice tone="bear">{error}</Notice>
        </div>
      )}

      {enough && (!r || hasNewData) && (
        <button className="btn-primary mt-3 w-full" disabled={busy || !online} onClick={run}>
          <Sparkles size={18} />
          {busy ? 'Analizando… (hasta 1 min)' : r ? 'Actualizar con mis trades nuevos' : 'Analizar mi semana'}
        </button>
      )}
      {enough && !online && <p className="mt-2 text-center text-xs text-ink-dim">Necesitas internet para el análisis.</p>}
      {!r && enough && (
        <p className="mt-2 text-center text-[11px] text-ink-dim">Se envían solo tus estadísticas en R. No se envían montos en dólares, notas ni datos de tu cuenta.</p>
      )}
    </Panel>
  );
}
