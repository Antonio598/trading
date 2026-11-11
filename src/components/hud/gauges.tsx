import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { CheckCircle2, OctagonX, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { Verdict } from '../../domain/types';
import { cx } from './primitives';

export function scoreColor(score: number, critical = false) {
  if (critical || score < 60) return '#FF6B7D';
  if (score < 80) return '#F5B84A';
  return '#3DDC97';
}

/* ─────────── Número que cuenta ─────────── */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(value);
  const reduce = useReducedMotion();
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

/* ─────────── Medidor: arco abierto de 270° con el número al centro ─────────── */
const SWEEP = 0.75; // fracción del círculo que ocupa el arco

export function RadialScore({ score, critical, size = 132 }: { score: number; critical?: boolean; size?: number }) {
  const big = size > 80;
  const stroke = big ? 8 : 4.5;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const arc = c * SWEEP;
  const color = scoreColor(score, critical);
  const label = critical ? 'Regla rota' : score >= 80 ? 'Trade A+' : score >= 60 ? 'Aceptable' : 'Bajo';
  // Rotación para que el hueco del arco quede abajo.
  const rotate = 90 + ((1 - SWEEP) * 360) / 2;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Puntaje ${score} de 100: ${label}`}
    >
      <svg width={size} height={size} style={{ transform: `rotate(${rotate}deg)` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2D37" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDasharray: `${Math.max(0.001, (arc * score) / 100)} ${c}`, stroke: color }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className={big ? '-mt-1' : ''}>
          <div
            className={cx('font-num font-extrabold leading-none tracking-[-0.04em]', big ? 'text-[44px]' : 'text-[17px]')}
            style={{ color: big ? '#EDEEF2' : color }}
          >
            <CountUp value={score} />
          </div>
          {big && (
            <div className="mt-1.5 text-[13px] font-bold" style={{ color }}>
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Veredicto ─────────── */
const VERDICT = {
  aplus: { text: 'Trade A+', sub: 'Cumple el método', color: '#3DDC97', Icon: CheckCircle2 },
  aceptable: { text: 'Aceptable', sub: 'Puedes entrar con cuidado', color: '#F5B84A', Icon: TriangleAlert },
  no_operar: { text: 'No operar', sub: 'No cumple el método', color: '#FF6B7D', Icon: OctagonX },
} as const;

export function ScanVerdict({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={verdict}
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="flex items-center gap-4 rounded-card p-5"
      style={{ background: `${v.color}1A` }}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: `${v.color}26` }}>
        <v.Icon size={28} color={v.color} aria-hidden />
      </span>
      <div>
        <div className="text-[28px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: v.color }}>
          {v.text}
        </div>
        <div className="mt-1.5 text-[14px] font-medium text-ink/80">{v.sub}</div>
      </div>
    </motion.div>
  );
}
