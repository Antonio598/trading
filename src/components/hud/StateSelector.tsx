import { Check } from 'lucide-react';
import { STATE_OPTIONS } from '../../domain/rules';
import type { MaState } from '../../domain/types';
import { cx } from './primitives';

/** Mini-diagrama: 20mm (cian) y 200mm (ámbar) con distinta separación. */
function Diagram({ state }: { state: MaState }) {
  const gap = { estrecho: 4, neutral: 14, amplio: 28 }[state];
  const y200 = 34;
  const y20 = y200 - gap;
  return (
    <svg viewBox="0 0 100 44" className="h-11 w-full" aria-hidden>
      <path d={`M4 ${y200} C 35 ${y200 + 1}, 65 ${y200 - 1}, 96 ${y200 - 2}`} stroke="#F5B84A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path
        d={`M4 ${y200 - 1} C 30 ${y20 + gap * 0.4}, 60 ${y20}, 96 ${y20 - 2}`}
        stroke="#8B7CFF"
        strokeLinecap="round"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}

export function StateSelector({ value, onChange }: { value: MaState | null; onChange(v: MaState): void }) {
  return (
    <div role="radiogroup" aria-label="Estado de las medias" className="grid grid-cols-3 gap-2">
      {STATE_OPTIONS.map((o) => {
        const on = value === o.id;
        const tone = o.id === 'estrecho' ? 'bull' : o.id === 'amplio' ? 'warn' : 'cyan';
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cx(
              'flex flex-col items-center gap-1 rounded-ctl px-2 pb-3 pt-2 transition',
              on
                ? tone === 'bull'
                  ? 'bg-bull/[0.14] shadow-glow-bull'
                  : tone === 'warn'
                    ? 'bg-warn/[0.14] shadow-[0_0_0_1.5px_#F5B84A]'
                    : 'bg-accent/[0.14] shadow-glow'
                : 'bg-void-3 hover:bg-[#252731]',
            )}
          >
            <Diagram state={o.id} />
            <span className={cx('flex items-center gap-1 text-[14px] font-bold', on ? 'text-ink' : 'text-ink/75')}>
              {on && <Check size={13} strokeWidth={3} />}
              {o.label}
            </span>
            <span className="text-[10px] leading-tight text-ink-dim">{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
