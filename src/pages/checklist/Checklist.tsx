import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Save, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadialScore, ScanVerdict, scoreColor } from '../../components/hud/gauges';
import { Fold, Notice, Panel, cx, helpDirection, usd, vibrate } from '../../components/hud/primitives';
import { calcTargets } from '../../domain/risk';
import { evaluate } from '../../domain/score';
import { SETUP_BY_ID } from '../../domain/setups';
import { dt, type TradeRecord } from '../../domain/types';
import { useChecklist } from '../../state/checklist';
import { dayStats, useJournal } from '../../state/journal';
import { StepComplementos, StepContexto, StepEjecucion, StepManejo, StepSetup } from './Steps';

const STEPS = ['Tendencia', 'Patrón', 'Confirmación', 'Entrada', 'Salida', 'Veredicto'];

export function Checklist() {
  const { c, step, setStep, patch, reset, template, applyTemplate, saveTemplate } = useChecklist();
  const profile = useJournal((s) => s.profile)!;
  const trades = useJournal((s) => s.trades);
  const addTrade = useJournal((s) => s.addTrade);
  const navigate = useNavigate();
  const [confirmBroken, setConfirmBroken] = useState(false);
  const [saving, setSaving] = useState(false);

  helpDirection.current = c.direction;
  const day = useMemo(() => dayStats(trades), [trades]);
  const result = useMemo(() => evaluate(c, profile, day), [c, profile, day]);
  const hasCritical = result.critical.length > 0;
  const props = { c, patch, result, profile };

  const go = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    setConfirmBroken(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function register() {
    if (!result.ready || !c.setup || !c.trendType || !c.maState) return;
    if (result.verdict === 'no_operar' && !confirmBroken) {
      vibrate([40, 50, 40]);
      setConfirmBroken(true);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const t = calcTargets(c.pivot, c.retraceExtreme);
    const trade: TradeRecord = {
      id,
      client_id: id,
      created_at: now,
      symbol: c.symbol.trim(),
      direction: c.direction,
      timeframe: c.timeframe,
      setup: c.setup,
      trend_type: c.trendType,
      ma_state: c.maState,
      state_transition: c.transition,
      entry: c.entry!,
      stop: c.stop!,
      stop_type: c.stopType,
      shares: result.risk.shares,
      risk_usd: result.risk.riskUsd,
      r_value: profile.r_value,
      t1: t?.t1 ?? null,
      t2: t?.t2 ?? null,
      t3: t?.t3 ?? null,
      trailing_method: c.trailing,
      checklist_json: { ...c, criteria: { ...c.criteria } },
      quality_score: result.score,
      verdict: result.verdict,
      critical_flags: result.critical.map((k) => k.id),
      status: 'open',
      opened_at: now,
      closed_at: null,
      exits: [],
      review: null,
    };
    await addTrade(trade);
    saveTemplate();
    reset(c.timeframe);
    setSaving(false);
    navigate('/trades');
  }

  const color = scoreColor(result.score, hasCritical);
  const setup = c.setup ? SETUP_BY_ID[c.setup] : null;

  return (
    <div className="pb-28">
      {/* Barra de progreso + score en vivo */}
      <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-white/5 bg-void/85 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <RadialScore score={result.score} critical={hasCritical} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold tracking-wider" style={{ color }}>
                {hasCritical ? 'REGLA ROTA' : result.verdict === 'aplus' ? 'A+' : result.verdict === 'aceptable' ? 'ACEPTABLE' : 'BAJO'}
              </span>
              <span className="truncate text-xs text-ink-dim">
                {c.symbol || '—'} · {c.direction === 'long' ? 'Largo' : 'Corto'} · {setup ? dt(setup.short, c.direction) : 'sin setup'}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1" role="tablist" aria-label="Pasos">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`Paso ${i + 1}: ${s}`}
                  onClick={() => go(i)}
                  className={cx('h-1.5 flex-1 transition', i === step ? 'bg-cyan-neon shadow-glow' : i < step ? 'bg-cyan-neon/40' : 'bg-white/10')}
                />
              ))}
            </div>
            <div className="mt-1 text-[11px] text-ink-dim">
              Paso {step + 1}/{STEPS.length} · <span className="text-ink">{STEPS[step]}</span>
            </div>
          </div>
        </div>
        {hasCritical && step < 5 && (
          <div className="mt-2 truncate text-xs text-bear" role="status">
            ⛔ {result.critical[0].text}
          </div>
        )}
      </div>

      {step === 0 && (
        <div className="mb-3 flex gap-2">
          {template && (
            <button className="btn-ghost flex-1" onClick={applyTemplate}>
              <Zap size={16} /> Plantilla rápida
            </button>
          )}
          <button className="btn-ghost" onClick={() => reset(c.timeframe)} aria-label="Reiniciar checklist">
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
        >
          {step === 0 && <StepContexto {...props} />}
          {step === 1 && <StepSetup {...props} />}
          {step === 2 && <StepComplementos {...props} />}
          {step === 3 && <StepEjecucion {...props} />}
          {step === 4 && <StepManejo {...props} />}
          {step === 5 && (
            <div className="space-y-3">
              <ScanVerdict verdict={result.verdict} />
              <p className="px-1 text-center text-base text-ink">
                {result.verdict === 'aplus'
                  ? 'Cumple el método. Puedes entrar con tu plan.'
                  : result.verdict === 'aceptable'
                    ? 'Puedes entrar, pero revisa las advertencias de abajo.'
                    : hasCritical
                      ? 'No entres: rompe una regla importante del método.'
                      : 'No entres: le faltan demasiadas condiciones.'}
              </p>
              <Fold title="¿Por qué este puntaje?" hint={`${result.score} de 100 puntos`}>
                <div className="flex items-center gap-4">
                  <RadialScore score={result.score} critical={hasCritical} />
                  <div className="flex-1 space-y-1.5 text-sm">
                    {(
                      [
                        ['Contexto', result.steps.contexto],
                        ['Setup', result.steps.setup],
                        ['Complementos', result.steps.complementos],
                        ['Ejecución', result.steps.ejecucion],
                      ] as const
                    ).map(([l, s]) => (
                      <div key={l}>
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-dim">{l}</span>
                          <span className="font-num">
                            {s.earned}/{s.max}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 bg-white/10">
                          <div className="h-full bg-cyan-neon" style={{ width: `${(s.earned / s.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    {result.penalty > 0 && <div className="font-num text-xs text-warn">Penalización −{result.penalty}</div>}
                  </div>
                </div>
              </Fold>

              {result.critical.length > 0 && (
                <div className="space-y-2">
                  {result.critical.map((k) => (
                    <Notice key={k.id} tone="bear" title="No entres">
                      {k.text}
                    </Notice>
                  ))}
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((w) => (
                    <Notice key={w.id} tone="warn" title="Ojo">
                      {w.text}
                    </Notice>
                  ))}
                </div>
              )}

              {result.risk.valid && (
                <Panel title="Tu orden">
                  <div className="font-num grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="hud-label">Acciones</div>
                      <div className="text-xl font-bold text-cyan-neon">{result.risk.shares}</div>
                    </div>
                    <div>
                      <div className="hud-label">Entrada</div>
                      <div className="text-xl font-bold">${c.entry?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="hud-label">Stop</div>
                      <div className="text-xl font-bold text-bear">${c.stop?.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs text-ink-dim">Riesgo {usd(result.risk.riskUsd)} · 1R = {usd(profile.r_value, 0)}</div>
                </Panel>
              )}

              {!result.ready && <Notice tone="info" title="Te falta llenar">{result.missing.join(' · ')}</Notice>}

              <button
                className={cx('btn-primary w-full', confirmBroken && '!bg-bear !text-white !shadow-glow-bear')}
                disabled={!result.ready || saving}
                onClick={register}
              >
                <Save size={18} />
                {confirmBroken ? 'Sí, registrarlo de todas formas' : 'Registrar entrada'}
              </button>
              {confirmBroken && (
                <p className="text-center text-xs text-bear">Se guardará marcado con las reglas que rompió, para que veas cuánto te cuesta.</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navegación inferior del wizard */}
      <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-white/5 bg-void/90 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl gap-2">
          <button className="btn-ghost w-24" disabled={step === 0} onClick={() => go(step - 1)}>
            <ChevronLeft size={18} /> Atrás
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary flex-1" onClick={() => go(step + 1)}>
              {STEPS[step + 1]} <ChevronRight size={18} />
            </button>
          ) : (
            <button className="btn-primary flex-1" disabled={!result.ready || saving} onClick={register}>
              <Save size={18} /> {confirmBroken ? 'Confirmar' : 'Registrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
