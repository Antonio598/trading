import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SETUP_BY_ID } from '../domain/setups';
import { EMPTY_CHECKLIST, type ChecklistState, type Timeframe } from '../domain/types';

/** Lo que se repite con "Plantilla rápida". */
export type Template = Pick<
  ChecklistState,
  'symbol' | 'direction' | 'timeframe' | 'setup' | 'trendType' | 'maState' | 'stopType' | 'trailing' | 'chartOk' | 'masVisible'
>;

interface ChecklistStore {
  c: ChecklistState;
  step: number;
  template: Template | null;
  patch(p: Partial<ChecklistState>): void;
  toggleCriterion(id: string): void;
  setStep(n: number): void;
  reset(defaultTf?: Timeframe): void;
  saveTemplate(): void;
  applyTemplate(): void;
}

export const useChecklist = create<ChecklistStore>()(
  persist(
    (set, get) => ({
      c: EMPTY_CHECKLIST,
      step: 0,
      template: null,
      patch(p) {
        const next = { ...get().c, ...p };
        // Cambiar de setup limpia sus criterios; los setups que son señal marcan la reversa.
        if (p.setup !== undefined && p.setup !== get().c.setup) {
          next.criteria = {};
          if (p.setup && SETUP_BY_ID[p.setup].isSignal) next.reversalSignal = true;
          if (p.setup === 'momentum') next.trailing = 'vela';
        }
        set({ c: next });
      },
      toggleCriterion(id) {
        const c = get().c;
        set({ c: { ...c, criteria: { ...c.criteria, [id]: !c.criteria[id] } } });
      },
      setStep(step) {
        set({ step });
      },
      reset(defaultTf) {
        set({ c: { ...EMPTY_CHECKLIST, timeframe: defaultTf ?? EMPTY_CHECKLIST.timeframe }, step: 0 });
      },
      saveTemplate() {
        const c = get().c;
        set({
          template: {
            symbol: c.symbol,
            direction: c.direction,
            timeframe: c.timeframe,
            setup: c.setup,
            trendType: c.trendType,
            maState: c.maState,
            stopType: c.stopType,
            trailing: c.trailing,
            chartOk: c.chartOk,
            masVisible: c.masVisible,
          },
        });
      },
      applyTemplate() {
        const t = get().template;
        if (!t) return;
        const isSignal = t.setup ? !!SETUP_BY_ID[t.setup].isSignal : false;
        set({ c: { ...EMPTY_CHECKLIST, ...t, reversalSignal: isSignal }, step: 0 });
      },
    }),
    { name: 'vj-checklist', version: 1 },
  ),
);
