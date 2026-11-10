import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', async (orig) => {
  const real = await orig<typeof import('@anthropic-ai/sdk')>();
  class FakeAnthropic {
    static APIError = real.default.APIError;
    static AuthenticationError = real.default.AuthenticationError;
    static RateLimitError = real.default.RateLimitError;
    static APIConnectionError = real.default.APIConnectionError;
    beta = { messages: { parse } };
  }
  return { ...real, default: FakeAnthropic };
});

const { handleAnalyze } = await import('./analyze');

const env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'http://supa', SUPABASE_ANON_KEY: 'anon' };
const stats = { semana: '2026-11-09', kpis: { cerrados: 4, r_neto: -1.5 } };
const report = {
  resumen: 'Semana negativa: −1.5R.',
  fortalezas: [1, 2, 3, 4].map((i) => ({ titulo: `F${i}`, detalle: 'd' })),
  errores: [1, 2, 3].map((i) => ({ titulo: `E${i}`, evidencia: 'x', que_hacer: 'y', regla_id: 'tif' })),
  regla_semana: { regla_id: 'senalReversa', titulo: 'Señal', por_que: 'p', como_aplicarla: 'c' },
};
const req = (body: unknown, auth = 'Bearer user-token', method = 'POST') =>
  new Request('http://x/api/analizar', {
    method,
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  parse.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) =>
      new Response('{}', { status: (init.headers as Record<string, string>).authorization === 'Bearer user-token' ? 200 : 401 }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/analizar', () => {
  it('rechaza sin llave, sin sesión o con datos inválidos', async () => {
    expect((await handleAnalyze(req({ stats }), { ...env, ANTHROPIC_API_KEY: undefined })).status).toBe(503);
    expect((await handleAnalyze(req({ stats }, 'Bearer otro'), env)).status).toBe(401);
    expect((await handleAnalyze(req({ stats }, ''), env)).status).toBe(401);
    expect((await handleAnalyze(req({ nada: 1 }), env)).status).toBe(400);
    expect((await handleAnalyze(req({ stats: { ...stats, kpis: { cerrados: 0 } } }), env)).status).toBe(400);
    expect((await handleAnalyze(req(null, 'Bearer user-token', 'GET'), env)).status).toBe(405);
    expect(parse).not.toHaveBeenCalled();
  });

  it('llama a Claude con el modelo, respaldo y formato correctos y recorta a 3', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: report, model: 'claude-opus-5-5' });
    const res = await handleAnalyze(req({ stats }), env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report.fortalezas).toHaveLength(3);
    expect(data.report.regla_semana.regla_id).toBe('senalReversa');

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toContain('server-side-fallback-2026-07-01');
    expect(params.output_config.effort).toBe('medium');
    expect(params.system).toContain('[senalReversa]');
    expect(params.system).toContain('VBS');
    expect(params.messages[0].content).toContain('"r_neto":-1.5');
  });

  it('maneja negativa e respuesta incompleta', async () => {
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    expect((await handleAnalyze(req({ stats }), env)).status).toBe(502);
    parse.mockResolvedValue({ stop_reason: 'max_tokens', parsed_output: null });
    expect((await handleAnalyze(req({ stats }), env)).status).toBe(502);
  });
});
