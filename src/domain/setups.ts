import type { DirText, SetupId } from './types';

export interface Criterion {
  id: string;
  text: DirText;
  optional?: boolean;
}

export interface SetupDef {
  id: SetupId;
  label: DirText;
  short: DirText;
  criteria: Criterion[];
  /** Setup de continuación: penaliza en estado amplio. */
  continuation?: boolean;
  /** Setup climático: único permitido contra tendencia. */
  climactic?: boolean;
  /** Nace tras 3–5 velas en contra: exige señal de reversa. */
  pullback?: boolean;
  /** El setup ES una señal de reversa (marca la casilla automáticamente). */
  isSignal?: boolean;
  /** TIF ignorable si la vela ya eliminó el extremo de la anterior. */
  tifIgnorable?: boolean;
  /** Trailing vela a vela tras 1 vela (en vez de 2). */
  fastTrail?: boolean;
}

const tras35: Criterion = {
  id: 'tras35',
  text: { long: 'Tras 3–5 velas en contra (de caída)', short: 'Tras 3–5 velas en contra (de rally)' },
};

export const SETUPS: SetupDef[] = [
  {
    id: 'velez',
    label: { long: 'VBS · Compra Velez', short: 'VSS · Venta Velez' },
    short: { long: 'VBS', short: 'VSS' },
    continuation: true,
    pullback: true,
    criteria: [
      {
        id: 'sobre20',
        text: {
          long: 'Acción alcista sobre la 20mm (ideal 20mm > 200mm)',
          short: 'Acción bajista bajo la 20mm (ideal 20mm < 200mm)',
        },
      },
      {
        id: 'retroceso',
        text: {
          long: '3+ máximos más bajos y mínimos más bajos, o 3+ velas rojas (2 valen en tendencias muy poderosas)',
          short: '3+ máximos más altos y mínimos más altos, o 3+ velas verdes (2 valen en tendencias muy poderosas)',
        },
      },
    ],
  },
  {
    id: 'regalo',
    label: { long: 'Compra de Regalo', short: 'Venta de Regalo' },
    short: 'Regalo',
    criteria: [
      { id: 'elefante', text: { long: 'Hubo una vela elefante alcista fuerte', short: 'Hubo una vela elefante bajista fuerte' } },
      { id: 'rango', text: 'El retroceso está dentro del rango de la elefante' },
      {
        id: 'elimina',
        text: {
          long: 'Una vela verde elimina el 100% de la vela contraria',
          short: 'Una vela roja elimina el 100% de la vela contraria',
        },
      },
    ],
  },
  {
    id: 'momentum',
    label: { long: 'Compra de Momentum', short: 'Venta de Momentum' },
    short: 'Momentum',
    continuation: true,
    fastTrail: true,
    criteria: [
      { id: 'ignicion', text: 'Vela de ignición parecida a control absoluto' },
      {
        id: 'vacio',
        text: {
          long: 'Hay vacío de precio (sin resistencia cercana)',
          short: 'Hay vacío de precio (sin soporte cercano)',
        },
      },
      {
        id: 'entrada',
        text: {
          long: 'Entrada al superar el máximo de la vela de ignición',
          short: 'Entrada al perforar el mínimo de la vela de ignición',
        },
      },
    ],
  },
  {
    id: 'gbr',
    label: { long: 'GBR · Barra verde de reversa', short: 'RBR · Barra roja de reversa' },
    short: { long: 'GBR', short: 'RBR' },
    pullback: true,
    isSignal: true,
    criteria: [tras35, { id: 'retrocede', text: 'La vela de reversa retrocede la vela anterior' }],
  },
  {
    id: 'nb',
    label: 'NB · Cuerpo estrecho',
    short: 'NB',
    pullback: true,
    isSignal: true,
    criteria: [tras35, { id: 'cuerpo', text: 'Cuerpo estrecho de cualquier color' }],
  },
  {
    id: 'nrb',
    label: 'NRB · Rango estrecho',
    short: 'NRB',
    pullback: true,
    isSignal: true,
    criteria: [tras35, { id: 'rango', text: 'Vela de rango estrecho (de cualquier color)' }],
  },
  {
    id: 'cola',
    label: { long: 'BT · Cola de fondo', short: 'TT · Cola de techo' },
    short: { long: 'BT', short: 'TT' },
    pullback: true,
    isSignal: true,
    tifIgnorable: true,
    criteria: [
      tras35,
      {
        id: 'cola',
        text: {
          long: 'La cola inferior es 2/3 o más del rango de la vela',
          short: 'La cola superior es 2/3 o más del rango de la vela',
        },
      },
    ],
  },
  {
    id: 'climatico',
    label: { long: 'CDB · Compra climática', short: 'CAS · Venta climática' },
    short: { long: 'CDB', short: 'CAS' },
    climactic: true,
    pullback: true,
    criteria: [
      { id: 'lejos', text: 'Muy lejos de la 20mm (mejor si también lejos de la 200mm)' },
      {
        id: 'senal',
        text: {
          long: 'Señal de reversa (BT, GBR, NRB o NB)',
          short: 'Señal de reversa (TT, RBR, NRB o NB)',
        },
      },
      { id: 'volumen', text: 'Volumen alto', optional: true },
      { id: 'tiempo', text: 'En un tiempo de reacción' },
    ],
  },
  {
    id: 'rompimiento',
    label: { long: 'BOP · Rompimiento al alza', short: 'BDP · Rompimiento a la baja' },
    short: { long: 'BOP', short: 'BDP' },
    continuation: true,
    criteria: [
      { id: 'base3', text: 'Base de al menos 3 altos y bajos relativamente iguales' },
      { id: 'estrecha', text: 'Base estrecha y ajustada' },
      { id: 'pequenas', text: 'Velas pequeñas' },
      { id: 'volumen', text: 'Volumen ligero en la base' },
      { id: 'mas', text: '8mm / 20mm a favor' },
      { id: 'contacto', text: 'Rompimiento cerca del contacto con la 8mm / 20mm' },
    ],
  },
  {
    id: 't180',
    label: { long: 'Toro 180', short: 'Oso 180' },
    short: { long: 'Toro 180', short: 'Oso 180' },
    tifIgnorable: true,
    criteria: [
      {
        id: 'previa',
        text: {
          long: 'Vela anterior muy bajista, con apertura en su extremo',
          short: 'Vela anterior muy alcista, con apertura en su extremo',
        },
      },
      { id: 'revierte', text: 'La vela actual la revierte' },
    ],
  },
  {
    id: 'ignorada',
    label: { long: 'RBI · Vela roja ignorada', short: 'GBI · Vela verde ignorada' },
    short: { long: 'RBI', short: 'GBI' },
    criteria: [
      { id: 'v1', text: { long: 'Vela 1 alcista a favor', short: 'Vela 1 bajista a favor' } },
      {
        id: 'v2',
        text: {
          long: 'Vela 2 roja que se queda en el tercio superior sin superar el mínimo de la vela 1',
          short: 'Vela 2 verde que se queda en el tercio inferior sin superar el máximo de la vela 1',
        },
      },
      {
        id: 'entrada',
        text: { long: 'Entrada al romper el máximo de la vela 2', short: 'Entrada al romper el mínimo de la vela 2' },
      },
    ],
  },
  {
    id: 'bmg',
    label: { long: '+BMG · Gap monstruo alcista', short: '−BMG · Gap monstruo bajista' },
    short: { long: '+BMG', short: '−BMG' },
    criteria: [
      { id: 'v1', text: { long: 'Vela 1 diaria sólida bajista', short: 'Vela 1 diaria sólida alcista' } },
      {
        id: 'gap',
        text: {
          long: 'La vela 2 abre por encima del máximo de la vela 1',
          short: 'La vela 2 abre por debajo del mínimo de la vela 1',
        },
      },
      {
        id: 'entrada',
        text: {
          long: 'Entrada sobre el máximo de la 1ª vela de 2 o 5 min, o en la VBS antes de las 10:00',
          short: 'Entrada bajo el mínimo de la 1ª vela de 2 o 5 min, o en la VSS antes de las 10:00',
        },
      },
    ],
  },
];

export const SETUP_BY_ID: Record<SetupId, SetupDef> = Object.fromEntries(SETUPS.map((s) => [s.id, s])) as Record<
  SetupId,
  SetupDef
>;
