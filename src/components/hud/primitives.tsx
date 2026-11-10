import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, CircleHelp, Info, OctagonX, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { create } from 'zustand';
import { RULES } from '../../domain/rules';
import { dt, type Direction } from '../../domain/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function vibrate(pattern: number | number[] = 12) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* sin soporte */
  }
}

/* ─────────── Panel ─────────── */
export function Panel({
  title,
  hint,
  help,
  right,
  children,
  className,
}: {
  title?: string;
  /** Explicación corta en lenguaje simple. */
  hint?: ReactNode;
  help?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('hud-panel p-4', className)}>
      {(title || right) && (
        <header className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {title && <h2 className="hud-label text-cyan-neon/90">{title}</h2>}
              {help && <HelpButton id={help} />}
            </div>
            {right}
          </div>
          {hint && <p className="mt-1 text-sm leading-snug text-ink-dim">{hint}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ─────────── Sección plegable (para lo opcional) ─────────── */
export function Fold({
  title,
  hint,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  return (
    <details className="hud-panel group" open={defaultOpen}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="hud-label block text-cyan-neon/90">{title}</span>
          {hint && <span className="mt-0.5 block text-xs text-ink-dim">{hint}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <span className="text-lg text-ink-dim transition group-open:rotate-45" aria-hidden>
            +
          </span>
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/* ─────────── Ayuda "?" → tarjeta de regla ─────────── */
const useHelp = create<{ id: string | null; dir: Direction; open(id: string, dir?: Direction): void; close(): void }>(
  (set) => ({
    id: null,
    dir: 'long',
    open: (id, dir = 'long') => set({ id, dir }),
    close: () => set({ id: null }),
  }),
);

export const helpDirection = { current: 'long' as Direction };

/** Abre la tarjeta de una regla desde cualquier parte (p. ej. un insight). */
export const openRule = (id: string, dir: Direction = 'long') => useHelp.getState().open(id, dir);
export const hasRule = (id?: string) => !!id && !!RULES[id];

export function HelpButton({ id }: { id: string }) {
  const open = useHelp((s) => s.open);
  if (!RULES[id]) return null;
  return (
    <button
      type="button"
      aria-label={`Ver regla: ${RULES[id].title}`}
      onClick={(e) => {
        e.stopPropagation();
        open(id, helpDirection.current);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center text-ink-dim transition hover:text-cyan-neon"
    >
      <CircleHelp size={17} />
    </button>
  );
}

export function RuleSheet() {
  const { id, dir, close } = useHelp();
  const rule = id ? RULES[id] : null;
  return (
    <AnimatePresence>
      {rule && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={rule.title}
            className="hud-panel w-full max-w-md p-5"
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 40 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="hud-label">Regla del manual</div>
                <h3 className="mt-1 font-display text-lg font-bold text-cyan-neon">{rule.title}</h3>
              </div>
              <button aria-label="Cerrar" onClick={close} className="grid h-10 w-10 place-items-center text-ink-dim">
                <X size={20} />
              </button>
            </div>
            <p className="leading-relaxed text-ink">{dt(rule.body, dir)}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────── Casilla grande con pulso ─────────── */
export function NeonCheck({
  checked,
  onChange,
  label,
  sub,
  help,
  critical,
  disabled,
}: {
  checked: boolean;
  onChange(v: boolean): void;
  label: ReactNode;
  sub?: ReactNode;
  help?: string;
  critical?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (critical) vibrate(checked ? [30, 40, 30] : 15);
          onChange(!checked);
        }}
        className={cx(
          'group relative flex min-h-[56px] flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50',
          checked ? 'bg-cyan-neon/[0.07]' : 'bg-white/[0.02] hover:bg-white/[0.04]',
        )}
        style={{ clipPath: 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)' }}
      >
        <motion.span
          className={cx(
            'relative grid h-7 w-7 shrink-0 place-items-center border-2',
            checked ? 'border-cyan-neon bg-cyan-neon text-void' : critical ? 'border-bear/70' : 'border-ink-dim/60',
          )}
          animate={checked ? { boxShadow: ['0 0 0px rgba(0,229,255,0)', '0 0 22px rgba(0,229,255,.85)', '0 0 10px rgba(0,229,255,.4)'] } : { boxShadow: '0 0 0px rgba(0,229,255,0)' }}
          transition={{ duration: 0.35 }}
        >
          {checked && <Check size={18} strokeWidth={3.5} />}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug text-ink">
            {label}
            {critical && (
              <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-bold uppercase tracking-wider text-bear">
                <OctagonX size={11} /> Crítica
              </span>
            )}
          </span>
          {sub && <span className="mt-0.5 block text-xs text-ink-dim">{sub}</span>}
        </span>
      </button>
      {help && <HelpButton id={help} />}
    </div>
  );
}

/* ─────────── Selector de chips (único o múltiple) ─────────── */
export interface ChipOption<T extends string | number> {
  id: T;
  label: ReactNode;
  sub?: ReactNode;
  tone?: 'cyan' | 'bull' | 'bear' | 'warn';
  disabled?: boolean;
}

const toneOn: Record<string, string> = {
  cyan: 'border-cyan-neon text-cyan-neon bg-cyan-neon/10 shadow-glow',
  bull: 'border-bull text-bull bg-bull/10 shadow-glow-bull',
  bear: 'border-bear text-bear bg-bear/10 shadow-glow-bear',
  warn: 'border-warn text-warn bg-warn/10',
};

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  multi,
  cols,
  size = 'md',
  ariaLabel,
}: {
  options: ChipOption<T>[];
  value: NoInfer<T> | NoInfer<T>[] | null;
  onChange(v: NoInfer<T>): void;
  multi?: boolean;
  cols?: number;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}) {
  const isOn = (id: T) => (Array.isArray(value) ? value.includes(id) : value === id);
  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      className={cx('grid gap-2', !cols && 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]')}
      style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const on = isOn(o.id);
        return (
          <button
            key={String(o.id)}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cx(
              'flex flex-col items-center justify-center gap-0.5 border px-2 text-center font-grotesk font-bold transition disabled:opacity-30',
              size === 'sm' && 'min-h-[40px] text-xs',
              size === 'md' && 'min-h-[48px] text-sm',
              size === 'lg' && 'min-h-[64px] text-base uppercase tracking-widest',
              on ? toneOn[o.tone ?? 'cyan'] : 'border-ink-dim/25 bg-white/[0.02] text-ink-dim hover:text-ink',
            )}
            style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}
          >
            <span className="flex items-center gap-1">
              {on && multi && <Check size={13} strokeWidth={3} />}
              {o.label}
            </span>
            {o.sub && <span className="text-[10px] font-normal normal-case tracking-normal opacity-80">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────── Avisos ─────────── */
export function Notice({ tone, title, children }: { tone: 'warn' | 'bear' | 'info' | 'bull'; title?: string; children: ReactNode }) {
  const Icon = tone === 'bear' ? OctagonX : tone === 'warn' ? AlertTriangle : tone === 'bull' ? Check : Info;
  const c = {
    warn: 'border-warn/60 bg-warn/[0.08] text-warn',
    bear: 'border-bear/70 bg-bear/[0.09] text-bear',
    info: 'border-cyan-neon/40 bg-cyan-neon/[0.06] text-cyan-neon',
    bull: 'border-bull/50 bg-bull/[0.07] text-bull',
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx('flex gap-2.5 border-l-2 px-3 py-2.5 text-sm', c)}
      role={tone === 'bear' ? 'alert' : 'status'}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-bold">{title}</div>}
        <div className="leading-snug text-ink/90">{children}</div>
      </div>
    </motion.div>
  );
}

/* ─────────── Campo numérico ─────────── */
export function NumField({
  label,
  value,
  onChange,
  prefix,
  placeholder,
  step = 'any',
  integer,
}: {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
  prefix?: string;
  placeholder?: string;
  step?: string;
  integer?: boolean;
}) {
  return (
    <label className="block">
      <span className="hud-label mb-1.5 block">{label}</span>
      <span className="relative block">
        {prefix && <span className="font-num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim">{prefix}</span>}
        <input
          className={cx('hud-input', prefix && 'pl-7')}
          type="number"
          inputMode={integer ? 'numeric' : 'decimal'}
          step={step}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : integer ? Math.trunc(Number(v)) : Number(v));
          }}
        />
      </span>
    </label>
  );
}

/* ─────────── Fila clave-valor numérica ─────────── */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'bull' | 'bear' | 'warn' | 'cyan' }) {
  const c = tone ? { bull: 'text-bull', bear: 'text-bear', warn: 'text-warn', cyan: 'text-cyan-neon' }[tone] : 'text-ink';
  return (
    <div className="min-w-0">
      <div className="hud-label truncate">{label}</div>
      <div className={cx('font-num mt-0.5 truncate text-lg font-semibold', c)}>{value}</div>
    </div>
  );
}

export const usd = (n: number, digits = 2) =>
  `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtR = (r: number) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)}R`;
export const price = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
