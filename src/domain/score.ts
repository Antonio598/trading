import { calcRisk, type RiskCalc } from './risk';
import { CRITICAL_TEXT, TIF_RULE, WARN_AMPLIO, WARN_CONTRA, WARN_LATERAL } from './rules';
import { SETUP_BY_ID } from './setups';
import { REVERSAL_TIMES } from './time';
import { dt, type ChecklistState, type Profile, type Verdict } from './types';

export interface DayContext {
  tradesToday: number;
  /** P&L realizado hoy en USD (negativo = pérdida). */
  pnlToday: number;
}

export interface StepScore {
  earned: number;
  max: number;
}

export interface Notice {
  id: string;
  text: string;
}

export interface ScoreResult {
  score: number;
  steps: { contexto: StepScore; setup: StepScore; complementos: StepScore; ejecucion: StepScore };
  penalty: number;
  critical: Notice[];
  warnings: Notice[];
  verdict: Verdict;
  risk: RiskCalc;
  /** Datos mínimos para poder registrar el trade. */
  ready: boolean;
  missing: string[];
}

export const WEIGHTS = {
  chartOk: 3,
  masVisible: 2,
  trend: { super: 6, poder: 6, regular: 4, lateral: 2, contra: 1 },
  with20: 6,
  state: { estrecho: 10, neutral: 5, amplio: 0 },
  transition: 4,
  higherTf: 4,
  setupChosen: 5,
  criteria: 20,
  reversalSignal: 8,
  locationEach: 3,
  locationCap: 9,
  timeMajor: 6,
  timeMinor: 4,
  volume: 2,
  law3: 3,
  law5: 2,
  entryPenny: 4,
  stopType: 2,
  tif: 4,
  amplioContinuationPenalty: 10,
} as const;

export const CONTINUATION_PENALTY = WEIGHTS.amplioContinuationPenalty;

export function verdictFor(score: number, hasCritical: boolean): Verdict {
  if (hasCritical || score < 60) return 'no_operar';
  if (score >= 80) return 'aplus';
  return 'aceptable';
}

export function evaluate(c: ChecklistState, profile: Profile, day: DayContext): ScoreResult {
  const W = WEIGHTS;
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  const dir = c.direction;
  const critical: Notice[] = [];
  const warnings: Notice[] = [];
  const crit = (id: string) => critical.push({ id, text: dt(CRITICAL_TEXT[id], dir) });

  // ── Paso 1: contexto (35) ──
  let ctx = 0;
  if (c.chartOk) ctx += W.chartOk;
  if (c.masVisible) ctx += W.masVisible;
  if (c.trendType) {
    ctx += c.trendType === 'contra' && setup?.climactic ? 4 : W.trend[c.trendType];
  }
  // En climáticos, operar contra la pendiente de la 20mm es parte del setup.
  if (c.with20 || setup?.climactic) ctx += W.with20;
  if (c.maState) ctx += W.state[c.maState];
  if (c.transition) ctx += W.transition;
  if (c.higherTf) ctx += W.higherTf;
  const ctxMax = W.chartOk + W.masVisible + 6 + W.with20 + 10 + W.transition + W.higherTf;

  // ── Paso 2: setup (25) ──
  let st = 0;
  if (setup) {
    st += W.setupChosen;
    const required = setup.criteria.filter((k) => !k.optional);
    const met = required.filter((k) => c.criteria[k.id]).length;
    st += required.length ? (met / required.length) * W.criteria : W.criteria;
  }
  const stMax = W.setupChosen + W.criteria;

  // ── Paso 3: complementos (30) ──
  const reversal = c.reversalSignal || !!setup?.isSignal;
  let comp = 0;
  if (reversal) comp += W.reversalSignal;
  comp += Math.min(c.locations.length * W.locationEach, W.locationCap);
  if (c.reversalTime) comp += c.reversalTime === 'major' ? W.timeMajor : W.timeMinor;
  if (c.volume) comp += W.volume;
  if (c.law3) comp += W.law3;
  if (c.law5) comp += W.law5;
  const compMax = W.reversalSignal + W.locationCap + W.timeMajor + W.volume + W.law3 + W.law5;

  // ── Paso 4: ejecución (10) ──
  const tifRule = TIF_RULE[c.timeframe];
  const tifIgnored = !!setup?.tifIgnorable && c.extremeEliminated;
  const tifBroken = c.earlyEntry && !tifIgnored && (!tifRule.early || !c.tifOk);
  let ex = 0;
  if (c.entryPenny) ex += W.entryPenny;
  if (!(c.stopType === 'evento' && c.stopAt200)) ex += W.stopType;
  if (!tifBroken) ex += W.tif;
  const exMax = W.entryPenny + W.stopType + W.tif;

  // ── Penalizaciones ──
  let penalty = 0;
  if (c.maState === 'amplio' && setup?.continuation) penalty += W.amplioContinuationPenalty;

  const raw = ctx + st + comp + ex - penalty;
  const max = ctxMax + stMax + compMax + exMax;
  const score = Math.max(0, Math.min(100, Math.round((raw / max) * 100)));

  // ── Advertencias ──
  if (c.maState === 'amplio') {
    warnings.push({
      id: 'amplio',
      text: setup?.continuation ? `${WARN_AMPLIO} (−${W.amplioContinuationPenalty} puntos por ser setup de continuación)` : WARN_AMPLIO,
    });
  }
  if (c.trendType === 'lateral') warnings.push({ id: 'lateral', text: WARN_LATERAL });
  if (c.trendType === 'contra') warnings.push({ id: 'contra', text: WARN_CONTRA });
  if (c.stopType === 'evento' && c.stopAt200)
    warnings.push({ id: 'stop200', text: 'Tu stop por evento queda en la 200mm: considera usar el MLPT.' });

  // ── Riesgo y reglas críticas ──
  const risk = calcRisk(c.entry, c.stop, dir, profile.r_value, profile.account_size, c.instrument ?? 'stock');
  if (risk.exceedsAccount)
    warnings.push({
      id: 'capital',
      text: `El capital requerido ($${risk.capital.toLocaleString('en-US')}) supera tu cuenta.`,
    });

  if (!(profile.r_value > 0)) crit('sin_plan');
  if (c.trendType === 'contra' && setup && !setup.climactic) crit('contra_no_climatico');
  const afterPullback = !!setup?.pullback || c.law3;
  if (setup && afterPullback && !reversal) crit('sin_senal_reversa');
  if (c.entry != null && c.stop != null && !risk.stopSideOk) crit('stop_invalido');
  if (risk.valid && !risk.fitsR) crit('no_cabe_en_r');
  if (tifBroken) crit('tif_roto');
  if (profile.max_trades_day && day.tradesToday >= profile.max_trades_day) crit('limite_trades');
  if (profile.max_daily_loss > 0 && -day.pnlToday >= profile.max_daily_loss) crit('perdida_diaria');

  const missing: string[] = [];
  if (!c.symbol.trim()) missing.push('Símbolo');
  if (!c.trendType) missing.push('Tipo de tendencia');
  if (!c.maState) missing.push('Estado');
  if (!setup) missing.push('Setup');
  if (!risk.valid) missing.push('Entrada y stop');

  return {
    score,
    steps: {
      contexto: { earned: ctx, max: ctxMax },
      setup: { earned: Math.round(st), max: stMax },
      complementos: { earned: comp, max: compMax },
      ejecucion: { earned: ex, max: exMax },
    },
    penalty,
    critical,
    warnings,
    verdict: verdictFor(score, critical.length > 0),
    risk,
    ready: missing.length === 0,
    missing,
  };
}

/** Exporta los tiempos mayores para la UI. */
export const MAJOR_TIMES = REVERSAL_TIMES.filter((t) => t.major).map((t) => t.label);
