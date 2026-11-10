import { ERROR_TEXT } from './errors';
import { totals } from './risk';
import { SETUP_BY_ID } from './setups';
import { etDayKey, minutesInET, reversalAt } from './time';
import { dt, type Direction, type Emotion, type MaState, type SetupId, type TradeRecord } from './types';

export type Period = 'hoy' | 'semana' | 'mes' | 'todo';

export interface Filters {
  period: Period;
  setup: SetupId | 'all';
  direction: Direction | 'all';
}

/** Lunes de la semana (ET) de una clave YYYY-MM-DD. */
export function mondayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // lunes = 0
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0, 10);
}

export function inPeriod(iso: string, period: Period, now = new Date()): boolean {
  if (period === 'todo') return true;
  const k = etDayKey(iso);
  const today = etDayKey(now);
  if (period === 'hoy') return k === today;
  if (period === 'mes') return k.slice(0, 7) === today.slice(0, 7);
  return k >= mondayKey(today) && k <= today;
}

export function applyFilters(trades: TradeRecord[], f: Filters, now = new Date()): TradeRecord[] {
  return trades.filter(
    (t) =>
      inPeriod(t.opened_at, f.period, now) &&
      (f.setup === 'all' || t.setup === f.setup) &&
      (f.direction === 'all' || t.direction === f.direction),
  );
}

/** Trade cerrado con su resultado en R ya calculado. */
export interface ClosedTrade {
  t: TradeRecord;
  r: number;
  pnl: number;
}

export function closedTrades(trades: TradeRecord[]): ClosedTrade[] {
  return trades
    .filter((t) => t.status === 'closed')
    .map((t) => ({ t, ...totals(t.exits) }))
    .sort((a, b) => (a.t.closed_at ?? a.t.opened_at).localeCompare(b.t.closed_at ?? b.t.opened_at));
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

/** El trade respetó la R: riesgo ≤ R y sin errores de tamaño. */
export function respectedR(t: TradeRecord): boolean {
  return (
    Number(t.risk_usd) <= Number(t.r_value) + 0.01 &&
    !t.critical_flags.includes('no_cabe_en_r') &&
    !(t.review?.errors ?? []).includes('mas_acciones')
  );
}

export interface Kpis {
  total: number;
  closed: number;
  winRate: number; // 0–1
  netR: number;
  expectancy: number;
  bestR: number;
  worstR: number;
  netPnl: number;
  avgScore: number;
  contraPct: number; // 0–1
  respectedRPct: number; // 0–1
}

export function kpis(trades: TradeRecord[]): Kpis {
  const c = closedTrades(trades);
  const rs = c.map((x) => x.r);
  return {
    total: trades.length,
    closed: c.length,
    winRate: c.length ? c.filter((x) => x.r > 0).length / c.length : 0,
    netR: round(sum(rs)),
    expectancy: round(avg(rs)),
    bestR: rs.length ? round(Math.max(...rs)) : 0,
    worstR: rs.length ? round(Math.min(...rs)) : 0,
    netPnl: round(sum(c.map((x) => x.pnl))),
    avgScore: round(avg(trades.map((t) => t.quality_score)), 0),
    contraPct: trades.length ? trades.filter((t) => t.trend_type === 'contra').length / trades.length : 0,
    respectedRPct: trades.length ? trades.filter(respectedR).length / trades.length : 0,
  };
}

export interface EquityPoint {
  n: number;
  label: string;
  r: number;
  cum: number;
}

export function equityCurve(trades: TradeRecord[]): EquityPoint[] {
  let cum = 0;
  return closedTrades(trades).map((x, i) => {
    cum = round(cum + x.r);
    return { n: i + 1, label: `#${i + 1} ${x.t.symbol}`, r: round(x.r), cum };
  });
}

export interface Bucket {
  key: string;
  label: string;
  netR: number;
  avgR: number;
  count: number;
}

function groupBy(c: ClosedTrade[], keyOf: (x: ClosedTrade) => { key: string; label: string } | null): Bucket[] {
  const m = new Map<string, { label: string; rs: number[] }>();
  for (const x of c) {
    const k = keyOf(x);
    if (!k) continue;
    const e = m.get(k.key) ?? { label: k.label, rs: [] };
    e.rs.push(x.r);
    m.set(k.key, e);
  }
  return [...m.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    netR: round(sum(v.rs)),
    avgR: round(avg(v.rs)),
    count: v.rs.length,
  }));
}

export function bySetup(trades: TradeRecord[]): Bucket[] {
  return groupBy(closedTrades(trades), ({ t }) => ({
    key: t.setup,
    label: dt(SETUP_BY_ID[t.setup].short, 'long') === dt(SETUP_BY_ID[t.setup].short, 'short')
      ? dt(SETUP_BY_ID[t.setup].short, 'long')
      : `${dt(SETUP_BY_ID[t.setup].short, 'long')}/${dt(SETUP_BY_ID[t.setup].short, 'short')}`,
  })).sort((a, b) => b.netR - a.netR);
}

const STATE_ORDER: MaState[] = ['estrecho', 'neutral', 'amplio'];
const STATE_LABEL: Record<MaState, string> = { estrecho: 'Estrecho', neutral: 'Neutral', amplio: 'Amplio' };

export function byState(trades: TradeRecord[]): Bucket[] {
  const b = groupBy(closedTrades(trades), ({ t }) => ({ key: t.ma_state, label: STATE_LABEL[t.ma_state] }));
  return STATE_ORDER.map((s) => b.find((x) => x.key === s)).filter((x): x is Bucket => !!x);
}

/** Por hora de entrada (ET), en bloques de 30 min; marca si cayó en un tiempo de reversa. */
export function byTime(trades: TradeRecord[]): (Bucket & { reversal: boolean })[] {
  const b = groupBy(closedTrades(trades), ({ t }) => {
    const m = minutesInET(new Date(t.opened_at));
    const slot = Math.floor(m / 30) * 30;
    const h = Math.floor(slot / 60);
    const h12 = h > 12 ? h - 12 : h;
    return { key: String(slot).padStart(4, '0'), label: `${h12}:${String(slot % 60).padStart(2, '0')}` };
  });
  return b
    .sort((a, b2) => a.key.localeCompare(b2.key))
    .map((x) => {
      const slot = Number(x.key);
      const reversal = [0, 10, 20].some((o) => !!reversalAt(slot + o, 0)) || !!reversalAt(slot + 29, 0);
      return { ...x, reversal };
    });
}

export interface ScorePoint {
  score: number;
  r: number;
  symbol: string;
}

export function scoreVsR(trades: TradeRecord[]): ScorePoint[] {
  return closedTrades(trades).map((x) => ({ score: x.t.quality_score, r: round(x.r), symbol: x.t.symbol }));
}

export interface ErrorCost {
  id: string;
  text: string;
  count: number;
  /** Suma de R de los trades donde apareció el error (negativo = costo). */
  netR: number;
}

export function topErrors(trades: TradeRecord[], limit = 5): ErrorCost[] {
  const c = closedTrades(trades);
  const m = new Map<string, { count: number; rs: number[] }>();
  for (const x of c) {
    for (const e of x.t.review?.errors ?? []) {
      const v = m.get(e) ?? { count: 0, rs: [] };
      v.count++;
      v.rs.push(x.r);
      m.set(e, v);
    }
  }
  return [...m.entries()]
    .map(([id, v]) => ({ id, text: ERROR_TEXT[id] ?? id, count: v.count, netR: round(sum(v.rs)) }))
    .sort((a, b) => b.count - a.count || a.netR - b.netR)
    .slice(0, limit);
}

export const EMOTION_LABEL: Record<Emotion, string> = {
  tranquilo: 'Tranquilo',
  ansioso: 'Ansioso',
  fomo: 'FOMO',
  venganza: 'Venganza',
  miedo: 'Miedo',
  sobreconfiado: 'Sobreconfiado',
  aburrido: 'Aburrido',
};

export function byEmotion(trades: TradeRecord[]): Bucket[] {
  return groupBy(closedTrades(trades), ({ t }) =>
    t.review?.emotion ? { key: t.review.emotion, label: EMOTION_LABEL[t.review.emotion] } : null,
  ).sort((a, b) => b.netR - a.netR);
}
