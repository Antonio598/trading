import { ChevronDown, ChevronLeft, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chips, Notice, NumField, Panel, Stat, cx, fmtR, price, usd } from '../components/hud/primitives';
import { ERROR_GROUPS } from '../domain/errors';
import { CRITICAL_TEXT } from '../domain/rules';
import { exitPnl, toR, unitLabel } from '../domain/risk';
import { SETUP_BY_ID } from '../domain/setups';
import { dt, type Emotion, type ExitReason, type TradeRecord } from '../domain/types';
import { tradeTotals, useJournal } from '../state/journal';
import { ScreenshotPanel } from '../components/Screenshot';

const REASONS: { id: ExitReason; label: string }[] = [
  { id: 't1', label: 'T1' },
  { id: 't2', label: 'T2' },
  { id: 't3', label: 'T3' },
  { id: 'trailing', label: 'Trailing' },
  { id: 'stop', label: 'Stop inicial' },
  { id: 'break_even', label: 'Break even' },
  { id: 'manual', label: 'Manual' },
  { id: 'fin_dia', label: 'Fin del día' },
];

const EMOTIONS: { id: Emotion; label: string; tone?: 'bull' | 'bear' | 'warn' }[] = [
  { id: 'tranquilo', label: 'Tranquilo', tone: 'bull' },
  { id: 'ansioso', label: 'Ansioso', tone: 'warn' },
  { id: 'fomo', label: 'FOMO', tone: 'bear' },
  { id: 'venganza', label: 'Venganza', tone: 'bear' },
  { id: 'miedo', label: 'Miedo', tone: 'warn' },
  { id: 'sobreconfiado', label: 'Sobreconfiado', tone: 'warn' },
  { id: 'aburrido', label: 'Aburrido', tone: 'warn' },
];

/** Errores que se pueden deducir de las reglas rotas al registrar y del resultado. */
const FLAG_TO_ERROR: Record<string, string> = {
  sin_senal_reversa: 'sin_senal_reversa',
  contra_no_climatico: 'contra_20_no_climatico',
  tif_roto: 'tif',
  no_cabe_en_r: 'mas_acciones',
  limite_trades: 'limite_trades',
  perdida_diaria: 'supere_perdida_diaria',
};

function suggestedErrors(t: TradeRecord, mlpt: number): string[] {
  const s = new Set(t.critical_flags.map((f) => FLAG_TO_ERROR[f]).filter(Boolean));
  const { pnl } = tradeTotals(t);
  if (mlpt > 0 && -pnl > mlpt) s.add('supere_mlpt');
  if (t.checklist_json?.trendType === 'lateral' && SETUP_BY_ID[t.setup]?.continuation) s.add('lateral_con_tendencia');
  return [...s];
}

export function CloseTrade() {
  const { id } = useParams();
  const trade = useJournal((s) => s.trades.find((t) => t.id === id));
  if (!trade) {
    return (
      <div className="space-y-3">
        <Link to="/trades" className="btn-ghost">
          <ChevronLeft size={16} /> Trades
        </Link>
        <p className="text-ink-dim">Trade no encontrado.</p>
      </div>
    );
  }
  return <CloseTradeInner key={trade.id} trade={trade} />;
}

function CloseTradeInner({ trade }: { trade: TradeRecord }) {
  const { addExit, saveReview, profile } = useJournal();
  const { closedShares, pnl, r } = tradeTotals(trade);
  const remaining = trade.shares - closedShares;
  const [px, setPx] = useState<number | null>(null);
  const [shares, setShares] = useState<number | null>(remaining);
  const [reason, setReason] = useState<ExitReason | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    if (px == null || !shares) return null;
    const p = exitPnl(Number(trade.entry), px, shares, trade.direction, trade.instrument);
    return { pnl: p, r: toR(p, Number(trade.r_value)) };
  }, [px, shares, trade]);

  const canExit = px != null && px > 0 && !!shares && shares > 0 && shares <= remaining && !!reason;

  async function submitExit() {
    if (!canExit) return;
    setBusy(true);
    await addExit(trade.id, px!, shares!, reason!);
    const left = remaining - shares!;
    setPx(null);
    setReason(null);
    setShares(left > 0 ? left : null);
    setBusy(false);
  }

  const setup = SETUP_BY_ID[trade.setup];

  return (
    <div className="space-y-4 pb-28">
      <Link to="/trades" className="inline-flex items-center gap-1 text-sm text-ink-dim">
        <ChevronLeft size={16} /> Trades
      </Link>

      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <div className="tracking-[-0.02em] text-2xl font-bold">{trade.symbol}</div>
            <div className="text-xs text-ink-dim">
              <span className={trade.direction === 'long' ? 'text-bull' : 'text-bear'}>{trade.direction === 'long' ? 'LARGO' : 'CORTO'}</span> ·{' '}
              {dt(setup.label, trade.direction)} · {trade.timeframe}m · score {trade.quality_score}
            </div>
          </div>
          <div className="text-right">
            <div className={cx('font-num text-2xl font-bold', r > 0 ? 'text-bull' : r < 0 ? 'text-bear' : 'text-ink')}>{fmtR(r)}</div>
            <div className="font-num text-xs text-ink-dim">{usd(pnl)}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3">
          <Stat label="Entrada" value={price(trade.entry)} />
          <Stat label="Stop" value={price(trade.stop)} tone="bear" />
          <Stat label={trade.instrument === 'option' ? 'Contratos' : 'Acciones'} value={trade.shares} />
          <Stat label="1R" value={usd(Number(trade.r_value), 0)} tone="cyan" />
        </div>
        {(trade.t1 || trade.t2 || trade.t3) && (
          <div className="font-num mt-2 text-xs text-ink-dim">
            T1 {price(trade.t1)} · T2 {price(trade.t2)} · T3 {price(trade.t3)}
          </div>
        )}
        {trade.critical_flags.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {trade.critical_flags.map((f) => (
              <Notice key={f} tone="bear">
                {CRITICAL_TEXT[f] ? dt(CRITICAL_TEXT[f], trade.direction) : f}
              </Notice>
            ))}
          </div>
        )}
      </Panel>

      {trade.exits.length > 0 && (
        <Panel title="Tus salidas">
          <div className="space-y-1">
            {trade.exits.map((e) => (
              <div key={e.id} className="font-num flex justify-between text-sm">
                <span className="text-ink-dim">
                  {REASONS.find((x) => x.id === e.reason)?.label} · {e.shares} @ {price(e.price)}
                </span>
                <span className={Number(e.r_result) >= 0 ? 'text-bull' : 'text-bear'}>
                  {fmtR(Number(e.r_result))} · {usd(Number(e.pnl_usd))}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {remaining > 0 && (
        <Panel title="¿A qué precio saliste?" hint={`Te quedan ${remaining} ${unitLabel(trade.instrument, remaining)}. Si saliste por partes, registra cada parte.`}>
          <div className="grid grid-cols-2 gap-2">
            <NumField label={trade.instrument === 'option' ? 'Prima de salida' : 'Precio'} prefix="$" value={px} onChange={setPx} />
            <NumField label={trade.instrument === 'option' ? 'Contratos' : 'Acciones'} integer value={shares} onChange={setShares} />
          </div>
          <div className="mt-2">
            <Chips
              ariaLabel="Acciones a cerrar"
              cols={3}
              size="sm"
              options={[
                { id: 'all', label: `Todo (${remaining})` },
                { id: 'half', label: `½ (${Math.floor(remaining / 2)})` },
                { id: 'third', label: `⅓ (${Math.floor(remaining / 3)})` },
              ]}
              value={shares === remaining ? 'all' : shares === Math.floor(remaining / 2) ? 'half' : shares === Math.floor(remaining / 3) ? 'third' : null}
              onChange={(k) => setShares(k === 'all' ? remaining : k === 'half' ? Math.floor(remaining / 2) : Math.floor(remaining / 3))}
            />
          </div>
          <div className="mt-3">
            <span className="hud-label mb-1.5 block">¿Por qué saliste?</span>
            <Chips ariaLabel="Motivo de salida" cols={4} size="sm" options={REASONS} value={reason} onChange={setReason} />
          </div>
          {preview && (
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="hud-label">Resultado</span>
              <span className={cx('font-num text-lg font-bold', preview.r >= 0 ? 'text-bull' : 'text-bear')}>
                {fmtR(preview.r)} · {usd(preview.pnl)}
              </span>
            </div>
          )}
          {shares != null && shares > remaining && <p className="mt-2 text-xs text-bear">No puedes cerrar más de {remaining} {unitLabel(trade.instrument, remaining)}.</p>}
          <button className="btn-primary mt-3 w-full" disabled={!canExit || busy} onClick={submitExit}>
            <Save size={18} /> {shares === remaining ? 'Cerrar trade' : 'Registrar parcial'}
          </button>
        </Panel>
      )}

      <ReviewForm trade={trade} mlpt={profile?.mlpt ?? 0} onSave={saveReview} />
    </div>
  );
}

function ReviewForm({ trade, mlpt, onSave }: { trade: TradeRecord; mlpt: number; onSave: ReturnType<typeof useJournal.getState>['saveReview'] }) {
  const existing = trade.review;
  const suggested = useMemo(() => suggestedErrors(trade, mlpt), [trade, mlpt]);
  const [emotion, setEmotion] = useState<Emotion | null>(existing?.emotion ?? null);
  const [rating, setRating] = useState<number | null>(existing?.execution_rating ?? null);
  const [errors, setErrors] = useState<string[]>(existing?.errors ?? suggested);
  const [note, setNote] = useState(existing?.note ?? '');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setErrors(errors.includes(id) ? errors.filter((e) => e !== id) : [...errors, id]);
    setSaved(false);
  };

  async function save() {
    await onSave({
      trade_id: trade.id,
      emotion,
      execution_rating: rating,
      errors,
      note: note.trim() || null,
      screenshot_url: existing?.screenshot_url ?? null,
    });
    setSaved(true);
  }

  return (
    <>
      <ScreenshotPanel trade={trade} />

      <Panel title="¿Cómo te sentiste?">
        <Chips ariaLabel="Emoción" cols={4} size="sm" options={EMOTIONS} value={emotion} onChange={(e) => (setEmotion(e), setSaved(false))} />
      </Panel>

      <Panel title="¿Seguiste tu plan?" hint="1 = nada · 5 = al pie de la letra">
        <Chips
          ariaLabel="Calificación de ejecución"
          cols={5}
          options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: String(n), tone: n <= 2 ? 'bear' : n === 3 ? 'warn' : 'bull' }))}
          value={rating}
          onChange={(n) => (setRating(n), setSaved(false))}
        />
      </Panel>

      <Panel title={`¿Qué hiciste mal? · ${errors.length}`} hint="Sé honesto: esto es lo que más te ayuda a mejorar.">
        {suggested.length > 0 && !existing && (
          <p className="mb-2 text-xs text-warn">Ya marcamos algunos según las reglas que rompiste y el resultado. Revísalos.</p>
        )}
        <div className="space-y-1.5">
          {ERROR_GROUPS.map((g) => {
            const count = g.items.filter((i) => errors.includes(i.id)).length;
            const open = openGroup === g.id;
            return (
              <div key={g.id} className="overflow-hidden rounded-ctl bg-void-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : g.id)}
                  className="flex min-h-[48px] w-full items-center justify-between px-3 text-left"
                >
                  <span className="font-bold">{g.label}</span>
                  <span className="flex items-center gap-2">
                    {count > 0 && <span className="font-num bg-bear/20 px-1.5 text-xs font-bold text-bear">{count}</span>}
                    <ChevronDown size={16} className={cx('transition', open && 'rotate-180')} />
                  </span>
                </button>
                {open && (
                  <div className="space-y-1 px-2 pb-2">
                    {g.items.map((i) => {
                      const on = errors.includes(i.id);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggle(i.id)}
                          className={cx(
                            'flex min-h-[48px] w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm transition',
                            on ? 'bg-bear/10 text-ink' : 'text-ink-dim',
                          )}
                        >
                          <span className={cx('grid h-5 w-5 shrink-0 place-items-center border-2 text-[11px] font-black', on ? 'border-bear bg-bear text-white' : 'border-ink-dim/50')}>
                            {on ? '✕' : ''}
                          </span>
                          {i.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Nota" hint="Opcional, una línea.">
        <input className="hud-input !font-sans !text-base" maxLength={140} placeholder="Ej: entré por ansiedad" value={note} onChange={(e) => (setNote(e.target.value), setSaved(false))} />
      </Panel>

      <button className="btn-primary w-full" onClick={save}>
        <Save size={18} /> {saved ? 'Revisión guardada' : 'Guardar revisión'}
      </button>
    </>
  );
}
