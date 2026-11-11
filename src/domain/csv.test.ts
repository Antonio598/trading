import { describe, expect, it } from 'vitest';
import { CSV_HEADERS, csvCell, tradesToCsv } from './csv';
import { searchLibrary } from './library';
import { EMPTY_CHECKLIST, type TradeRecord } from './types';

const trade: TradeRecord = {
  id: 'a',
  client_id: 'a',
  created_at: '2026-11-10T15:05:00.000Z',
  symbol: 'AAPL',
  direction: 'long',
  timeframe: 5,
  setup: 'velez',
  trend_type: 'poder',
  ma_state: 'estrecho',
  state_transition: true,
  entry: 100.5,
  stop: 100,
  stop_type: 'evento',
  shares: 100,
  risk_usd: 50,
  r_value: 50,
  t1: null,
  t2: null,
  t3: null,
  trailing_method: 'vela',
  checklist_json: EMPTY_CHECKLIST,
  quality_score: 88,
  verdict: 'aplus',
  critical_flags: [],
  status: 'closed',
  opened_at: '2026-11-10T15:05:00.000Z',
  closed_at: '2026-11-10T15:30:00.000Z',
  exits: [
    { id: 'e1', client_id: 'e1', trade_id: 'a', created_at: '', price: 101, shares: 50, reason: 't1', pnl_usd: 25, r_result: 0.5 },
    { id: 'e2', client_id: 'e2', trade_id: 'a', created_at: '', price: 102, shares: 50, reason: 't2', pnl_usd: 75, r_result: 1.5 },
  ],
  review: { trade_id: 'a', emotion: 'fomo', execution_rating: 4, errors: ['tif'], note: 'Entré, "rápido"', screenshot_url: null },
};

describe('CSV', () => {
  it('genera encabezados y una fila por trade, en hora de NY', () => {
    const csv = tradesToCsv([trade]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].split(',')).toHaveLength(CSV_HEADERS.length);
    expect(lines[1]).toContain('2026-11-10,10:05,AAPL,Compra,Acción,5,VBS');
    expect(lines[1]).toContain('101.5000'); // precio de salida promedio
    expect(lines[1]).toContain('100.00,2.00,FOMO,4');
    expect(lines[1]).toContain('"Entré, ""rápido"""');
  });
  it('neutraliza fórmulas pero no números negativos', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-1.20')).toBe('-1.20');
  });
});

describe('biblioteca', () => {
  it('busca sin acentos y por etiqueta de setup', () => {
    expect(searchLibrary('vss', 'short').flatMap((s) => s.cards.map((c) => c.id))).toContain('setup-velez');
    expect(searchLibrary('reversa', 'long').length).toBeGreaterThan(0);
    expect(searchLibrary('mlpt', 'long')[0].cards[0].id).toBe('mlpt');
    expect(searchLibrary('', 'long').length).toBe(7);
  });
});
