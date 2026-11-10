import { ERROR_TEXT } from './errors';
import { CRITICAL_TEXT } from './rules';
import { totals } from './risk';
import { SETUP_BY_ID } from './setups';
import { EMOTION_LABEL } from './stats';
import { dt, type ExitReason, type TradeRecord } from './types';

const REASON: Record<ExitReason, string> = {
  t1: 'T1',
  t2: 'T2',
  t3: 'T3',
  trailing: 'Trailing',
  stop: 'Stop inicial',
  break_even: 'Break even',
  manual: 'Manual',
  fin_dia: 'Fin del día',
};
const VERDICT = { aplus: 'A+', aceptable: 'Aceptable', no_operar: 'No operar' } as const;
const TREND = { regular: 'Regular', poder: 'De Poder', super: 'Súper Tendencia', lateral: 'Lateral', contra: 'Contra tendencia' } as const;

function etParts(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

/** Escapa un valor para CSV (RFC 4180) y neutraliza fórmulas al abrir en Excel. */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADERS = [
  'Fecha (NY)',
  'Hora entrada (NY)',
  'Acción',
  'Dirección',
  'Gráfico (min)',
  'Setup',
  'Tendencia',
  'Estado líneas',
  'Transición',
  'Entrada',
  'Stop',
  'Tipo de stop',
  'Acciones',
  'Riesgo USD',
  'R del plan',
  'Score',
  'Veredicto',
  'Reglas rotas',
  'Estatus',
  'Precio salida promedio',
  'Motivos de salida',
  'P&L USD',
  'Resultado R',
  'Emoción',
  'Ejecución (1-5)',
  'Errores',
  'Nota',
];

export function tradesToCsv(trades: TradeRecord[]): string {
  const rows = [...trades]
    .sort((a, b) => a.opened_at.localeCompare(b.opened_at))
    .map((t) => {
      const { date, time } = etParts(t.opened_at);
      const { pnl, r } = totals(t.exits);
      const sh = t.exits.reduce((a, e) => a + e.shares, 0);
      const avgExit = sh ? t.exits.reduce((a, e) => a + Number(e.price) * e.shares, 0) / sh : null;
      const closed = t.status === 'closed';
      return [
        date,
        time,
        t.symbol,
        t.direction === 'long' ? 'Compra' : 'Venta',
        t.timeframe,
        dt(SETUP_BY_ID[t.setup]?.short ?? t.setup, t.direction),
        TREND[t.trend_type],
        t.ma_state,
        t.state_transition ? 'Sí' : 'No',
        t.entry,
        t.stop,
        t.stop_type,
        t.shares,
        t.risk_usd,
        t.r_value,
        t.quality_score,
        VERDICT[t.verdict],
        t.critical_flags.map((f) => (CRITICAL_TEXT[f] ? dt(CRITICAL_TEXT[f], t.direction) : f)).join(' | '),
        closed ? 'Cerrado' : 'Abierto',
        avgExit == null ? '' : avgExit.toFixed(4),
        t.exits.map((e) => `${REASON[e.reason]} (${e.shares})`).join(' | '),
        sh ? pnl.toFixed(2) : '',
        sh ? r.toFixed(2) : '',
        t.review?.emotion ? EMOTION_LABEL[t.review.emotion] : '',
        t.review?.execution_rating ?? '',
        (t.review?.errors ?? []).map((e) => ERROR_TEXT[e] ?? e).join(' | '),
        t.review?.note ?? '',
      ];
    });
  // BOM para que Excel lea bien los acentos.
  return '﻿' + [CSV_HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
