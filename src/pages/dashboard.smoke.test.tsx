import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Dashboard } from './Dashboard';
import { EMPTY_CHECKLIST } from '../domain/types';
import type { TradeRecord } from '../domain/types';

function t(i: number, r: number, extra: Partial<TradeRecord> = {}): TradeRecord {
  const opened = new Date(Date.now() - i * 3600_000).toISOString();
  const id = `s${i}`;
  return {
    id, client_id: id, created_at: opened, symbol: `SYM${i}`, direction: i % 2 ? 'long' : 'short', timeframe: 5,
    setup: i % 3 ? 'velez' : 'rompimiento', trend_type: i === 1 ? 'contra' : 'poder', ma_state: i % 2 ? 'estrecho' : 'amplio',
    state_transition: false, entry: 100, stop: 99.5, stop_type: 'evento', shares: 100, risk_usd: 50, r_value: 50,
    t1: null, t2: null, t3: null, trailing_method: 'vela', checklist_json: EMPTY_CHECKLIST, quality_score: 40 + i * 9,
    verdict: 'aceptable', critical_flags: i < 2 ? ['tif_roto'] : [], status: 'closed', opened_at: opened, closed_at: opened,
    exits: [{ id: `${id}e`, client_id: `${id}e`, trade_id: id, created_at: opened, price: 100, shares: 100, reason: 'manual', pnl_usd: r * 50, r_result: r }],
    review: { trade_id: id, emotion: i % 2 ? 'fomo' : 'tranquilo', execution_rating: 3, errors: i < 3 ? ['tif'] : [], note: null, screenshot_url: null },
    ...extra,
  };
}

const mock = vi.hoisted(() => ({ state: { trades: [] as TradeRecord[] } }));
vi.mock('../state/journal', () => ({ useJournal: (sel: (s: typeof mock.state & { online: boolean }) => unknown) => sel({ ...mock.state, online: true }) }));

describe('Dashboard (smoke)', () => {
  it('renderiza KPIs, insights y paneles sin errores', () => {
    try { localStorage.removeItem('vj-dash-filters'); } catch { /* node */ }
    mock.state.trades = [t(0, 2), t(1, -1), t(2, -1.2), t(3, 1.5), t(4, 0.4), t(5, -0.3)];
    const html = renderToString(<Dashboard />);
    for (const s of ['MI PROGRESO', 'Lo que debes saber', 'Tu avance', 'Tus errores más caros', 'No respeté el TIF', 'Ver estadísticas detalladas', 'Tu coach con IA']) {
      expect(html).toContain(s);
    }
  });
  it('estado vacío', () => {
    mock.state.trades = [];
    expect(renderToString(<Dashboard />)).toContain('Todavía no hay trades');
  });
});
