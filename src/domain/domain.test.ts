import { describe, expect, it } from 'vitest';
import { calcRisk, calcTargets, exitPnl, mlptStatus, rewardRatio, toR } from './risk';
import { evaluate } from './score';
import { minutesInET, reversalAt, etDayKey } from './time';
import { EMPTY_CHECKLIST, type ChecklistState, type Profile } from './types';

const profile: Profile = {
  account_size: 25000,
  r_value: 50,
  max_daily_loss: 200,
  mlpt: 75,
  max_trades_day: 4,
  timeframes: [1, 2, 5],
  reduce_motion: false,
};
const day = { tradesToday: 0, pnlToday: 0 };

const perfectLong: ChecklistState = {
  ...EMPTY_CHECKLIST,
  symbol: 'AAPL',
  direction: 'long',
  timeframe: 5,
  chartOk: true,
  masVisible: true,
  trendType: 'poder',
  with20: true,
  maState: 'estrecho',
  transition: true,
  higherTf: true,
  setup: 'velez',
  criteria: { sobre20: true, retroceso: true },
  reversalSignal: true,
  locations: ['20mm', 'ret50', 'pivote'],
  reversalTime: 'major',
  volume: true,
  law3: true,
  law5: true,
  entry: 100.5,
  stop: 100.0,
  entryPenny: true,
};

describe('riesgo', () => {
  it('calcula acciones = floor(R / riesgo)', () => {
    const r = calcRisk(100.5, 100, 'long', 50, 25000);
    expect(r.riskPerShare).toBe(0.5);
    expect(r.shares).toBe(100);
    expect(r.fitsR).toBe(true);
    expect(r.capital).toBe(10050);
  });
  it('permite menos de 100 acciones; solo bloquea si ni 1 cabe en la R', () => {
    const r = calcRisk(50, 49, 'long', 50, 25000);
    expect(r.shares).toBe(50);
    expect(r.fitsR).toBe(true);
    const wide = calcRisk(200, 140, 'long', 50, 25000); // $60 por acción > R de $50
    expect(wide.shares).toBe(0);
    expect(wide.fitsR).toBe(false);
  });
  it('opciones: contratos = R ÷ (diferencia de prima × 100)', () => {
    const call = calcRisk(1.2, 0.8, 'long', 50, 25000, 'option'); // $40 de riesgo por contrato
    expect(call).toMatchObject({ riskPerShare: 40, shares: 1, riskUsd: 40, capital: 120, fitsR: true });
    // Put: también se compra, el stop va por DEBAJO de la prima aunque la dirección sea corta
    const put = calcRisk(0.5, 0.25, 'short', 100, 25000, 'option');
    expect(put).toMatchObject({ stopSideOk: true, shares: 4, riskUsd: 100, capital: 200 });
    expect(calcRisk(0.5, 0.7, 'short', 100, 25000, 'option').stopSideOk).toBe(false);
    // Arriesgar toda la prima (stop = 0)
    expect(calcRisk(0.3, 0, 'long', 100, 25000, 'option')).toMatchObject({ shares: 3, riskUsd: 90 });
    // Prima demasiado cara: ni 1 contrato cabe
    expect(calcRisk(3, 2, 'long', 50, 25000, 'option')).toMatchObject({ shares: 0, fitsR: false });
  });
  it('opciones: P&L de la salida × 100, siempre ganando si sube la prima', () => {
    expect(exitPnl(1.2, 1.8, 2, 'long', 'option')).toBe(120);
    expect(exitPnl(0.5, 0.75, 4, 'short', 'option')).toBe(100); // put
    expect(exitPnl(0.5, 0.3, 4, 'short', 'option')).toBe(-80);
    expect(toR(exitPnl(1.2, 0.8, 1, 'long', 'option'), 40)).toBe(-1);
  });
  it('stop del lado equivocado en cortos', () => {
    expect(calcRisk(50, 49, 'short', 50, 0).stopSideOk).toBe(false);
  });
  it('avisa si el capital supera la cuenta', () => {
    expect(calcRisk(300, 299.9, 'long', 50, 25000).exceedsAccount).toBe(true);
  });
  it('objetivos VBS y R:B', () => {
    const t = calcTargets(102, 100)!; // pivote 102, extremo del retroceso 100
    expect(t).toEqual({ t1: 101, t2: 102, t3: 103 });
    expect(rewardRatio(100.5, t.t1, 0.5, 'long')).toBe(1);
    const s = calcTargets(98, 100)!; // corto: pivote mínimo 98
    expect(s).toEqual({ t1: 99, t2: 98, t3: 97 });
  });
  it('P&L y resultado en R', () => {
    expect(exitPnl(100, 99.4, 100, 'long')).toBe(-60);
    expect(toR(-60, 50)).toBe(-1.2);
    expect(exitPnl(100, 99, 50, 'short')).toBe(50);
  });
  it('MLPT entre 25% y 50% de la pérdida diaria', () => {
    expect(mlptStatus({ mlpt: 75, max_daily_loss: 200 })).toBe('ok');
    expect(mlptStatus({ mlpt: 40, max_daily_loss: 200 })).toBe('bajo');
    expect(mlptStatus({ mlpt: 120, max_daily_loss: 200 })).toBe('alto');
    expect(mlptStatus({ mlpt: 50, max_daily_loss: 200 })).toBe('ok');
  });
});

describe('score', () => {
  it('setup perfecto = A+ con 100', () => {
    const r = evaluate(perfectLong, profile, day);
    expect(r.critical).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.verdict).toBe('aplus');
    expect(r.ready).toBe(true);
  });
  it('estado amplio + continuación resta 10 y advierte', () => {
    const r = evaluate({ ...perfectLong, maState: 'amplio' }, profile, day);
    expect(r.penalty).toBe(10);
    expect(r.score).toBe(80);
    expect(r.warnings.some((w) => w.id === 'amplio')).toBe(true);
  });
  it('sin señal de reversa tras retroceso = NO OPERAR', () => {
    const r = evaluate({ ...perfectLong, reversalSignal: false }, profile, day);
    expect(r.critical.map((c) => c.id)).toContain('sin_senal_reversa');
    expect(r.verdict).toBe('no_operar');
  });
  it('setups que son señal marcan la reversa automáticamente', () => {
    const r = evaluate(
      { ...perfectLong, setup: 'nrb', criteria: { tras35: true, rango: true }, reversalSignal: false },
      profile,
      day,
    );
    expect(r.critical).toEqual([]);
  });
  it('contra tendencia solo con climáticos', () => {
    const bad = evaluate({ ...perfectLong, trendType: 'contra' }, profile, day);
    expect(bad.critical.map((c) => c.id)).toContain('contra_no_climatico');
    const ok = evaluate(
      { ...perfectLong, trendType: 'contra', setup: 'climatico', criteria: { lejos: true, senal: true, tiempo: true } },
      profile,
      day,
    );
    expect(ok.critical).toEqual([]);
  });
  it('TIF: entrada temprana en 2 min es crítica, salvo cola con extremo eliminado', () => {
    const r = evaluate({ ...perfectLong, timeframe: 2, earlyEntry: true }, profile, day);
    expect(r.critical.map((c) => c.id)).toContain('tif_roto');
    const ok = evaluate(
      { ...perfectLong, timeframe: 2, earlyEntry: true, setup: 'cola', criteria: { tras35: true, cola: true }, extremeEliminated: true },
      profile,
      day,
    );
    expect(ok.critical).toEqual([]);
  });
  it('límite de trades y pérdida diaria bloquean', () => {
    const r = evaluate(perfectLong, profile, { tradesToday: 4, pnlToday: -200 });
    const ids = r.critical.map((c) => c.id);
    expect(ids).toContain('limite_trades');
    expect(ids).toContain('perdida_diaria');
  });
  it('semáforo amarillo entre 60 y 79', () => {
    const r = evaluate(
      { ...perfectLong, maState: 'neutral', transition: false, higherTf: false, locations: [], volume: false },
      profile,
      day,
    );
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.score).toBeLessThan(80);
    expect(r.verdict).toBe('aceptable');
  });
});

describe('tiempo ET', () => {
  it('detecta tiempos de reversa con tolerancia', () => {
    expect(reversalAt(600)?.label).toBe('10:00');
    expect(reversalAt(602)?.major).toBe(true);
    expect(reversalAt(680)?.label).toBe('11:15–11:30');
    expect(reversalAt(640)).toBeNull();
    expect(reversalAt(812)?.label).toBe('1:30');
  });
  it('convierte a hora de Nueva York', () => {
    // 14:30 UTC del 10-nov-2026 = 9:30 ET (horario estándar)
    const d = new Date(Date.UTC(2026, 10, 10, 14, 30));
    expect(minutesInET(d)).toBe(570);
    expect(etDayKey(d)).toBe('2026-11-10');
  });
});
