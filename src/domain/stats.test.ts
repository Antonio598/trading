import { describe, expect, it } from 'vitest';
import { insights } from './insights';
import { applyFilters, byState, bySetup, byTime, equityCurve, inPeriod, kpis, topErrors } from './stats';
import { EMPTY_CHECKLIST, type MaState, type SetupId, type TradeRecord, type TrendType } from './types';

let seq = 0;
/** etHour en hora de NY durante horario estándar (UTC-5). Día base: martes 10-nov-2026. */
function trade(o: {
  r: number;
  score?: number;
  setup?: SetupId;
  state?: MaState;
  trend?: TrendType;
  etMin?: number;
  day?: number;
  errors?: string[];
  flags?: string[];
  risk?: number;
  emotion?: TradeRecord['review'] extends infer R ? (R extends { emotion: infer E } ? E : never) : never;
}): TradeRecord {
  const id = `t${++seq}`;
  const etMin = o.etMin ?? 600;
  const opened = new Date(Date.UTC(2026, 10, o.day ?? 10, 5 + Math.floor(etMin / 60), etMin % 60)).toISOString();
  return {
    id,
    client_id: id,
    created_at: opened,
    symbol: 'X',
    direction: 'long',
    timeframe: 5,
    setup: o.setup ?? 'velez',
    trend_type: o.trend ?? 'poder',
    ma_state: o.state ?? 'neutral',
    state_transition: false,
    entry: 100,
    stop: 99.5,
    stop_type: 'evento',
    shares: 100,
    risk_usd: o.risk ?? 50,
    r_value: 50,
    t1: null,
    t2: null,
    t3: null,
    trailing_method: 'vela',
    checklist_json: EMPTY_CHECKLIST,
    quality_score: o.score ?? 70,
    verdict: 'aceptable',
    critical_flags: o.flags ?? [],
    status: 'closed',
    opened_at: opened,
    closed_at: opened,
    exits: [
      { id: `${id}e`, client_id: `${id}e`, trade_id: id, created_at: opened, price: 100, shares: 100, reason: 'manual', pnl_usd: o.r * 50, r_result: o.r },
    ],
    review: { trade_id: id, emotion: o.emotion ?? null, execution_rating: 3, errors: o.errors ?? [], note: null, screenshot_url: null },
  };
}

describe('stats', () => {
  it('KPIs: winrate, R neto, expectativa, extremos', () => {
    const ts = [trade({ r: 2 }), trade({ r: -1 }), trade({ r: -1.2 }), trade({ r: 1.5 })];
    const k = kpis(ts);
    expect(k.closed).toBe(4);
    expect(k.winRate).toBe(0.5);
    expect(k.netR).toBe(1.3);
    expect(k.expectancy).toBe(0.33);
    expect(k.bestR).toBe(2);
    expect(k.worstR).toBe(-1.2);
  });
  it('% contra tendencia y respeto de R', () => {
    const ts = [trade({ r: 1, trend: 'contra' }), trade({ r: 1 }), trade({ r: 1, risk: 80 }), trade({ r: 1, errors: ['mas_acciones'] })];
    const k = kpis(ts);
    expect(k.contraPct).toBe(0.25);
    expect(k.respectedRPct).toBe(0.5);
  });
  it('curva de equity acumulada', () => {
    const eq = equityCurve([trade({ r: 1 }), trade({ r: -0.5 }), trade({ r: 2 })]);
    expect(eq.map((p) => p.cum)).toEqual([1, 0.5, 2.5]);
  });
  it('agrupa por setup, estado y hora', () => {
    const ts = [
      trade({ r: 2, setup: 'velez', state: 'estrecho', etMin: 600 }),
      trade({ r: -1, setup: 'rompimiento', state: 'amplio', etMin: 690 }),
      trade({ r: 1, setup: 'velez', state: 'estrecho', etMin: 615 }),
    ];
    expect(bySetup(ts)[0]).toMatchObject({ key: 'velez', netR: 3, count: 2 });
    expect(byState(ts).map((s) => s.key)).toEqual(['estrecho', 'amplio']);
    const t = byTime(ts);
    expect(t[0]).toMatchObject({ label: '10:00', netR: 3, reversal: true });
    expect(t[1]).toMatchObject({ label: '11:30', reversal: true });
  });
  it('top errores con costo en R', () => {
    const ts = [trade({ r: -1, errors: ['tif'] }), trade({ r: -0.5, errors: ['tif', 'fomo'] }), trade({ r: 1 })];
    const e = topErrors(ts);
    expect(e[0]).toMatchObject({ id: 'tif', count: 2, netR: -1.5 });
  });
  it('filtros por periodo (semana desde el lunes ET)', () => {
    const now = new Date(Date.UTC(2026, 10, 12, 18)); // jueves 12-nov
    expect(inPeriod(new Date(Date.UTC(2026, 10, 9, 15)).toISOString(), 'semana', now)).toBe(true); // lunes 9
    expect(inPeriod(new Date(Date.UTC(2026, 10, 6, 15)).toISOString(), 'semana', now)).toBe(false); // viernes 6
    expect(inPeriod(new Date(Date.UTC(2026, 10, 12, 15)).toISOString(), 'hoy', now)).toBe(true);
    const ts = [trade({ r: 1, day: 9 }), trade({ r: 1, day: 2 })];
    expect(applyFilters(ts, { period: 'semana', setup: 'all', direction: 'all' }, now)).toHaveLength(1);
  });
});

describe('insights', () => {
  it('genera los insights clave con su regla', () => {
    const ts = [
      trade({ r: 2, score: 90, state: 'estrecho', etMin: 600 }),
      trade({ r: 1.5, score: 85, state: 'estrecho', etMin: 630 }),
      trade({ r: -1, score: 50, state: 'amplio', etMin: 720, errors: ['tif'], flags: ['tif_roto'], trend: 'contra', setup: 'climatico' }),
      trade({ r: -1.2, score: 40, state: 'amplio', etMin: 750, errors: ['tif'], flags: ['tif_roto'], trend: 'contra', setup: 'climatico' }),
      trade({ r: 0.5, score: 70, etMin: 900 }),
    ];
    const ins = insights(ts);
    const ids = ins.map((i) => i.id);
    expect(ids).toContain('score');
    expect(ids).toContain('criticas');
    expect(ids).toContain('error-tif');
    expect(ids).toContain('contra');
    expect(ids).toContain('estado');
    expect(ids).toContain('mediodia');
    expect(ids).toContain('setups');
    const tif = ins.find((i) => i.id === 'error-tif')!;
    expect(tif.text).toContain('2 veces');
    expect(tif.text).toContain('−2.20 R');
    expect(tif.rule).toBe('tif');
    expect(ins.find((i) => i.id === 'contra')!.text).toContain('40%');
  });
  it('sin trades cerrados no hay insights', () => {
    expect(insights([])).toEqual([]);
  });
});
