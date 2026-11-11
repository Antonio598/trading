import { useEffect, useState } from 'react';
import { ET_TZ, LOCAL_TZ, MARKET_CLOSE, MARKET_OPEN, REVERSAL_TIMES, formatClock, minutesInET, nextReversal, reversalAt } from '../../domain/time';
import { cx } from './primitives';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const span = MARKET_CLOSE - MARKET_OPEN;
const pct = (m: number) => `${(((m - MARKET_OPEN) / span) * 100).toFixed(2)}%`;

/** Hora de Nueva York + estado de reversa, en una pastilla compacta. */
export function ETClock() {
  const now = useNow();
  const mins = minutesInET(now);
  const active = reversalAt(mins);
  const next = nextReversal(mins);
  const open = mins >= MARKET_OPEN && mins < MARKET_CLOSE;

  const status = active
    ? { text: `Reversa ${active.label}${active.major ? ' (fuerte)' : ''}`, cls: active.major ? 'bg-bull/15 text-bull' : 'bg-accent/15 text-accent-soft' }
    : open && next
      ? { text: `Próxima reversa ${next.label}`, cls: 'bg-void-3 text-ink-dim' }
      : { text: open ? 'Sin reversas hoy' : 'Mercado cerrado', cls: 'bg-void-3 text-ink-dim' };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-num text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">{formatClock(now, ET_TZ)}</div>
          <div className="mt-1 whitespace-nowrap text-[12px] font-semibold text-ink-dim">
            Nueva York · <span className="font-num">{formatClock(now, LOCAL_TZ, false)}</span> en CDMX
          </div>
        </div>
        <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold', status.cls)} aria-live="polite">
          {active && <span className={cx('h-1.5 w-1.5 animate-pulse rounded-full', active.major ? 'bg-bull' : 'bg-accent')} />}
          {status.text}
        </span>
      </div>
      {/* Sesión 9:30–16:00 con las ventanas de reversa */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-void-3" aria-hidden>
        {open && <span className="absolute inset-y-0 left-0 bg-accent/25" style={{ width: pct(mins) }} />}
        {REVERSAL_TIMES.map((w) => (
          <span
            key={w.label}
            className={cx(
              'absolute top-0 h-full rounded-full',
              active?.label === w.label ? (w.major ? 'bg-bull' : 'bg-accent') : w.major ? 'bg-bull/45' : 'bg-ink-dim/35',
            )}
            style={{ left: pct(w.start - 2), width: `max(4px, ${(((w.end - w.start + 4) / span) * 100).toFixed(2)}%)` }}
          />
        ))}
      </div>
    </div>
  );
}
