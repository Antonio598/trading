import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useEffect } from 'react';
import { calcTargets, rewardRatio, unitLabel } from '../../domain/risk';
import {
  CRITICAL_TEXT,
  LOCATION_OPTIONS,
  STOP_OPTIONS,
  TIF_RULE,
  TIP_ESTRECHO,
  TRAILING_OPTIONS,
  TREND_OPTIONS,
  WARN_AMPLIO,
  WARN_CONTRA,
  WARN_LATERAL,
} from '../../domain/rules';
import type { ScoreResult } from '../../domain/score';
import { SETUPS, SETUP_BY_ID } from '../../domain/setups';
import { minutesInET, reversalAt } from '../../domain/time';
import { dt, type ChecklistState, type LocationId, type Profile, type Timeframe } from '../../domain/types';
import { Chips, Fold, NeonCheck, Notice, NumField, Panel, cx, price, usd } from '../../components/hud/primitives';
import { StateSelector } from '../../components/hud/StateSelector';

export interface StepProps {
  c: ChecklistState;
  patch(p: Partial<ChecklistState>): void;
  result: ScoreResult;
  profile: Profile;
}

const isLong = (c: ChecklistState) => c.direction === 'long';

/* ─────────── Paso 1: tendencia ─────────── */
export function StepContexto({ c, patch, profile }: StepProps) {
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  const tfs: Timeframe[] = profile.timeframes.length ? profile.timeframes : [1, 2, 5];
  const long = isLong(c);
  return (
    <div className="space-y-3">
      <Panel title="¿Qué vas a operar?">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="hud-label mb-1.5 block">Acción</span>
            <input
              className="hud-input uppercase tracking-[0.02em]"
              placeholder="AAPL"
              autoCapitalize="characters"
              autoCorrect="off"
              value={c.symbol}
              onChange={(e) => patch({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
            />
          </label>
          <div>
            <span className="hud-label mb-1.5 block">Gráfico</span>
            <Chips
              ariaLabel="Gráfico"
              cols={tfs.length}
              options={tfs.map((t) => ({ id: t, label: `${t}m` }))}
              value={c.timeframe}
              onChange={(t) => patch({ timeframe: t })}
            />
          </div>
        </div>
        <div className="mt-3">
          <Chips
            ariaLabel="Instrumento"
            cols={2}
            size="sm"
            options={[
              { id: 'stock', label: 'Acciones' },
              { id: 'option', label: 'Opciones' },
            ]}
            value={c.instrument ?? 'stock'}
            onChange={(i) => patch({ instrument: i, entry: null, stop: null })}
          />
        </div>
        <div className="mt-2">
          <Chips
            ariaLabel="Dirección"
            cols={2}
            size="lg"
            options={
              c.instrument === 'option'
                ? [
                    { id: 'long', label: <><ArrowUpRight size={18} /> Call</>, sub: 'Compro call · creo que sube', tone: 'bull' },
                    { id: 'short', label: <><ArrowDownRight size={18} /> Put</>, sub: 'Compro put · creo que baja', tone: 'bear' },
                  ]
                : [
                    { id: 'long', label: <><ArrowUpRight size={18} /> Compra</>, sub: 'Largo · creo que sube', tone: 'bull' },
                    { id: 'short', label: <><ArrowDownRight size={18} /> Venta</>, sub: 'Corto · creo que baja', tone: 'bear' },
                  ]
            }
            value={c.direction}
            onChange={(d) => patch({ direction: d })}
          />
        </div>
        {c.instrument === 'option' && (
          <p className="mt-2 text-xs text-ink-dim">
            Lee el gráfico de la acción como siempre. En el paso de entrada escribirás la <b className="text-ink">prima</b> de la opción.
          </p>
        )}
      </Panel>

      <Panel title="Tu gráfico" hint="Revisa que tengas todo a la vista antes de decidir.">
        <div className="space-y-1.5">
          <NeonCheck
            checked={c.chartOk}
            onChange={(v) => patch({ chartOk: v })}
            label="Estoy en el gráfico de 5 min (o el de 2 min para afinar la entrada)"
            help="grafico"
          />
          <NeonCheck
            checked={c.masVisible}
            onChange={(v) => patch({ masVisible: v })}
            label="Veo las 3 líneas: 8mm, 20mm y 200mm"
            help="medias"
          />
        </div>
      </Panel>

      <Panel title="¿Cómo va la tendencia?" hint="Elige lo que más se parece a tu gráfico." help="tendencia">
        <Chips
          ariaLabel="Tipo de tendencia"
          cols={2}
          options={TREND_OPTIONS.map((t) => ({
            id: t.id,
            label: t.label,
            sub: dt(t.desc, c.direction),
            tone: t.id === 'contra' ? 'bear' : t.id === 'lateral' ? 'warn' : 'cyan',
          }))}
          value={c.trendType}
          onChange={(t) => patch({ trendType: t, ...(t === 'contra' && setup && !setup.climactic ? { setup: null } : {}) })}
        />
        <div className="mt-2 space-y-2">
          {c.trendType === 'lateral' && <Notice tone="warn">{WARN_LATERAL}</Notice>}
          {c.trendType === 'contra' && (
            <Notice tone="bear" title="Contra tendencia: solo CDB o CAS">
              {WARN_CONTRA}
            </Notice>
          )}
        </div>
        <div className="mt-3">
          <NeonCheck
            checked={c.with20 || !!setup?.climactic}
            disabled={!!setup?.climactic}
            onChange={(v) => patch({ with20: v })}
            label={long ? 'La línea de 20 (20mm) apunta hacia arriba' : 'La línea de 20 (20mm) apunta hacia abajo'}
            sub={setup?.climactic ? 'No aplica en setups climáticos' : 'Es decir, opero a favor de ella'}
            help="con20"
          />
        </div>
      </Panel>

      <Panel title="¿Qué tan juntas están las líneas?" hint="Compara la línea de 20 (20mm) con la de 200 (200mm)." help="estado">
        <StateSelector value={c.maState} onChange={(s) => patch({ maState: s })} />
        <div className="mt-2">
          {c.maState === 'estrecho' && <Notice tone="bull">{TIP_ESTRECHO}</Notice>}
          {c.maState === 'amplio' && (
            <Notice tone="warn" title={setup?.continuation ? `−10 puntos: ${dt(setup.short, c.direction)} es de continuación` : undefined}>
              {WARN_AMPLIO}
            </Notice>
          )}
        </div>
      </Panel>

      <Fold title="Puntos extra" hint="Opcional: suman puntos si se cumplen" badge={<ExtraBadge n={[c.transition, c.higherTf].filter(Boolean).length} />}>
        <div className="space-y-1.5">
          <NeonCheck
            checked={c.transition}
            onChange={(v) => patch({ transition: v })}
            label="Las líneas estaban separadas y se acaban de juntar"
            sub="El precio rompió la 20mm con fuerza, la 20mm aguantó el rebote y las líneas se juntaron"
            help="transicion"
          />
          <NeonCheck
            checked={c.higherTf}
            onChange={(v) => patch({ higherTf: v })}
            label={`En el gráfico diario, de 60 o de 15 min también va ${long ? 'hacia arriba' : 'hacia abajo'}`}
            help="marcoMayor"
          />
        </div>
      </Fold>
    </div>
  );
}

function ExtraBadge({ n }: { n: number }) {
  return n > 0 ? <span className="font-num bg-accent/15 px-1.5 text-xs font-bold text-accent">{n}</span> : null;
}

/* ─────────── Paso 2: setup ─────────── */
export function StepSetup({ c, patch }: StepProps) {
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  const contra = c.trendType === 'contra';
  return (
    <div className="space-y-3">
      <Panel title="¿Qué patrón ves?" hint="Toca el setup del manual que estás viendo.">
        <div className="grid grid-cols-2 gap-2">
          {SETUPS.map((s) => {
            const on = c.setup === s.id;
            const blocked = contra && !s.climactic;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                disabled={blocked}
                onClick={() => patch({ setup: s.id })}
                className={cx(
                  'min-h-[64px] rounded-ctl px-3.5 py-2.5 text-left transition disabled:opacity-25',
                  on ? 'bg-accent text-void' : 'bg-void-3 hover:bg-[#252731]',
                )}
              >
                <span className={cx('block text-[16px] font-extrabold tracking-[-0.01em]', on ? 'text-void' : 'text-ink')}>
                  {dt(s.short, c.direction)}
                </span>
                <span className={cx('mt-0.5 block text-[12px] font-medium leading-tight', on ? 'text-void/70' : 'text-ink-dim')}>{dt(s.label, c.direction).replace(/^.*· /, '')}</span>
              </button>
            );
          })}
        </div>
        {contra && <p className="mt-2 text-xs text-bear">Contra tendencia solo puedes usar los setups climáticos.</p>}
      </Panel>

      {setup && (
        <Panel title={`¿Se cumple? · ${dt(setup.short, c.direction)}`} hint="Marca lo que sí ves en el gráfico.">
          <div className="space-y-1.5">
            {setup.criteria.map((k) => (
              <NeonCheck
                key={k.id}
                checked={!!c.criteria[k.id]}
                onChange={(v) => patch({ criteria: { ...c.criteria, [k.id]: v } })}
                label={dt(k.text, c.direction)}
                sub={k.optional ? 'Opcional' : undefined}
              />
            ))}
          </div>
          {setup.isSignal && (
            <p className="mt-2 text-xs text-ink-dim">Este patrón ya es una señal de reversa: se marca sola en el siguiente paso.</p>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ─────────── Paso 3: confirmación ─────────── */
export function StepComplementos({ c, patch, result }: StepProps) {
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  const active = reversalAt(minutesInET());

  // Detección automática del tiempo de reversa al entrar al paso.
  useEffect(() => {
    if (c.reversalTime == null && active) patch({ reversalTime: active.major ? 'major' : 'minor' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reversalCrit = result.critical.find((k) => k.id === 'sin_senal_reversa');
  const toggleLoc = (id: LocationId) =>
    patch({ locations: c.locations.includes(id) ? c.locations.filter((l) => l !== id) : [...c.locations, id] });
  const long = isLong(c);

  return (
    <div className="space-y-3">
      <Panel title="¿Ya dio la vuelta?" hint={`Necesitas una vela que muestre que el precio ya empezó a ${long ? 'subir' : 'bajar'}.`}>
        <NeonCheck
          critical
          checked={c.reversalSignal || !!setup?.isSignal}
          disabled={!!setup?.isSignal}
          onChange={(v) => patch({ reversalSignal: v })}
          label={long ? 'Veo una señal de reversa: BT, GBR, NRB o NB' : 'Veo una señal de reversa: TT, RBR, NRB o NB'}
          sub={
            setup?.isSignal
              ? `${dt(setup.short, c.direction)} ya es una señal de reversa`
              : long
                ? 'Obligatoria si vienes de 3–5 velas de caída'
                : 'Obligatoria si vienes de 3–5 velas de subida'
          }
          help="senalReversa"
        />
        {reversalCrit && (
          <div className="mt-2">
            <Notice tone="bear" title="Sin esto no se entra">
              {reversalCrit.text}
            </Notice>
          </div>
        )}
      </Panel>

      <Panel
        title="¿Dónde está el precio?"
        hint="Marca todas las zonas importantes en las que esté. Cada una suma puntos."
        help="ubicacion"
        right={c.locations.length > 0 ? <span className="font-num text-xs text-accent">{c.locations.length} ✓</span> : undefined}
      >
        <Chips
          multi
          ariaLabel="Ubicación"
          cols={3}
          size="sm"
          options={LOCATION_OPTIONS.map((l) => ({ id: l.id, label: dt(l.label, c.direction) }))}
          value={c.locations}
          onChange={toggleLoc}
        />
      </Panel>

      <Panel
        title="¿Es buena hora?"
        hint="A ciertas horas el mercado suele dar la vuelta. La app revisa el reloj por ti."
        help="tiempos"
        right={
          <span className={cx('text-xs font-semibold', active ? 'text-bull' : 'text-ink-dim')}>
            {active ? `Ahora: ${active.label}${active.major ? ' ★' : ''}` : 'Fuera de horario clave'}
          </span>
        }
      >
        <Chips
          ariaLabel="Tiempo de reversa"
          cols={3}
          options={[
            { id: 'major', label: 'Hora fuerte', sub: '10:00 · 11:15 · 2:15', tone: 'bull' },
            { id: 'minor', label: 'Hora normal', sub: 'otras horas clave' },
            { id: 'none', label: 'Ninguna', tone: 'warn' },
          ]}
          value={c.reversalTime ?? 'none'}
          onChange={(v) => patch({ reversalTime: v === 'none' ? null : v })}
        />
      </Panel>

      <Fold title="Puntos extra" hint="Opcional: suman puntos si se cumplen" badge={<ExtraBadge n={[c.law3, c.law5, c.volume].filter(Boolean).length} />}>
        <div className="space-y-1.5">
          <NeonCheck checked={c.law3} onChange={(v) => patch({ law3: v })} label="El movimiento anterior duró 3–5 velas (o 5–8)" sub="Ley #3" help="ley3" />
          <NeonCheck checked={c.law5} onChange={(v) => patch({ law5: v })} label="Entro desde una vela pequeña" sub="Ley #5" help="ley5" />
          <NeonCheck checked={c.volume} onChange={(v) => patch({ volume: v })} label="El volumen subió al final del movimiento" help="volumen" />
        </div>
      </Fold>
    </div>
  );
}

/* ─────────── Paso 4: entrada y riesgo ─────────── */
export function StepEjecucion({ c, patch, result, profile }: StepProps) {
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  const risk = result.risk;
  const targets = calcTargets(c.pivot, c.retraceExtreme);
  const tif = TIF_RULE[c.timeframe];
  const long = isLong(c);
  const option = c.instrument === 'option';
  const unit = (n: number) => unitLabel(c.instrument, n);

  return (
    <div className="space-y-3">
      <Panel
        title={option ? '¿Cuántos contratos?' : '¿Cuántas acciones?'}
        hint={
          option
            ? 'Escribe la prima a la que compras la opción y la prima a la que la venderías si sale mal. La app calcula el resto.'
            : 'Escribe dónde entras y dónde pones tu stop (dónde sales si sale mal). La app calcula el resto.'
        }
        help="r"
      >
        <div className="grid grid-cols-2 gap-2">
          <NumField label={option ? 'Prima de entrada' : 'Precio de entrada'} prefix="$" value={c.entry} onChange={(v) => patch({ entry: v })} placeholder="0.00" />
          <NumField label={option ? 'Prima si toca tu stop' : 'Stop'} prefix="$" value={c.stop} onChange={(v) => patch({ stop: v })} placeholder="0.00" />
        </div>
        {option && (
          <button type="button" className="mt-2 min-h-[36px] text-xs font-semibold text-accent" onClick={() => patch({ stop: 0 })}>
            Arriesgo toda la prima (stop = $0)
          </button>
        )}

        {risk.valid && risk.fitsR && (
          <div className="mt-4 rounded-ctl bg-accent/[0.10] px-4 py-5 text-center">
            <div className="text-sm text-ink-dim">{option ? `Compra ${long ? 'call' : 'put'}` : long ? 'Compra' : 'Vende en corto'}</div>
            <div className="font-num text-[56px] font-extrabold leading-none tracking-[-0.04em] text-ink">
              {risk.shares.toLocaleString('en-US')}
            </div>
            <div className="text-sm text-ink-dim">{unit(risk.shares)}</div>
            <div className="mt-2 text-sm text-ink">
              Si toca tu stop pierdes <b className="font-num text-bear">{usd(risk.riskUsd)}</b> (tu R es {usd(profile.r_value, 0)})
            </div>
            <div className="font-num mt-1 text-xs text-ink-dim">
              {option ? 'Te cuesta' : 'Necesitas'} {usd(risk.capital, 0)} · arriesgas {usd(risk.riskPerShare)} por {unit(1)}
            </div>
          </div>
        )}
        {c.entry != null && c.stop != null && !risk.stopSideOk && (
          <div className="mt-2">
            <Notice tone="bear">
              {option ? 'La prima del stop debe ser menor que la prima de entrada.' : dt(CRITICAL_TEXT.stop_invalido, c.direction)}
            </Notice>
          </div>
        )}
        <div className="mt-2 space-y-2">
          {risk.valid && !risk.fitsR && (
            <Notice tone="bear" title="Este trade no cabe en tu R. No se opera.">
              Con solo 1 {unit(1)} ya perderías {usd(risk.riskPerShare)} y tu límite es {usd(profile.r_value, 0)}. Busca un stop más cercano
              {option ? ', una opción más barata' : ''} o deja pasar este trade.
            </Notice>
          )}
          {risk.exceedsAccount && <Notice tone="warn">Necesitas más dinero del que tiene tu cuenta ({usd(profile.account_size, 0)}).</Notice>}
        </div>
      </Panel>

      <Panel title="Cómo entras">
        <div className="space-y-1.5">
          <NeonCheck
            checked={c.entryPenny}
            onChange={(v) => patch({ entryPenny: v })}
            label={long ? 'Entro 1 centavo arriba del máximo de la vela anterior' : 'Entro 1 centavo abajo del mínimo de la vela anterior'}
            help="entradaCentavo"
          />
          <NeonCheck
            checked={c.earlyEntry}
            onChange={(v) => patch({ earlyEntry: v, tifOk: false })}
            label="Voy a entrar antes de que cierre la vela"
            sub="Solo márcalo si es así"
            critical={!tif.early}
            help="tif"
          />
        </div>
        {c.earlyEntry && (
          <div className="mt-2 space-y-2">
            <Notice tone={tif.early ? 'info' : 'bear'}>{tif.text}</Notice>
            {tif.early && <NeonCheck checked={c.tifOk} onChange={(v) => patch({ tifOk: v })} label="Ya estoy dentro del tiempo permitido" />}
            {setup?.tifIgnorable && (
              <NeonCheck
                checked={c.extremeEliminated}
                onChange={(v) => patch({ extremeEliminated: v })}
                label={`La vela ya rompió el ${long ? 'máximo' : 'mínimo'} de la anterior`}
                sub="En BT, TT y 180 esto permite entrar antes"
              />
            )}
          </div>
        )}
      </Panel>

      <Panel title="Tipo de stop" hint="Por evento es el normal: donde el patrón deja de valer." help="stop">
        <Chips ariaLabel="Tipo de stop" cols={3} options={STOP_OPTIONS} value={c.stopType} onChange={(s) => patch({ stopType: s })} />
        {c.stopType === 'evento' && (
          <div className="mt-2">
            <NeonCheck checked={c.stopAt200} onChange={(v) => patch({ stopAt200: v })} label="Mi stop queda justo en la línea de 200" />
            {c.stopAt200 && (
              <div className="mt-2">
                <Notice tone="warn">
                  Mal lugar para el stop. Mejor usa tu pérdida máxima por trade ({usd(profile.mlpt, 0)}).{' '}
                  <button className="font-bold text-accent underline" onClick={() => patch({ stopType: 'mlpt', stopAt200: false })}>
                    Cambiar
                  </button>
                </Notice>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Fold
        title="Objetivos de ganancia"
        hint={c.setup === 'velez' ? 'Recomendado en VBS/VSS: la app calcula T1, T2 y T3' : 'Opcional'}
        defaultOpen={c.pivot != null}
      >
        <p className="mb-2 text-sm text-ink-dim">
          {long
            ? 'Escribe el máximo de antes de la caída y el punto más bajo de la caída.'
            : 'Escribe el mínimo de antes de la subida y el punto más alto de la subida.'}
          {option && ' Son precios de la acción (no de la prima): úsalos como niveles para vender tu opción.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label={long ? 'Máximo anterior' : 'Mínimo anterior'} prefix="$" value={c.pivot} onChange={(v) => patch({ pivot: v })} />
          <NumField label={long ? 'Punto más bajo' : 'Punto más alto'} prefix="$" value={c.retraceExtreme} onChange={(v) => patch({ retraceExtreme: v })} />
        </div>
        {targets && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {(['t1', 't2', 't3'] as const).map((k) => {
              const rb = !option && c.entry != null && risk.valid ? rewardRatio(c.entry, targets[k], risk.riskPerShare, c.direction) : null;
              return (
                <div key={k}>
                  <div className="hud-label">{k.toUpperCase()}</div>
                  <div className="font-num text-base font-semibold">{price(targets[k])}</div>
                  <div className={cx('text-xs', rb == null ? 'text-ink-dim' : rb >= 1 ? 'text-bull' : 'text-warn')}>
                    {rb == null ? '—' : `ganas ${rb.toFixed(1)}× tu riesgo`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Fold>
    </div>
  );
}

/* ─────────── Paso 5: plan de salida ─────────── */
export function StepManejo({ c, patch }: StepProps) {
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;
  return (
    <div className="space-y-3">
      <Panel title="¿Cómo vas a proteger la ganancia?" hint="Decide ahora cómo vas a mover tu stop, para no improvisar después." help="trailing">
        <Chips ariaLabel="Método de trailing" cols={2} options={TRAILING_OPTIONS} value={c.trailing} onChange={(t) => patch({ trailing: t })} />
        {c.trailing === 'vela' && (
          <p className="mt-2 text-sm text-ink-dim">
            Empiezas a mover el stop después de <b className="text-accent">{setup?.fastTrail ? '1 vela' : '2 velas'}</b> a favor.
          </p>
        )}
        <div className="mt-3">
          <NeonCheck checked={c.breakEven} onChange={(v) => patch({ breakEven: v })} label="Cuando gane lo mismo que arriesgo (1:1), muevo el stop a mi entrada" sub="Break even" />
        </div>
      </Panel>
      <Panel title="Sal cuando veas" help="salidas">
        <ul className="space-y-1.5 text-sm text-ink">
          <li>· Que el precio llega a tu objetivo (T1, T2 o T3).</li>
          <li>· {isLong(c) ? 'Una cola de techo (TT)' : 'Una cola de fondo (BT)'}.</li>
          <li>· Una vela muy grande a tu favor.</li>
          <li>· Una vela en contra que borra más de la mitad de la anterior.</li>
        </ul>
      </Panel>
    </div>
  );
}
