import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { CheckCircle2, OctagonX, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Verdict } from '../../domain/types';
import { cx } from './primitives';

export function scoreColor(score: number, critical = false) {
  if (critical || score < 60) return '#FF2E63';
  if (score < 80) return '#FFB800';
  return '#00FF9C';
}

/* ─────────── Número que cuenta ─────────── */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(value);
  const reduce = useReducedMotion();
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  const [, force] = useState(0);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      force((n) => n + 1);
      return;
    }
    const c = animate(mv, value, { duration: 0.45, ease: 'easeOut' });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

/* ─────────── Medidor radial ─────────── */
export function RadialScore({ score, critical, size = 132 }: { score: number; critical?: boolean; size?: number }) {
  const stroke = size > 80 ? 9 : 5;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score, critical);
  const label = critical ? 'Regla crítica rota' : score >= 80 ? 'A+' : score >= 60 ? 'Aceptable' : 'Bajo';
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Score de calidad ${score} de 100: ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(138,148,166,.15)" strokeWidth={stroke} />
        {/* marcas en 60 y 80 */}
        {[60, 80].map((m) => (
          <circle
            key={m}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,.35)"
            strokeWidth={stroke + 4}
            strokeDasharray={`1.5 ${c}`}
            strokeDashoffset={-(m / 100) * c}
          />
        ))}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - score / 100), stroke: color }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cx('font-display font-black leading-none', size > 80 ? 'text-4xl' : 'text-lg')} style={{ color }}>
            <CountUp value={score} />
          </div>
          {size > 80 && <div className="hud-label mt-1 !text-[10px]">{label}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Semáforo con escaneo ─────────── */
const VERDICT = {
  aplus: { text: 'TRADE A+', sub: 'Cumple el método', color: '#00FF9C', Icon: CheckCircle2 },
  aceptable: { text: 'ACEPTABLE', sub: 'Opera con advertencias', color: '#FFB800', Icon: TriangleAlert },
  no_operar: { text: 'NO OPERAR', sub: 'No cumple el método', color: '#FF2E63', Icon: OctagonX },
} as const;

export function ScanVerdict({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  const reduce = useReducedMotion();
  return (
    <div className="hud-panel relative overflow-hidden px-4 py-6 text-center" style={{ boxShadow: `inset 0 0 40px ${v.color}22` }}>
      <motion.div
        key={verdict}
        initial={reduce ? false : { clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-2"
      >
        <v.Icon size={34} color={v.color} aria-hidden />
        <div className="font-display text-3xl font-black tracking-[0.12em]" style={{ color: v.color, textShadow: `0 0 18px ${v.color}88` }}>
          {v.text}
        </div>
        <div className="hud-label">{v.sub}</div>
      </motion.div>
      {!reduce && (
        <motion.div
          key={`scan-${verdict}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-10"
          style={{ background: `linear-gradient(180deg, transparent, ${v.color}55, transparent)` }}
          initial={{ top: '-20%' }}
          animate={{ top: '110%' }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
