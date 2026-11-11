import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, OctagonX, RotateCcw, Save, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadialScore, ScanVerdict, scoreColor } from '../../components/hud/gauges';
import { Fold, Notice, Panel, cx, helpDirection, usd, vibrate } from '../../components/hud/primitives';
import { calcTargets, multiplierOf } from '../../domain/risk';
import { evaluate } from '../../domain/score';
import { SETUP_BY_ID } from '../../domain/setups';
import { dt, type TradeRecord } from '../../domain/types';
import { useChecklist } from '../../state/checklist';
import { dayStats, useJournal } from '../../state/journal';
import { StepComplementos, StepContexto, StepEjecucion, StepManejo, StepSetup } from './Steps';

const STEPS = ['Tendencia', 'Patrón', 'Confirmación', 'Entrada', 'Salida', 'Resultado'];

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
      instrument: c.instrument ?? 'stock',
      multiplier: multiplierOf(c.instrument),
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
    <div className="pb-40">
      {/* Título y pasos */}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-dim">
              Paso {step + 1} de {STEPS.length}
              {c.symbol ? ` · ${c.symbol}` : ''}
              {setup ? ` · ${dt(setup.short, c.direction)}` : ''}
            </p>
            <h1 className="mt-0.5 text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink">{STEPS[step]}</h1>
          </div>
          {step === 0 && (
            <div className="flex shrink-0 gap-2">
              {template && (
                <button className="btn-ghost !min-h-[40px] !rounded-full !px-4 !text-[13px]" onClick={applyTemplate}>
                  <Zap size={15} /> Repetir último
                </button>
              )}
              <button className="btn-ghost !min-h-[40px] !w-10 !rounded-full !px-0" onClick={() => reset(c.timeframe)} aria-label="Empezar de cero">
                <RotateCcw size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Pasos">
          {STEPS.map((sName, i) => (
            <button
              key={sName}
              role="tab"
              aria-selected={i === step}
              aria-label={`Paso ${i + 1}: ${sName}`}
              onClick={() => go(i)}
              className={cx('h-1.5 flex-1 rounded-full transition-colors', i === step ? 'bg-accent' : i < step ? 'bg-accent/45' : 'bg-void-3')}
            />
          ))}
        </div>
      </div>

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
              <p className="px-1 text-[16px] leading-snug text-ink/90">
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
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-void-3">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${(s.earned / s.max) * 100}%` }} />
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
                  <div className="font-num grid grid-cols-3 gap-2">
                    <div>
                      <div className="hud-label">{c.instrument === 'option' ? 'Contratos' : 'Acciones'}</div>
                      <div className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-ink">{result.risk.shares}</div>
                    </div>
                    <div>
                      <div className="hud-label">{c.instrument === 'option' ? 'Prima' : 'Entrada'}</div>
                      <div className="mt-1 text-[22px] font-extrabold tracking-[-0.03em]">${c.entry?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="hud-label">Stop</div>
                      <div className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-bear">${c.stop?.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[13px] text-ink-dim">Si toca tu stop pierdes {usd(result.risk.riskUsd)}. Tu R es {usd(profile.r_value, 0)}.</div>
                </Panel>
              )}

              {!result.ready && <Notice tone="info" title="Te falta llenar">{result.missing.join(' · ')}</Notice>}

              <button
                className={cx('btn-primary w-full', confirmBroken && '!bg-bear')}
                disabled={!result.ready || saving}
                onClick={register}
              >
                <Save size={18} />
                {confirmBroken ? 'Sí, registrarlo de todas formas' : 'Registrar entrada'}
              </button>
              {confirmBroken && (
                <p className="text-[13px] text-bear">Se guardará marcado con las reglas que rompió, para que veas cuánto te cuesta.</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barra inferior: puntaje en vivo + navegación */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 border-t border-white/[0.05] bg-void-2/95 px-5 pb-3 pt-2.5 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          {hasCritical && step < 5 && (
            <button onClick={() => go(5)} className="mb-2 flex w-full items-center gap-2 truncate rounded-full bg-bear/[0.12] px-3 py-1.5 text-left text-[12px] font-semibold text-bear" role="status">
              <OctagonX size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{result.critical[0].text}</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <RadialScore score={result.score} critical={hasCritical} size={48} />
            <div className="mr-auto hidden min-w-0 sm:block">
              <div className="text-[13px] font-bold" style={{ color }}>
                {hasCritical ? 'Regla rota' : result.verdict === 'aplus' ? 'Trade A+' : result.verdict === 'aceptable' ? 'Aceptable' : 'Puntaje bajo'}
              </div>
              <div className="text-[12px] text-ink-dim">Puntaje en vivo</div>
            </div>
            <button className="btn-ghost !w-12 shrink-0 !px-0" disabled={step === 0} onClick={() => go(step - 1)} aria-label="Paso anterior">
              <ChevronLeft size={20} />
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn-primary min-w-0 flex-1 sm:flex-none sm:px-8" onClick={() => go(step + 1)}>
                <span className="truncate">{STEPS[step + 1]}</span> <ChevronRight size={18} className="shrink-0" />
              </button>
            ) : (
              <button
                className={cx('btn-primary min-w-0 flex-1 sm:flex-none sm:px-8', confirmBroken && '!bg-bear')}
                disabled={!result.ready || saving}
                onClick={register}
              >
                <Save size={18} /> {confirmBroken ? 'Confirmar' : 'Registrar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
