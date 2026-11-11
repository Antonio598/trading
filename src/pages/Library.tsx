import { ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Chips, cx } from '../components/hud/primitives';
import { searchLibrary } from '../domain/library';
import { dt, type Direction } from '../domain/types';

export function Library() {
  const [q, setQ] = useState('');
  const [dir, setDir] = useState<Direction>('long');
  const sections = useMemo(() => searchLibrary(q, dir), [q, dir]);

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink">Reglas</h1>
        <p className="mt-1 text-[15px] text-ink-dim">El método en tarjetas cortas. Toca una para leerla.</p>
      </div>

      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-dim" aria-hidden />
        <input
          className="hud-input !pl-11 !text-base !font-medium"
          placeholder="Buscar: VBS, stop, 10:00…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar regla"
        />
      </label>

      <Chips
        ariaLabel="Ver reglas para"
        cols={2}
        size="sm"
        options={[
          { id: 'long', label: <><ArrowUpRight size={14} /> Para compras</>, tone: 'bull' },
          { id: 'short', label: <><ArrowDownRight size={14} /> Para ventas</>, tone: 'bear' },
        ]}
        value={dir}
        onChange={setDir}
      />

      {sections.length === 0 && <p className="text-sm text-ink-dim">Nada coincide con "{q}".</p>}

      {sections.map((sec) => (
        <section key={sec.id} className="space-y-2">
          <div className="pt-2">
            <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">{sec.title}</h2>
            <p className="text-[13px] text-ink-dim">{sec.hint}</p>
          </div>
          {sec.cards.map((c) => (
            <details key={c.id} className="hud-panel group" open={!!q.trim()}>
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-[16px] font-bold text-ink">{dt(c.title, dir)}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-void-3 text-lg leading-none text-ink-dim transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <div className="space-y-2 px-4 pb-4 text-[15px] leading-relaxed text-ink">
                <p>{dt(c.body, dir)}</p>
                {c.points && (
                  <ul className="space-y-1.5">
                    {c.points.map((p, i) => (
                      <li key={i} className={cx('flex gap-2', p.optional && 'text-ink-dim')}>
                        <span className="text-accent">✓</span>
                        <span>
                          {dt(p.text, dir)}
                          {p.optional && ' (opcional)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
