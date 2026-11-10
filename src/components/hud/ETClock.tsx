import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

export function ETClock() {
  const now = useNow();
  const mins = minutesInET(now);
  const active = reversalAt(mins);
  const next = nextReversal(mins);
  const open = mins >= MARKET_OPEN && mins < MARKET_CLOSE;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="hud-label !text-[10px]">NY</span>
          <span className="font-num text-xl font-bold text-ink">{formatClock(now, ET_TZ)}</span>
          <span className="font-num text-xs text-ink-dim">CDMX {formatClock(now, LOCAL_TZ, false)}</span>
        </div>
        <div className="text-right text-[11px] font-semibold" aria-live="polite">
          {active ? (
            <span className={cx('inline-flex items-center gap-1', active.major ? 'text-bull' : 'text-cyan-neon')}>
              <motion.span
                className={cx('inline-block h-2 w-2 rounded-full', active.major ? 'bg-bull' : 'bg-cyan-neon')}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              Reversa {active.label}
              {active.major && ' · mayor'}
            </span>
          ) : open && next ? (
            <span className="text-ink-dim">Próx. {next.label}</span>
          ) : (
            <span className="text-ink-dim">{open ? 'Sin tiempos' : 'Mercado cerrado'}</span>
          )}
        </div>
      </div>
      {/* Barra de sesión 9:30–16:00 */}
      <div className="relative h-2 bg-white/[0.05]" aria-hidden>
        {REVERSAL_TIMES.map((w) => (
          <span
            key={w.label}
            className={cx(
              'absolute top-0 h-full',
              active?.label === w.label ? (w.major ? 'bg-bull shadow-glow-bull' : 'bg-cyan-neon shadow-glow') : w.major ? 'bg-bull/40' : 'bg-cyan-neon/30',
            )}
            style={{ left: pct(w.start - 2), width: `max(3px, ${(((w.end - w.start + 4) / span) * 100).toFixed(2)}%)` }}
          />
        ))}
        {open && <span className="absolute -top-0.5 h-3 w-0.5 bg-white shadow-[0_0_8px_#fff]" style={{ left: pct(mins) }} />}
      </div>
    </div>
  );
}
