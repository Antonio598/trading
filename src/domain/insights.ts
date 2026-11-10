import { SETUP_BY_ID } from './setups';
import { bySetup, byState, byEmotion, closedTrades, kpis, topErrors, type ClosedTrade } from './stats';
import { minutesInET, reversalAt } from './time';
import { dt, type TradeRecord } from './types';

export interface Insight {
  id: string;
  tone: 'bull' | 'bear' | 'warn' | 'info';
  text: string;
  /** Tarjeta de regla del manual relacionada. */
  rule?: string;
  /** Orden: mayor = más importante. */
  weight: number;
}

/** Mínimo de trades por grupo para emitir un insight comparativo. */
export const MIN_SAMPLE = 2;

const ERROR_RULE: Record<string, string> = {
  contra_20_no_climatico: 'con20',
  lateral_con_tendencia: 'tendencia',
  ignore_marco_mayor: 'marcoMayor',
  persegui_precio: 'con20',
  sin_senal_reversa: 'senalReversa',
  sin_segunda_vela: 'ley2',
  frente_sr: 'ubicacion',
  tif: 'tif',
  entrada_tarde: 'entradaCentavo',
  stop_mal_lugar: 'stop',
  movi_stop: 'stop',
  sin_stop: 'stop',
  mas_acciones: 'r',
  supere_mlpt: 'mlpt',
  supere_perdida_diaria: 'mlpt',
  limite_trades: 'r',
  trailing_pronto: 'trailing',
  sali_antes_t1: 'objetivos',
  sin_parciales: 'objetivos',
  sin_break_even: 'trailing',
  ignore_salida: 'salidas',
};

const fR = (r: number) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)} R`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const n = (k: number) => `${k} trade${k === 1 ? '' : 's'}`;

function compare(
  a: ClosedTrade[],
  b: ClosedTrade[],
  build: (ra: number, rb: number) => Omit<Insight, 'weight'> | null,
  weight: number,
): Insight | null {
  if (a.length < MIN_SAMPLE || b.length < MIN_SAMPLE) return null;
  const res = build(avg(a.map((x) => x.r)), avg(b.map((x) => x.r)));
  return res ? { ...res, weight } : null;
}

export function insights(trades: TradeRecord[]): Insight[] {
  const out: (Insight | null)[] = [];
  const c = closedTrades(trades);
  if (c.length === 0) return [];

  // 1. Score alto vs bajo
  out.push(
    compare(
      c.filter((x) => x.t.quality_score >= 80),
      c.filter((x) => x.t.quality_score < 60),
      (hi, lo) => ({
        id: 'score',
        tone: hi > lo ? 'info' : 'warn',
        text:
          hi > lo
            ? `Tus trades con score ≥ 80 promedian ${fR(hi)}; los de score < 60 promedian ${fR(lo)}. La checklist funciona: respétala.`
            : `Tus trades con score ≥ 80 promedian ${fR(hi)} y los de score < 60 ${fR(lo)}: revisa si estás marcando las casillas con honestidad.`,
        rule: 'score',
      }),
      80,
    ),
  );

  // 2. Reglas críticas rotas al registrar
  out.push(
    compare(
      c.filter((x) => x.t.critical_flags.length > 0),
      c.filter((x) => x.t.critical_flags.length === 0),
      (broken, clean) => ({
        id: 'criticas',
        tone: broken < clean ? 'bear' : 'warn',
        text: `Operando con reglas críticas rotas promedias ${fR(broken)} por trade; sin romperlas, ${fR(clean)}. (${n(
          c.filter((x) => x.t.critical_flags.length > 0).length,
        )} con "NO OPERAR").`,
        rule: 'senalReversa',
      }),
      95,
    ),
  );

  // 3. Errores más costosos
  for (const [i, e] of topErrors(trades, 3).entries()) {
    if (e.netR >= 0 && i > 0) continue;
    out.push({
      id: `error-${e.id}`,
      tone: e.netR < 0 ? 'bear' : 'warn',
      text:
        e.netR < 0
          ? `El error "${e.text.replace(/\.$/, '')}" apareció ${e.count} ${e.count === 1 ? 'vez' : 'veces'} y te costó ${fR(e.netR)}.`
          : `El error "${e.text.replace(/\.$/, '')}" apareció ${e.count} ${e.count === 1 ? 'vez' : 'veces'} (${fR(e.netR)} en esos trades). Aunque ganes, es un hábito que te va a costar.`,
      rule: ERROR_RULE[e.id],
      weight: 90 - i * 5 + Math.min(10, e.count),
    });
  }

  // 4. Mejor y peor setup
  const setups = bySetup(trades).filter((s) => s.count >= MIN_SAMPLE);
  if (setups.length >= 2) {
    const best = setups[0];
    const worst = setups[setups.length - 1];
    const name = (key: string) => dt(SETUP_BY_ID[key as keyof typeof SETUP_BY_ID].label, 'long');
    out.push({
      id: 'setups',
      tone: worst.netR < 0 ? 'warn' : 'info',
      text: `Tu mejor setup es ${best.label} (${fR(best.netR)} en ${n(best.count)}). Tu peor setup es ${worst.label} (${fR(worst.netR)} en ${n(
        worst.count,
      )})${worst.netR < 0 ? `: deja de operar ${name(worst.key).split(' · ')[0]} hasta repasarlo.` : '.'}`,
      weight: 70,
    });
  }

  // 5. Contra tendencia
  const k = kpis(trades);
  if (trades.length >= 5 && k.contraPct > 0.1) {
    out.push({
      id: 'contra',
      tone: 'bear',
      text: `El ${Math.round(k.contraPct * 100)}% de tus trades fueron contra tendencia; el manual dice que no debe pasar del 10%.`,
      rule: 'con20',
      weight: 85,
    });
  }

  // 6. Respeto de la R
  if (trades.length >= 3 && k.respectedRPct < 1) {
    out.push({
      id: 'r',
      tone: 'warn',
      text: `Solo el ${Math.round(k.respectedRPct * 100)}% de tus trades respetaron tu R. Sin R constante, tus estadísticas no significan nada.`,
      rule: 'r',
      weight: 75,
    });
  }

  // 7. Mediodía (11:15 a 2:15)
  const isMidday = (x: ClosedTrade) => {
    const m = minutesInET(new Date(x.t.opened_at));
    return m >= 11 * 60 + 15 && m < 14 * 60 + 15;
  };
  out.push(
    compare(c.filter(isMidday), c.filter((x) => !isMidday(x)), (mid, rest) =>
      mid < rest && mid < 0
        ? {
            id: 'mediodia',
            tone: 'warn',
            text: `Pierdes más entre las 11:15 y las 2:15 (inactividad del mediodía): promedias ${fR(mid)} contra ${fR(rest)} el resto del día.`,
            rule: 'tiempos',
          }
        : null,
    65),
  );

  // 8. Tiempos de reversa
  const inRev = (x: ClosedTrade) => !!reversalAt(minutesInET(new Date(x.t.opened_at)));
  out.push(
    compare(c.filter(inRev), c.filter((x) => !inRev(x)), (rev, other) =>
      Math.abs(rev - other) >= 0.25
        ? {
            id: 'reversa',
            tone: rev > other ? 'info' : 'warn',
            text: `Entrando en un tiempo de reversa promedias ${fR(rev)}; fuera de ellos, ${fR(other)}.`,
            rule: 'tiempos',
          }
        : null,
    55),
  );

  // 9. Estado de las medias
  const st = byState(trades);
  const est = st.find((s) => s.key === 'estrecho');
  const amp = st.find((s) => s.key === 'amplio');
  if (est && amp && est.count >= MIN_SAMPLE && amp.count >= MIN_SAMPLE) {
    out.push({
      id: 'estado',
      tone: est.avgR > amp.avgR ? 'info' : 'warn',
      text: `En estado estrecho promedias ${fR(est.avgR)} por trade; en estado amplio, ${fR(amp.avgR)}.`,
      rule: 'estado',
      weight: 60,
    });
  }

  // 10. Emoción más costosa
  const worstEmotion = byEmotion(trades)
    .filter((e) => e.count >= MIN_SAMPLE && e.netR < 0)
    .sort((a, b) => a.netR - b.netR)[0];
  if (worstEmotion) {
    out.push({
      id: 'emocion',
      tone: 'bear',
      text: `Operando con ${worstEmotion.label.toLowerCase()} acumulas ${fR(worstEmotion.netR)} en ${n(worstEmotion.count)}.`,
      weight: 58,
    });
  }

  return out.filter((x): x is Insight => !!x).sort((a, b) => b.weight - a.weight);
}
