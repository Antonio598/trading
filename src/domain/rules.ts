import type { DirText, LocationId, Timeframe, TrailingMethod, TrendType, StopType, MaState } from './types';

/** Tarjetas de reglas que abre el ícono "?" de cada casilla. */
export interface RuleCard {
  title: string;
  body: DirText;
}

export const RULES: Record<string, RuleCard> = {
  grafico: {
    title: 'Gráfico insignia',
    body: 'El gráfico de 5 min es el insignia. El de 2 min se usa como "radiografía" para afinar la entrada.',
  },
  medias: {
    title: 'Medias móviles',
    body: 'Trabaja siempre con la 8mm, la 20mm y la 200mm visibles. La 20mm define la tendencia de trabajo; la 200mm actúa como imán.',
  },
  tendencia: {
    title: 'Tipos de tendencia',
    body:
      'Regular: acción > 20mm alcista. De Poder: acción > 20mm alcista > 200mm. Súper Tendencia: acción > 8mm alcista > 20mm alcista. Lateral: 20mm plana. Contra tendencia: solo setups climáticos (CDB/CAS).',
  },
  con20: {
    title: 'Opera a favor de la 20mm',
    body: 'La pendiente de la 20mm debe coincidir con tu dirección. Si más del 10% de tus entradas son contra tendencia, algo estás haciendo mal.',
  },
  estado: {
    title: 'Estado (20mm vs 200mm)',
    body:
      'Estrecho: las medias están juntas; los movimientos que nacen aquí son los más explosivos y fluidos. Amplio: la tendencia está extendida y la 200mm actúa como imán; mientras más separadas, más fuerte la reacción al llegar a ella.',
  },
  transicion: {
    title: 'Transición amplio → estrecho',
    body: 'La acción rompió la 20mm con fuerza, la 20mm sostuvo el rebote y las medias se juntaron. Es el origen de los mejores movimientos.',
  },
  marcoMayor: {
    title: 'Inclinación del marco mayor',
    body: 'El gráfico diario, de 60 min o de 15 min debe inclinarse en la misma dirección que tu operación.',
  },
  senalReversa: {
    title: 'Señal de reversa (regla crítica)',
    body: {
      long: 'En compras tras 3–5 velas de caída es obligatoria una señal de reversa: BT, GBR, NRB o NB.',
      short: 'En ventas tras 3–5 velas de rally es obligatoria una señal de reversa: TT, RBR, NRB o NB.',
    },
  },
  ubicacion: {
    title: 'Ubicación',
    body:
      'La señal vale más cuando aparece en una ubicación: soporte/resistencia, máximo o mínimo anterior, 8mm, 20mm, 200mm plana, retroceso del 50% o 33%, cierre del día anterior (PDC) o muy lejos de la 20mm. Cada coincidencia suma.',
  },
  tiempos: {
    title: 'Tiempos de reversa (ET)',
    body:
      '9:35, 10:00, 10:30, 11:15–11:30, 12:00, 1:30, 2:15–2:30, 3:00 y 3:30. Los mayores son 10:00, 11:15–11:30 y 2:15–2:30.',
  },
  volumen: {
    title: 'Volumen',
    body: 'Volumen creciente al final del movimiento refuerza la reversa (opcional).',
  },
  ley2: {
    title: 'Ley #2',
    body: 'Espera la confirmación de una segunda vela antes de entrar.',
  },
  ley3: {
    title: 'Ley #3',
    body: 'Los movimientos suelen durar 3–5 velas (o 5–8). Después de eso, busca la reversa.',
  },
  ley5: {
    title: 'Ley #5',
    body: 'La mejor entrada sale de una vela pequeña o de rango estrecho.',
  },
  entradaCentavo: {
    title: 'Entrada a $0.01',
    body: {
      long: 'Entra a $0.01 por encima del máximo de la vela anterior.',
      short: 'Entra a $0.01 por debajo del mínimo de la vela anterior.',
    },
  },
  stop: {
    title: 'Tipos de stop',
    body:
      'Por evento (por defecto): donde el setup queda invalidado. MLPT: tu pérdida máxima por trade. 2/3 de la vela elefante. Evita poner el stop en la 200mm o en un número redondo.',
  },
  tif: {
    title: 'TIF · Tiempo de entrada temprana',
    body:
      '1 y 2 min: no hay entrada temprana. 5 min: desde 4:52. 15 min: desde 14:30. 60 min: desde 57:00. En BT, TT y 180, si la vela ya eliminó el extremo de la anterior, el TIF se puede ignorar.',
  },
  r: {
    title: 'R constante',
    body: 'R es lo máximo que arriesgas por operación. Mantenla constante en la mayoría de los trades. Acciones = R ÷ riesgo por acción.',
  },
  objetivos: {
    title: 'Objetivos VBS / VSS',
    body: 'T1 = retroceso del 50%. T2 = pivote anterior. T3 = más allá del pivote.',
  },
  trailing: {
    title: 'Trailing',
    body:
      'Vela a vela: se activa tras 2 velas a favor (en Momentum, tras 1). También: 8mm, 20mm o de vela grande a vela grande. Mueve a break even en 1:1.',
  },
  salidas: {
    title: 'Salidas de la VBS',
    body: {
      long: 'Sal cuando: se toca el objetivo, aparece una cola de techo (TT), una vela de cuerpo amplio a favor, o una vela de reversa que elimina más del 50%.',
      short: 'Sal cuando: se toca el objetivo, aparece una cola de fondo (BT), una vela de cuerpo amplio a favor, o una vela de reversa que elimina más del 50%.',
    },
  },
  score: {
    title: 'Score de calidad y semáforo',
    body:
      'Cada casilla de la checklist suma puntos (0–100). Verde ≥ 80: trade A+. Amarillo 60–79: aceptable con advertencias. Rojo < 60 o cualquier regla crítica rota: NO OPERAR.',
  },
  mlpt: {
    title: 'MLPT · Pérdida máxima por trade',
    body: 'Debe estar entre el 25% y el 50% de tu pérdida máxima diaria.',
  },
};

export const WARN_AMPLIO =
  '¡Distancia amplia entre la 20mm y la 200mm llama a ser precavidos! La tendencia está extendida y la 200mm actúa como imán: mientras más separadas estén, más fuerte será la reacción al llegar a ella (sobre todo si está plana). Revisa si esto es un setup climático (CDB o CAS) o si estás entrando tarde.';
export const WARN_LATERAL = 'En lateral: compra debajo de la 20mm y vende encima. La ruptura empieza cuando la 20mm es obedecida.';
export const WARN_CONTRA = 'Si más del 10% de tus entradas son contra tendencia, algo estás haciendo mal. Solo CDB o CAS.';
export const TIP_ESTRECHO =
  'Los movimientos que nacen de un estado estrecho son los más explosivos y fluidos. Tus mejores operaciones vendrán de aquí.';

export const TREND_OPTIONS: { id: TrendType; label: string; desc: DirText }[] = [
  { id: 'regular', label: 'Regular', desc: { long: 'Precio sobre la 20mm, que sube', short: 'Precio bajo la 20mm, que baja' } },
  { id: 'poder', label: 'De Poder', desc: { long: 'Además la 20mm está sobre la 200mm', short: 'Además la 20mm está bajo la 200mm' } },
  { id: 'super', label: 'Súper Tendencia', desc: { long: 'Precio sobre la 8mm y la 20mm, ambas suben', short: 'Precio bajo la 8mm y la 20mm, ambas bajan' } },
  { id: 'lateral', label: 'Lateral', desc: 'La 20mm está plana' },
  { id: 'contra', label: 'Contra tendencia', desc: 'Vas en contra · solo CDB / CAS' },
];

export const STATE_OPTIONS: { id: MaState; label: string; desc: string }[] = [
  { id: 'estrecho', label: 'Estrecho', desc: '20mm y 200mm juntas' },
  { id: 'neutral', label: 'Neutral', desc: 'Separación normal' },
  { id: 'amplio', label: 'Amplio', desc: 'Muy separadas' },
];

export const LOCATION_OPTIONS: { id: LocationId; label: DirText }[] = [
  { id: 'sr', label: { long: 'Soporte de precio', short: 'Resistencia de precio' } },
  { id: 'pivote', label: { long: 'Mínimo anterior', short: 'Máximo anterior' } },
  { id: '8mm', label: '8mm' },
  { id: '20mm', label: '20mm' },
  { id: '200mm', label: '200mm plana' },
  { id: 'ret50', label: 'Retroceso 50%' },
  { id: 'ret33', label: 'Retroceso 33%' },
  { id: 'pdc', label: 'Cierre día anterior (PDC)' },
  { id: 'lejos20', label: 'Muy lejos de la 20mm' },
];

export const STOP_OPTIONS: { id: StopType; label: string }[] = [
  { id: 'evento', label: 'Por evento' },
  { id: 'mlpt', label: 'MLPT' },
  { id: 'elefante', label: '2/3 vela elefante' },
];

export const TRAILING_OPTIONS: { id: TrailingMethod; label: string }[] = [
  { id: 'vela', label: 'Vela a vela' },
  { id: '8mm', label: '8mm' },
  { id: '20mm', label: '20mm' },
  { id: 'vela_grande', label: 'Vela grande a vela grande' },
];

export const TIF_RULE: Record<Timeframe, { early: boolean; text: string }> = {
  1: { early: false, text: 'Gráfico de 1 min: no hay entrada temprana. Espera el cierre de la vela.' },
  2: { early: false, text: 'Gráfico de 2 min: no hay entrada temprana. Espera el cierre de la vela.' },
  5: { early: true, text: 'Gráfico de 5 min: entrada temprana permitida desde 4:52 de la vela.' },
  15: { early: true, text: 'Gráfico de 15 min: entrada temprana permitida desde 14:30 de la vela.' },
  60: { early: true, text: 'Gráfico de 60 min: entrada temprana permitida desde 57:00 de la vela.' },
};

/** Textos de las reglas críticas que se muestran en rojo. */
export const CRITICAL_TEXT: Record<string, DirText> = {
  sin_senal_reversa: {
    long: 'Falta la señal de reversa. En compras tras 3–5 velas de caída es obligatoria (BT, GBR, NRB o NB).',
    short: 'Falta la señal de reversa. En ventas tras 3–5 velas de rally es obligatoria (TT, RBR, NRB o NB).',
  },
  contra_no_climatico: 'Contra tendencia solo se permiten setups climáticos (CDB o CAS).',
  no_cabe_en_r: 'Este trade no cabe en tu R: ni 1 acción (o 1 contrato) entra en tu riesgo. No se opera.',
  stop_invalido: {
    long: 'El stop debe estar por debajo de la entrada.',
    short: 'El stop debe estar por encima de la entrada.',
  },
  tif_roto: 'No respetas el TIF: entrada antes del cierre de la vela fuera del tiempo permitido.',
  limite_trades: 'Ya alcanzaste tu máximo de trades del día.',
  perdida_diaria: 'Ya alcanzaste tu pérdida máxima diaria. Se acabó el día.',
  sin_plan: 'Configura tu R en "Mi plan" antes de operar.',
};
