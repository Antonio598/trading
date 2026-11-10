import type { AiReport } from '../../server/analyze';
import type { WeeklyStats } from '../domain/aiPayload';
import { supabase } from './supabase';

export type { AiReport };

export interface SavedReport {
  week: string;
  report: AiReport;
  generated_at: string;
  /** Trades cerrados que se analizaron (para saber si hay datos nuevos). */
  closed: number;
}

const KEY = 'vj-ai-reports';
const MAX_SAVED = 12;

export function loadReports(): Record<string, SavedReport> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveReport(r: SavedReport) {
  try {
    const all = loadReports();
    all[r.week] = r;
    const keep = Object.keys(all).sort().slice(-MAX_SAVED);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))));
  } catch {
    /* sin storage: el reporte solo vive en pantalla */
  }
}

export async function analyzeWeek(stats: WeeklyStats): Promise<SavedReport> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Inicia sesión para usar el análisis.');
  let res: Response;
  try {
    res = await fetch('/api/analizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ stats }),
    });
  } catch {
    throw new Error('Sin conexión. Conéctate a internet para analizar tu semana.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  const saved: SavedReport = { week: stats.semana, report: body.report, generated_at: body.generated_at, closed: stats.kpis.cerrados };
  saveReport(saved);
  return saved;
}
