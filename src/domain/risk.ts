import type { Direction, ExitRow, Profile } from './types';

export const MIN_LOT = 100;

export interface RiskCalc {
  valid: boolean;
  /** Stop del lado correcto de la entrada. */
  stopSideOk: boolean;
  riskPerShare: number;
  shares: number;
  capital: number;
  riskUsd: number;
  /** Con 100 acciones ya se supera la R. */
  fitsR: boolean;
  exceedsAccount: boolean;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function calcRisk(
  entry: number | null,
  stop: number | null,
  direction: Direction,
  r: number,
  accountSize: number,
): RiskCalc {
  const empty: RiskCalc = {
    valid: false,
    stopSideOk: true,
    riskPerShare: 0,
    shares: 0,
    capital: 0,
    riskUsd: 0,
    fitsR: true,
    exceedsAccount: false,
  };
  if (entry == null || stop == null || !(entry > 0) || !(stop > 0)) return empty;
  const stopSideOk = direction === 'long' ? stop < entry : stop > entry;
  const riskPerShare = round(Math.abs(entry - stop), 4);
  if (!stopSideOk || riskPerShare === 0 || !(r > 0)) return { ...empty, stopSideOk };
  // Pequeño epsilon para evitar errores de coma flotante (50 / 0.5 = 99.999…)
  const shares = Math.floor(r / riskPerShare + 1e-9);
  const capital = round(shares * entry);
  return {
    valid: true,
    stopSideOk,
    riskPerShare,
    shares,
    capital,
    riskUsd: round(shares * riskPerShare),
    fitsR: riskPerShare * MIN_LOT <= r + 1e-9,
    exceedsAccount: accountSize > 0 && capital > accountSize,
  };
}

export interface Targets {
  t1: number;
  t2: number;
  t3: number;
}

/**
 * Objetivos VBS/VSS: pivot = extremo previo (máximo en largos, mínimo en cortos);
 * extreme = extremo del retroceso. T1 = 50% del retroceso, T2 = pivote, T3 = más allá del pivote.
 */
export function calcTargets(pivot: number | null, extreme: number | null): Targets | null {
  if (pivot == null || extreme == null || !(pivot > 0) || !(extreme > 0) || pivot === extreme) return null;
  const range = pivot - extreme;
  return {
    t1: round(extreme + range * 0.5, 4),
    t2: round(pivot, 4),
    t3: round(pivot + range * 0.5, 4),
  };
}

/** Ratio recompensa/riesgo hacia un objetivo; null si el objetivo no está del lado de la ganancia. */
export function rewardRatio(entry: number, target: number, riskPerShare: number, dir: Direction): number | null {
  if (!(riskPerShare > 0)) return null;
  const reward = dir === 'long' ? target - entry : entry - target;
  if (reward <= 0) return null;
  return round(reward / riskPerShare, 2);
}

export function exitPnl(entry: number, price: number, shares: number, dir: Direction): number {
  const sign = dir === 'long' ? 1 : -1;
  return round((price - entry) * shares * sign);
}

export function toR(pnl: number, r: number): number {
  return r > 0 ? round(pnl / r, 3) : 0;
}

export function sharesClosed(exits: Pick<ExitRow, 'shares'>[]): number {
  return exits.reduce((a, e) => a + e.shares, 0);
}

export function totals(exits: Pick<ExitRow, 'pnl_usd' | 'r_result'>[]) {
  return {
    pnl: round(exits.reduce((a, e) => a + Number(e.pnl_usd), 0)),
    r: round(exits.reduce((a, e) => a + Number(e.r_result), 0), 3),
  };
}

export type MlptStatus = 'ok' | 'bajo' | 'alto' | 'sin_datos';

/** El MLPT debe estar entre 25% y 50% de la pérdida máxima diaria. */
export function mlptStatus(p: Pick<Profile, 'mlpt' | 'max_daily_loss'>): MlptStatus {
  if (!(p.mlpt > 0) || !(p.max_daily_loss > 0)) return 'sin_datos';
  const pct = p.mlpt / p.max_daily_loss;
  if (pct < 0.25 - 1e-9) return 'bajo';
  if (pct > 0.5 + 1e-9) return 'alto';
  return 'ok';
}
