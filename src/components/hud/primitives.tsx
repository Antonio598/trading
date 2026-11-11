import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, CircleHelp, Info, OctagonX, X } from 'lucide-react';
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

/* ─────────── Tarjeta ─────────── */
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
    <section className={cx('hud-panel p-5', className)}>
      {(title || right) && (
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              {title && <h2 className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h2>}
              {help && <HelpButton id={help} />}
            </div>
            {right && <div className="shrink-0 pt-0.5">{right}</div>}
          </div>
          {hint && <p className="mt-1 text-[14px] leading-snug text-ink-dim">{hint}</p>}
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
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[16px] font-bold text-ink">{title}</span>
          {hint && <span className="mt-0.5 block text-[13px] text-ink-dim">{hint}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-void-3 text-ink-dim transition group-open:rotate-180" aria-hidden>
            <ChevronDown size={16} />
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
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
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-dim transition hover:bg-void-3 hover:text-accent"
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={rule.title}
            className="w-full max-w-md rounded-t-[28px] bg-void-2 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-3 sm:rounded-[28px] sm:pb-6"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{rule.title}</h3>
              <button aria-label="Cerrar" onClick={close} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-dim hover:bg-void-3">
                <X size={20} />
              </button>
            </div>
            <p className="text-[16px] leading-relaxed text-ink/90">{dt(rule.body, dir)}</p>
            <p className="mt-4 text-[13px] text-ink-dim">Regla del Método Velez</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────── Casilla grande ─────────── */
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
          'flex min-h-[60px] flex-1 items-center gap-3.5 rounded-ctl px-4 py-3 text-left transition-colors disabled:opacity-50',
          checked ? 'bg-accent/[0.12]' : 'bg-void-3 hover:bg-[#252731]',
        )}
      >
        <motion.span
          className={cx(
            'grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border-2 transition-colors',
            checked ? 'border-accent bg-accent text-void' : critical ? 'border-bear/70' : 'border-ink-dim/50',
          )}
          animate={checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.22 }}
        >
          {checked && <Check size={15} strokeWidth={3.5} />}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-ink">{label}</span>
          {(sub || critical) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-dim">
              {critical && (
                <span className="inline-flex items-center gap-1 font-semibold text-bear">
                  <OctagonX size={12} aria-hidden /> Obligatoria
                </span>
              )}
              {sub && <span>{sub}</span>}
            </span>
          )}
        </span>
      </button>
      {help && (
        <div className="flex items-center">
          <HelpButton id={help} />
        </div>
      )}
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
  cyan: 'bg-accent text-void',
  bull: 'bg-bull text-void',
  bear: 'bg-bear text-void',
  warn: 'bg-warn text-void',
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
  const hasSub = options.some((o) => o.sub);
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
              'flex flex-col items-center justify-center gap-0.5 px-3 text-center font-semibold transition disabled:opacity-30',
              hasSub || size === 'lg' ? 'rounded-ctl' : 'rounded-full',
              size === 'sm' && 'min-h-[40px] text-[13px]',
              size === 'md' && 'min-h-[46px] text-[14px]',
              size === 'lg' && 'min-h-[68px] text-[17px] font-bold',
              hasSub && 'py-2.5',
              on ? toneOn[o.tone ?? 'cyan'] : 'bg-void-3 text-ink/80 hover:bg-[#252731] hover:text-ink',
            )}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {on && multi && <Check size={14} strokeWidth={3} className="shrink-0" />}
              {o.label}
            </span>
            {o.sub && <span className={cx('text-[12px] font-medium leading-tight', on ? 'opacity-75' : 'text-ink-dim')}>{o.sub}</span>}
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
    warn: 'bg-warn/[0.10] text-warn',
    bear: 'bg-bear/[0.11] text-bear',
    info: 'bg-accent/[0.10] text-accent-soft',
    bull: 'bg-bull/[0.10] text-bull',
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx('flex gap-3 rounded-ctl px-4 py-3 text-[14px]', c)}
      role={tone === 'bear' ? 'alert' : 'status'}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-bold">{title}</div>}
        <div className="leading-snug text-ink/85">{children}</div>
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
      <span className="hud-label mb-2 block">{label}</span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-ink-dim">{prefix}</span>}
        <input
          className={cx('hud-input', prefix && 'pl-8')}
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

/* ─────────── Dato ─────────── */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'bull' | 'bear' | 'warn' | 'cyan' }) {
  const c = tone ? { bull: 'text-bull', bear: 'text-bear', warn: 'text-warn', cyan: 'text-accent' }[tone] : 'text-ink';
  return (
    <div className="min-w-0">
      <div className="hud-label truncate">{label}</div>
      <div className={cx('font-num mt-1 truncate text-[19px] font-bold tracking-[-0.01em]', c)}>{value}</div>
    </div>
  );
}

export const usd = (n: number, digits = 2) =>
  `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtR = (r: number) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)}R`;
export const price = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
