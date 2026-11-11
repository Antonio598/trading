/**
 * Resumen de la semana que se envía a la IA. Solo estadísticas en R:
 * sin dólares, sin notas, sin símbolos, sin correo ni identificadores.
 */
import { ERROR_TEXT } from './errors';
import { insights } from './insights';
import { CRITICAL_TEXT } from './rules';
import { SETUP_BY_ID } from './setups';
import { byEmotion, bySetup, byState, byTime, closedTrades, kpis, topErrors } from './stats';
import { fmtMinutes, minutesInET } from './time';
import { dt, type TradeRecord } from './types';

export interface WeeklyStats {
  semana: string;
  kpis: {
    trades: number;
    cerrados: number;
    pct_ganadores: number;
    r_neto: number;
    r_promedio_por_trade: number;
    mejor_r: number;
    peor_r: number;
    score_promedio: number;
    pct_contra_tendencia: number;
    pct_respeto_r: number;
    ejecucion_promedio: number | null;
  };
  por_score: { rango: string; trades: number; r_promedio: number }[];
  por_setup: { setup: string; trades: number; r_neto: number }[];
  por_estado: { estado: string; trades: number; r_neto: number }[];
  por_hora_et: { hora: string; trades: number; r_neto: number; tiempo_de_reversa: boolean }[];
  por_emocion: { emocion: string; trades: number; r_neto: number }[];
  errores: { error: string; veces: number; r_neto: number }[];
  reglas_rotas_al_registrar: { regla: string; veces: number }[];
  hallazgos_automaticos: string[];
  trades: {
    setup: string;
    direccion: 'compra' | 'venta';
    instrumento: 'accion' | 'call' | 'put';
    tendencia: string;
    estado: string;
    hora_et: string;
    score: number;
    veredicto: string;
    reglas_rotas: string[];
    r: number;
    emocion: string | null;
    ejecucion: number | null;
    errores: string[];
  }[];
}

/** Mínimo de trades cerrados para que el análisis tenga sentido. */
export const MIN_TRADES_FOR_AI = 3;
const MAX_TRADES_SENT = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildWeeklyStats(trades: TradeRecord[], semana: string): WeeklyStats {
  const k = kpis(trades);
  const closed = closedTrades(trades);
  const ratings = closed.map((c) => c.t.review?.execution_rating).filter((x): x is number => typeof x === 'number');

  const bucket = (label: string, pred: (s: number) => boolean) => {
    const xs = closed.filter((c) => pred(c.t.quality_score));
    return { rango: label, trades: xs.length, r_promedio: xs.length ? r2(xs.reduce((a, c) => a + c.r, 0) / xs.length) : 0 };
  };

  const flagCount = new Map<string, number>();
  for (const t of trades) for (const f of t.critical_flags) flagCount.set(f, (flagCount.get(f) ?? 0) + 1);

  return {
    semana,
    kpis: {
      trades: k.total,
      cerrados: k.closed,
      pct_ganadores: Math.round(k.winRate * 100),
      r_neto: k.netR,
      r_promedio_por_trade: k.expectancy,
      mejor_r: k.bestR,
      peor_r: k.worstR,
      score_promedio: k.avgScore,
      pct_contra_tendencia: Math.round(k.contraPct * 100),
      pct_respeto_r: Math.round(k.respectedRPct * 100),
      ejecucion_promedio: ratings.length ? r2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
    },
    por_score: [bucket('80-100 (A+)', (s) => s >= 80), bucket('60-79 (aceptable)', (s) => s >= 60 && s < 80), bucket('0-59 (no operar)', (s) => s < 60)],
    por_setup: bySetup(trades).map((b) => ({ setup: b.label, trades: b.count, r_neto: b.netR })),
    por_estado: byState(trades).map((b) => ({ estado: b.label, trades: b.count, r_neto: b.netR })),
    por_hora_et: byTime(trades).map((b) => ({ hora: b.label, trades: b.count, r_neto: b.netR, tiempo_de_reversa: b.reversal })),
    por_emocion: byEmotion(trades).map((b) => ({ emocion: b.label, trades: b.count, r_neto: b.netR })),
    errores: topErrors(trades, 10).map((e) => ({ error: e.text, veces: e.count, r_neto: e.netR })),
    reglas_rotas_al_registrar: [...flagCount.entries()].map(([f, n]) => ({
      regla: CRITICAL_TEXT[f] ? dt(CRITICAL_TEXT[f], 'long') : f,
      veces: n,
    })),
    hallazgos_automaticos: insights(trades).map((i) => i.text),
    trades: closed.slice(-MAX_TRADES_SENT).map(({ t, r }) => ({
      setup: dt(SETUP_BY_ID[t.setup]?.short ?? t.setup, t.direction),
      direccion: t.direction === 'long' ? 'compra' : 'venta',
      instrumento: t.instrument === 'option' ? (t.direction === 'long' ? 'call' : 'put') : 'accion',
      tendencia: t.trend_type,
      estado: t.ma_state,
      hora_et: fmtMinutes(minutesInET(new Date(t.opened_at))),
      score: t.quality_score,
      veredicto: t.verdict,
      reglas_rotas: t.critical_flags,
      r: r2(r),
      emocion: t.review?.emotion ?? null,
      ejecucion: t.review?.execution_rating ?? null,
      errores: (t.review?.errors ?? []).map((e) => ERROR_TEXT[e] ?? e),
    })),
  };
}
