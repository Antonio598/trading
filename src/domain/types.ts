export type Direction = 'long' | 'short';
export type Instrument = 'stock' | 'option';
export type Timeframe = 1 | 2 | 5 | 15 | 60;
export type TrendType = 'regular' | 'poder' | 'super' | 'lateral' | 'contra';
export type MaState = 'estrecho' | 'neutral' | 'amplio';
export type StopType = 'evento' | 'mlpt' | 'elefante';
export type TrailingMethod = 'vela' | '8mm' | '20mm' | 'vela_grande';
export type Verdict = 'aplus' | 'aceptable' | 'no_operar';
export type ExitReason = 't1' | 't2' | 't3' | 'trailing' | 'stop' | 'break_even' | 'manual' | 'fin_dia';
export type Emotion = 'tranquilo' | 'ansioso' | 'fomo' | 'venganza' | 'miedo' | 'sobreconfiado' | 'aburrido';

export type SetupId =
  | 'velez'
  | 'regalo'
  | 'momentum'
  | 'gbr'
  | 'nb'
  | 'nrb'
  | 'cola'
  | 'climatico'
  | 'rompimiento'
  | 't180'
  | 'ignorada'
  | 'bmg';

export type LocationId =
  | 'sr'
  | 'pivote'
  | '8mm'
  | '20mm'
  | '200mm'
  | 'ret50'
  | 'ret33'
  | 'pdc'
  | 'lejos20';

/** Texto que cambia según la dirección. Un string simple vale para ambas. */
export type DirText = string | { long: string; short: string };

export function dt(text: DirText, dir: Direction): string {
  return typeof text === 'string' ? text : text[dir];
}

export interface Profile {
  id?: string;
  account_size: number;
  r_value: number;
  max_daily_loss: number;
  mlpt: number;
  max_trades_day: number | null;
  timeframes: Timeframe[];
  reduce_motion: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  account_size: 0,
  r_value: 0,
  max_daily_loss: 0,
  mlpt: 0,
  max_trades_day: null,
  timeframes: [1, 2, 5],
  reduce_motion: false,
};

/** Estado completo de la checklist (se guarda tal cual en checklist_json). */
export interface ChecklistState {
  symbol: string;
  /** Acciones u opciones (en opciones: entrada/stop son primas y la cantidad son contratos). */
  instrument: Instrument;
  direction: Direction;
  timeframe: Timeframe;
  // Paso 1 — contexto
  chartOk: boolean;
  masVisible: boolean;
  trendType: TrendType | null;
  with20: boolean;
  maState: MaState | null;
  transition: boolean;
  higherTf: boolean;
  // Paso 2 — setup
  setup: SetupId | null;
  criteria: Record<string, boolean>;
  // Paso 3 — complementos
  reversalSignal: boolean;
  locations: LocationId[];
  /** Tiempo de reversa marcado: mayor (10:00, 11:15–11:30, 2:15–2:30) o menor. */
  reversalTime: 'major' | 'minor' | null;
  volume: boolean;
  law3: boolean;
  law5: boolean;
  // Paso 4 — ejecución
  entry: number | null;
  stop: number | null;
  pivot: number | null;
  retraceExtreme: number | null;
  entryPenny: boolean;
  stopType: StopType;
  stopAt200: boolean;
  earlyEntry: boolean;
  tifOk: boolean;
  extremeEliminated: boolean;
  // Paso 5 — manejo
  trailing: TrailingMethod;
  breakEven: boolean;
}

export const EMPTY_CHECKLIST: ChecklistState = {
  symbol: '',
  instrument: 'stock',
  direction: 'long',
  timeframe: 5,
  chartOk: false,
  masVisible: false,
  trendType: null,
  with20: false,
  maState: null,
  transition: false,
  higherTf: false,
  setup: null,
  criteria: {},
  reversalSignal: false,
  locations: [],
  reversalTime: null,
  volume: false,
  law3: false,
  law5: false,
  entry: null,
  stop: null,
  pivot: null,
  retraceExtreme: null,
  entryPenny: false,
  stopType: 'evento',
  stopAt200: false,
  earlyEntry: false,
  tifOk: false,
  extremeEliminated: false,
  trailing: 'vela',
  breakEven: true,
};

export interface TradeRow {
  id: string;
  client_id: string;
  user_id?: string;
  created_at: string;
  symbol: string;
  /** Ausente en trades viejos = acciones. */
  instrument?: Instrument;
  /** 1 en acciones, 100 en opciones. */
  multiplier?: number;
  direction: Direction;
  timeframe: Timeframe;
  setup: SetupId;
  trend_type: TrendType;
  ma_state: MaState;
  state_transition: boolean;
  entry: number;
  stop: number;
  stop_type: StopType;
  shares: number;
  risk_usd: number;
  r_value: number;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  trailing_method: TrailingMethod;
  checklist_json: ChecklistState;
  quality_score: number;
  verdict: Verdict;
  critical_flags: string[];
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
}

export interface ExitRow {
  id: string;
  client_id: string;
  trade_id: string;
  created_at: string;
  price: number;
  shares: number;
  reason: ExitReason;
  pnl_usd: number;
  r_result: number;
}

export interface ReviewRow {
  trade_id: string;
  emotion: Emotion | null;
  execution_rating: number | null;
  errors: string[];
  note: string | null;
  screenshot_url: string | null;
}

export interface TradeRecord extends TradeRow {
  exits: ExitRow[];
  review: ReviewRow | null;
}
