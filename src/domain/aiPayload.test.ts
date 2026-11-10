import { describe, expect, it } from 'vitest';
import { buildWeeklyStats } from './aiPayload';
import { EMPTY_CHECKLIST, type TradeRecord } from './types';

function t(id: string, r: number, extra: Partial<TradeRecord> = {}): TradeRecord {
  const at = '2026-11-10T15:05:00.000Z';
  return {
    id, client_id: id, user_id: 'user-secret-uuid', created_at: at, symbol: 'SECRETSYM', direction: 'long', timeframe: 5,
    setup: 'velez', trend_type: 'poder', ma_state: 'estrecho', state_transition: false, entry: 123.45, stop: 122.95,
    stop_type: 'evento', shares: 100, risk_usd: 50, r_value: 50, t1: null, t2: null, t3: null, trailing_method: 'vela',
    checklist_json: EMPTY_CHECKLIST, quality_score: 85, verdict: 'aplus', critical_flags: ['tif_roto'], status: 'closed',
    opened_at: at, closed_at: at,
    exits: [{ id: id + 'e', client_id: id + 'e', trade_id: id, created_at: at, price: 124, shares: 100, reason: 't1', pnl_usd: 9876.54, r_result: r }],
    review: { trade_id: id, emotion: 'fomo', execution_rating: 2, errors: ['tif'], note: 'mi nota privada', screenshot_url: 'user-secret-uuid/x.jpg' },
    ...extra,
  };
}

describe('resumen para la IA', () => {
  const s = buildWeeklyStats([t('a', 1.5), t('b', -1), t('c', 0.5)], '2026-11-09');
  const json = JSON.stringify(s);

  it('no incluye datos personales ni montos en dólares', () => {
    for (const secret of ['SECRETSYM', 'user-secret-uuid', 'mi nota privada', '9876', '123.45', 'x.jpg']) {
      expect(json).not.toContain(secret);
    }
  });
  it('incluye lo necesario en R', () => {
    expect(s.kpis).toMatchObject({ cerrados: 3, r_neto: 1, pct_ganadores: 67, ejecucion_promedio: 2 });
    expect(s.trades[0]).toMatchObject({ setup: 'VBS', hora_et: '10:05', emocion: 'fomo', r: 1.5 });
    expect(s.errores[0]).toMatchObject({ veces: 3, r_neto: 1 });
    expect(s.reglas_rotas_al_registrar[0].veces).toBe(3);
    expect(s.por_score[0]).toMatchObject({ trades: 3 });
  });
});
