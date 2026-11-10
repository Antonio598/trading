// Función serverless para Vercel: POST /api/analizar
// Variables de entorno en Vercel: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
import { handleAnalyze } from '../server/analyze';

export const config = { maxDuration: 120 };

export function POST(request: Request): Promise<Response> {
  return handleAnalyze(request, {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
  });
}
