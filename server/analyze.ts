/**
 * Endpoint "Analizar mi semana". Corre SOLO en el servidor: aquí vive la llave de Anthropic.
 * Usa la Fetch API estándar (Request -> Response) para funcionar en Vite (dev) y en Vercel.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { RULES } from '../src/domain/rules';
import { SETUPS } from '../src/domain/setups';
import { dt } from '../src/domain/types';

export interface AnalyzeEnv {
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const RULE_IDS = Object.keys(RULES) as [string, ...string[]];

export const ReportSchema = z.object({
  resumen: z.string().describe('1 o 2 frases simples sobre cómo fue la semana, con el resultado en R.'),
  fortalezas: z
    .array(z.object({ titulo: z.string(), detalle: z.string() }))
    .describe('Exactamente 3 cosas que el trader hizo bien, con evidencia de sus números.'),
  errores: z
    .array(
      z.object({
        titulo: z.string(),
        evidencia: z.string().describe('Qué muestran sus números (veces, R perdido).'),
        que_hacer: z.string().describe('Acción concreta para la próxima semana.'),
        regla_id: z.enum(RULE_IDS).describe('Tarjeta de regla del manual relacionada.'),
      }),
    )
    .describe('Exactamente 3 errores prioritarios, del que más R le cuesta al que menos.'),
  regla_semana: z.object({
    regla_id: z.enum(RULE_IDS),
    titulo: z.string(),
    por_que: z.string(),
    como_aplicarla: z.string().describe('Cómo aplicarla en la checklist, en una o dos frases.'),
  }),
});
export type AiReport = z.infer<typeof ReportSchema>;

/** Conocimiento del método, armado con las mismas tarjetas que usa la app. */
function methodKnowledge(): string {
  const rules = Object.entries(RULES)
    .map(([id, r]) => `- [${id}] ${r.title}: ${dt(r.body, 'long')}`)
    .join('\n');
  const setups = SETUPS.map(
    (s) =>
      `- ${dt(s.label, 'long')} / ${dt(s.label, 'short')}: ${s.criteria.map((c) => dt(c.text, 'long') + (c.optional ? ' (opcional)' : '')).join('; ')}` +
      `${s.continuation ? ' [continuación]' : ''}${s.climactic ? ' [climático]' : ''}`,
  ).join('\n');
  return `REGLAS (id entre corchetes):\n${rules}\n\nSETUPS (criterios en versión compra; en venta se invierten):\n${setups}`;
}

const SYSTEM = `Eres un coach de trading que enseña exclusivamente el Método Oliver Velez (iFundTraders). Analizas la semana de un day trader principiante-intermedio que opera acciones en gráficos de 1, 2 y 5 minutos.

Recibirás sus estadísticas de la semana en JSON. Todo está medido en R (1R = lo que arriesga por trade). El "score" (0-100) es el puntaje de su checklist pre-trade: ≥80 es A+, 60-79 aceptable, <60 o reglas críticas rotas = no debió operar.

Cómo responder:
- Escribe en español de México, simple y directo, como le hablarías a alguien que no es experto. Explica cualquier término del método que uses.
- Cada fortaleza y cada error debe apoyarse en un número de sus datos (veces, R, %). Nada de frases motivacionales vacías.
- Ordena los errores por cuánto R le cuestan. Si hay pocos datos para algo, dilo en vez de inventar.
- "regla_id" debe ser uno de los ids de la lista de reglas; elige la tarjeta que mejor explica el error.
- La "regla de la semana" es UNA sola regla del método en la que debe enfocarse la próxima semana: la que más R le ahorraría.
- Si no hay suficientes fortalezas o errores reales, usa los más relevantes que haya, pero no inventes datos.

${methodKnowledge()}`;

const BodySchema = z.object({
  stats: z
    .object({
      semana: z.string().max(40),
      kpis: z.object({ cerrados: z.number().int().min(1) }).passthrough(),
    })
    .passthrough(),
});

const MAX_BODY = 120_000;

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function verifyUser(req: Request, env: AnalyzeEnv): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth },
  });
  return res.ok;
}

export async function handleAnalyze(req: Request, env: AnalyzeEnv): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Usa POST.' });
  if (!env.ANTHROPIC_API_KEY) return json(503, { error: 'El análisis con IA no está configurado en el servidor (falta ANTHROPIC_API_KEY).' });

  if (!(await verifyUser(req, env))) return json(401, { error: 'Inicia sesión para usar el análisis.' });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'Demasiados datos.' });
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(raw));
  } catch {
    return json(400, { error: 'Datos inválidos.' });
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000 });
  try {
    const msg = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ReportSchema) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Estas son mis estadísticas de la semana ${body.stats.semana}. Dame mis 3 fortalezas, mis 3 errores prioritarios y la regla en la que debo enfocarme.\n\n${JSON.stringify(body.stats)}`,
        },
      ],
    });

    if (msg.stop_reason === 'refusal') return json(502, { error: 'La IA no pudo analizar esta semana. Intenta de nuevo más tarde.' });
    if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) return json(502, { error: 'La respuesta de la IA llegó incompleta. Intenta de nuevo.' });

    const report = msg.parsed_output;
    return json(200, {
      report: { ...report, fortalezas: report.fortalezas.slice(0, 3), errores: report.errores.slice(0, 3) },
      model: msg.model,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json(503, { error: 'La llave de la IA en el servidor no es válida.' });
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: 'Demasiadas solicitudes. Espera un minuto y vuelve a intentar.' });
    if (err instanceof Anthropic.APIConnectionError) return json(503, { error: 'No se pudo conectar con la IA. Intenta de nuevo.' });
    if (err instanceof Anthropic.APIError) return json(502, { error: `Error de la IA (${err.status}). Intenta de nuevo.` });
    console.error('[analyze]', err);
    return json(500, { error: 'Error inesperado del servidor.' });
  }
}
