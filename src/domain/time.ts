/** Utilidades de hora de Nueva York (ET) y tiempos de reversa del Método Velez. */

export interface ReversalWindow {
  label: string;
  start: number; // minutos desde medianoche ET
  end: number;
  major: boolean;
}

const hm = (h: number, m: number) => h * 60 + m;

export const REVERSAL_TIMES: ReversalWindow[] = [
  { label: '9:35', start: hm(9, 35), end: hm(9, 35), major: false },
  { label: '10:00', start: hm(10, 0), end: hm(10, 0), major: true },
  { label: '10:30', start: hm(10, 30), end: hm(10, 30), major: false },
  { label: '11:15–11:30', start: hm(11, 15), end: hm(11, 30), major: true },
  { label: '12:00', start: hm(12, 0), end: hm(12, 0), major: false },
  { label: '1:30', start: hm(13, 30), end: hm(13, 30), major: false },
  { label: '2:15–2:30', start: hm(14, 15), end: hm(14, 30), major: true },
  { label: '3:00', start: hm(15, 0), end: hm(15, 0), major: false },
  { label: '3:30', start: hm(15, 30), end: hm(15, 30), major: false },
];

export const MARKET_OPEN = hm(9, 30);
export const MARKET_CLOSE = hm(16, 0);
/** Tolerancia en minutos para considerar que estás "cerca" de un tiempo de reversa. */
export const REVERSAL_TOLERANCE = 3;

export function reversalAt(minutesET: number, tol = REVERSAL_TOLERANCE): ReversalWindow | null {
  return REVERSAL_TIMES.find((w) => minutesET >= w.start - tol && minutesET <= w.end + tol) ?? null;
}

export function nextReversal(minutesET: number): ReversalWindow | null {
  return REVERSAL_TIMES.find((w) => w.start > minutesET) ?? null;
}

function parts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    h: get('hour') % 24,
    mi: get('minute'),
    s: get('second'),
  };
}

export const ET_TZ = 'America/New_York';
export const LOCAL_TZ = 'America/Mexico_City';

export function minutesInET(date = new Date()): number {
  const p = parts(date, ET_TZ);
  return p.h * 60 + p.mi;
}

/** Clave de día de mercado (YYYY-MM-DD en ET). */
export function etDayKey(date: Date | string = new Date()): string {
  const p = parts(typeof date === 'string' ? new Date(date) : date, ET_TZ);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function formatClock(date: Date, timeZone: string, withSeconds = true): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(date);
}

/** Etiqueta 12h estilo trader ("2:15") para minutos ET. */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}`;
}
