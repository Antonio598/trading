import { AlertTriangle, BookOpen, Check, Info, OctagonX, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DataTable, EquityChart, RBarChart, RRankChart, ScoreScatter } from '../components/charts';
import { CountUp } from '../components/hud/gauges';
import { Chips, Fold, Panel, cx, fmtR, hasRule, openRule, usd } from '../components/hud/primitives';
import { insights, type Insight } from '../domain/insights';
import { RULES } from '../domain/rules';
import { SETUPS } from '../domain/setups';
import {
  applyFilters,
  byEmotion,
  bySetup,
  byState,
  byTime,
  equityCurve,
  kpis,
  scoreVsR,
  topErrors,
  type Filters,
  type Period,
} from '../domain/stats';
import { dt, type Direction, type SetupId, type TradeRecord } from '../domain/types';
import { useJournal } from '../state/journal';
import { AiWeekly } from '../components/AiWeekly';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'todo', label: 'Todo' },
];

const FILTER_KEY = 'vj-dash-filters';
function loadFilters(): Filters {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) ?? 'null');
    if (f && f.period) return f;
  } catch {
    /* sin storage */
  }
  return { period: 'semana', setup: 'all', direction: 'all' };
}

function Kpi({
  label,
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  tone,
  icon,
  sub,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  tone?: 'bull' | 'bear' | 'warn';
  icon?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const c = tone ? { bull: 'text-bull', bear: 'text-bear', warn: 'text-warn' }[tone] : 'text-ink';
  return (
    <div className="hud-panel p-3">
      <div className="hud-label flex items-center gap-1 !text-[10px]">
        {icon}
        {label}
      </div>
      <div className={cx('font-num mt-1 text-2xl font-bold leading-none', c)}>
        {prefix}
        <CountUp value={value} decimals={decimals} />
        {suffix}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-dim">{sub}</div>}
    </div>
  );
}

const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
const toneOf = (v: number) => (v > 0 ? 'bull' : v < 0 ? 'bear' : undefined);

function InsightRow({ i }: { i: Insight }) {
  const Icon = i.tone === 'bear' ? OctagonX : i.tone === 'warn' ? AlertTriangle : i.tone === 'bull' ? Check : Info;
  const color = { bear: 'text-bear border-bear/60', warn: 'text-warn border-warn/60', bull: 'text-bull border-bull/50', info: 'text-cyan-neon border-cyan-neon/40' }[i.tone];
  return (
    <li className={cx('border-l-2 bg-white/[0.02] px-3 py-2.5', color)}>
      <div className="flex gap-2.5">
        <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-ink">{i.text}</p>
          {hasRule(i.rule) && (
            <button onClick={() => openRule(i.rule!)} className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-cyan-neon">
              <BookOpen size={13} /> Repasar la regla: {RULES[i.rule!].title}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function Dashboard() {
  const all = useJournal((s) => s.trades);
  const online = useJournal((s) => s.online);
  const [f, setF] = useState<Filters>(loadFilters);
  const update = (p: Partial<Filters>) => {
    const next = { ...f, ...p };
    setF(next);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next));
    } catch {
      /* sin storage */
    }
  };

  const trades = useMemo(() => applyFilters(all, f), [all, f]);
  const d = useMemo(() => {
    const time = byTime(trades);
    return {
      k: kpis(trades),
      equity: equityCurve(trades),
      setups: bySetup(trades),
      states: byState(trades),
      time,
      revKeys: new Set(time.filter((t) => t.reversal).map((t) => t.key)),
      scatter: scoreVsR(trades),
      errors: topErrors(trades),
      emotions: byEmotion(trades),
      insights: insights(trades),
    };
  }, [trades]);
  const { k } = d;
  const contraAlert = k.contraPct > 0.1;

  const [showMore, setShowMore] = useState(() => {
    try {
      return localStorage.getItem('vj-dash-more') === '1';
    } catch {
      return false;
    }
  });
  const [allInsights, setAllInsights] = useState(false);
  const toggleMore = () => {
    setShowMore(!showMore);
    try {
      localStorage.setItem('vj-dash-more', showMore ? '0' : '1');
    } catch {
      /* sin storage */
    }
  };
  const wins = closedCount(trades, (r) => r > 0);
  const periodText = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', todo: 'En total' }[f.period];
  const filtered = f.setup !== 'all' || f.direction !== 'all';
  const shownInsights = allInsights ? d.insights : d.insights.slice(0, 3);

  return (
    <div className="space-y-3 pb-24">
      <h1 className="font-display text-xl font-bold tracking-wider text-cyan-neon">MI PROGRESO</h1>

      <Chips ariaLabel="Periodo" cols={4} size="sm" options={PERIODS} value={f.period} onChange={(period) => update({ period })} />
      <Fold title="Filtrar" hint={filtered ? 'Filtro activo' : 'Por setup o dirección'} badge={filtered ? <span className="h-2 w-2 rounded-full bg-cyan-neon" /> : undefined}>
        <div className="space-y-2">
          <select
            aria-label="Setup"
            value={f.setup}
            onChange={(e) => update({ setup: e.target.value as SetupId | 'all' })}
            className="hud-input !py-2 !font-sans !text-sm"
          >
            <option value="all">Todos los setups</option>
            {SETUPS.map((s) => (
              <option key={s.id} value={s.id}>
                {dt(s.short, 'long') === dt(s.short, 'short') ? dt(s.short, 'long') : `${dt(s.short, 'long')} / ${dt(s.short, 'short')}`}
              </option>
            ))}
          </select>
          <Chips
            ariaLabel="Dirección"
            cols={3}
            size="sm"
            options={[
              { id: 'all', label: 'Ambas' },
              { id: 'long', label: 'Compras', tone: 'bull' },
              { id: 'short', label: 'Ventas', tone: 'bear' },
            ]}
            value={f.direction}
            onChange={(direction) => update({ direction: direction as Direction | 'all' })}
          />
        </div>
      </Fold>

      <AiWeekly trades={all} online={online} />

      {k.closed === 0 ? (
        <Panel>
          <p className="text-sm text-ink-dim">
            {trades.length === 0
              ? 'Todavía no hay trades en este periodo. Cuando cierres tus trades, aquí verás cómo vas y qué mejorar.'
              : `Tienes ${trades.length} trade(s) abierto(s). Ciérralos para ver tus resultados.`}
          </p>
        </Panel>
      ) : (
        <>
          {/* Resumen simple */}
          <div className="hud-panel p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="hud-label">{periodText}</div>
                <div className={cx('font-display mt-1 text-5xl font-black leading-none', k.netR >= 0 ? 'text-bull' : 'text-bear')} style={{ textShadow: '0 0 18px currentColor' }}>
                  {signed(k.netR)}
                  <CountUp value={Math.abs(k.netR)} decimals={2} />R
                </div>
                <div className="font-num mt-1 text-sm text-ink">{usd(k.netPnl)}</div>
              </div>
              {k.netR >= 0 ? <TrendingUp size={40} className="text-bull" aria-hidden /> : <TrendingDown size={40} className="text-bear" aria-hidden />}
            </div>
            <p className="mt-3 text-sm text-ink-dim">
              {k.netR >= 0 ? 'Vas ganando' : 'Vas perdiendo'} {Math.abs(k.netR).toFixed(1)} veces tu riesgo por trade (R). Ganaste {wins} de {k.closed} trade
              {k.closed === 1 ? '' : 's'}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Aciertas" value={k.winRate * 100} suffix="%" sub="de tus trades" />
            <Kpi label="Por trade" value={Math.abs(k.expectancy)} decimals={2} prefix={signed(k.expectancy)} suffix="R" tone={toneOf(k.expectancy)} sub="en promedio" />
            <Kpi
              label="Seguiste tu R"
              value={k.respectedRPct * 100}
              suffix="%"
              tone={k.respectedRPct >= 1 ? 'bull' : 'warn'}
              icon={k.respectedRPct < 1 ? <AlertTriangle size={11} className="text-warn" /> : undefined}
              sub="de las veces"
            />
          </div>

          {d.insights.length > 0 && (
            <Panel title="Lo que debes saber" hint="Calculado con tus propios trades.">
              <ul className="space-y-2">
                {shownInsights.map((i) => (
                  <InsightRow key={i.id} i={i} />
                ))}
              </ul>
              {d.insights.length > 3 && (
                <button className="mt-2 min-h-[40px] text-sm font-semibold text-cyan-neon" onClick={() => setAllInsights(!allInsights)}>
                  {allInsights ? 'Ver menos' : `Ver los ${d.insights.length}`}
                </button>
              )}
            </Panel>
          )}

          <Panel title="Tu avance" hint="Cómo crece (o baja) tu resultado trade tras trade.">
            <EquityChart data={d.equity} />
          </Panel>

          <Panel title="Tus errores más caros">
            {d.errors.length === 0 ? (
              <p className="text-sm text-ink-dim">No marcaste errores en estos trades. 👍</p>
            ) : (
              <ol className="space-y-2.5">
                {d.errors.map((e, idx) => {
                  const max = Math.max(...d.errors.map((x) => Math.abs(x.netR)), 0.01);
                  return (
                    <li key={e.id}>
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-ink">
                          <span className="font-num mr-1.5 text-ink-dim">{idx + 1}.</span>
                          {e.text}
                        </span>
                        <span className="font-num shrink-0 text-right">
                          <span className={e.netR < 0 ? 'text-bear' : 'text-bull'}>{fmtR(e.netR)}</span>
                          <span className="block text-[11px] text-ink-dim">
                            {e.count} {e.count === 1 ? 'vez' : 'veces'}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 bg-white/5">
                        <div className={cx('h-full', e.netR < 0 ? 'bg-bear' : 'bg-bull')} style={{ width: `${(Math.abs(e.netR) / max) * 100}%`, borderRadius: '0 4px 4px 0' }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <button className="btn-ghost w-full" onClick={toggleMore} aria-expanded={showMore}>
            {showMore ? 'Ocultar estadísticas detalladas' : 'Ver estadísticas detalladas'}
          </button>

          {showMore && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Kpi label="Trades" value={k.total} sub={`${k.closed} cerrados`} />
                <Kpi label="Score promedio" value={k.avgScore} tone={k.avgScore >= 80 ? 'bull' : k.avgScore >= 60 ? 'warn' : 'bear'} sub="de la checklist" />
                <Kpi label="Mejor trade" value={Math.abs(k.bestR)} decimals={2} prefix={signed(k.bestR)} suffix="R" tone={toneOf(k.bestR)} />
                <Kpi label="Peor trade" value={Math.abs(k.worstR)} decimals={2} prefix={signed(k.worstR)} suffix="R" tone={toneOf(k.worstR)} />
                <Kpi
                  label="Contra tendencia"
                  value={k.contraPct * 100}
                  suffix="%"
                  tone={contraAlert ? 'bear' : undefined}
                  icon={contraAlert ? <OctagonX size={11} className="text-bear" /> : undefined}
                  sub={contraAlert ? 'Más del 10% permitido' : 'Máximo: 10%'}
                />
              </div>

              <Panel title="Resultado por setup" hint="Cuál patrón te funciona y cuál no.">
                <RRankChart data={d.setups} />
                <DataTable head={['Setup', 'Trades', 'R neto', 'R prom.']} rows={d.setups.map((b) => [b.label, b.count, fmtR(b.netR), fmtR(b.avgR)])} />
              </Panel>

              <Panel title="Resultado por hora (NY)" hint="◆ = hora de reversa del manual." help="tiempos">
                <RBarChart data={d.time} markKeys={d.revKeys} />
                <DataTable head={['Hora', 'Trades', 'R neto', 'Reversa']} rows={d.time.map((b) => [b.label, b.count, fmtR(b.netR), b.reversal ? 'Sí' : '—'])} />
              </Panel>

              <Panel title="Resultado por estado de las líneas" help="estado">
                <RBarChart data={d.states} height={170} />
                <DataTable head={['Estado', 'Trades', 'R neto', 'R prom.']} rows={d.states.map((b) => [b.label, b.count, fmtR(b.netR), fmtR(b.avgR)])} />
              </Panel>

              <Panel title="¿La checklist funciona?" hint="Cada punto es un trade: su puntaje contra lo que ganaste o perdiste." help="score">
                <ScoreScatter data={d.scatter} />
                <DataTable head={['Acción', 'Score', 'R']} rows={d.scatter.map((p) => [p.symbol, p.score, fmtR(p.r)])} />
              </Panel>

              <Panel title="Resultado por emoción">
                {d.emotions.length === 0 ? (
                  <p className="text-sm text-ink-dim">Marca cómo te sentiste al cerrar tus trades para ver esto.</p>
                ) : (
                  <>
                    <RRankChart data={d.emotions} />
                    <DataTable head={['Emoción', 'Trades', 'R neto', 'R prom.']} rows={d.emotions.map((b) => [b.label, b.count, fmtR(b.netR), fmtR(b.avgR)])} />
                  </>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}

function closedCount(trades: TradeRecord[], pred: (r: number) => boolean) {
  return trades.filter((t) => t.status === 'closed' && pred(t.exits.reduce((a, e) => a + Number(e.r_result), 0))).length;
}
