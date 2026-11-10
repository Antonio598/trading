export interface ErrorGroup {
  id: string;
  label: string;
  items: { id: string; text: string }[];
}

export const ERROR_GROUPS: ErrorGroup[] = [
  {
    id: 'contexto',
    label: 'Contexto',
    items: [
      { id: 'contra_20_no_climatico', text: 'Operé contra la 20mm sin que fuera un setup climático.' },
      { id: 'lateral_con_tendencia', text: 'Operé en lateral con una estrategia de tendencia.' },
      { id: 'ignore_marco_mayor', text: 'Ignoré la inclinación del marco mayor.' },
      { id: 'persegui_precio', text: 'Compré lejos de la 20mm (persiguiendo el precio).' },
    ],
  },
  {
    id: 'senal',
    label: 'Señal',
    items: [
      { id: 'sin_senal_reversa', text: 'Entré sin una señal de reversa después de 3–5 velas.' },
      { id: 'sin_segunda_vela', text: 'Entré sin esperar la confirmación de una segunda vela (Ley #2).' },
      { id: 'elefante_agotamiento', text: 'Compré una vela elefante de agotamiento creyendo que era de ignición.' },
      { id: 'frente_sr', text: 'Entré frente a una resistencia o soporte cercano.' },
      { id: 'techo_vs_pausa', text: 'Confundí un techo con una pausa en un rompimiento.' },
    ],
  },
  {
    id: 'ejecucion',
    label: 'Ejecución',
    items: [
      { id: 'tif', text: 'No respeté el TIF (entré antes de tiempo).' },
      { id: 'entrada_tarde', text: 'Entré tarde, lejos del precio de activación.' },
      { id: 'stop_mal_lugar', text: 'Puse el stop en un mal lugar (en la 200mm o en un número redondo).' },
      { id: 'movi_stop', text: 'Moví el stop en contra.' },
      { id: 'sin_stop', text: 'No puse stop.' },
    ],
  },
  {
    id: 'riesgo',
    label: 'Riesgo',
    items: [
      { id: 'mas_acciones', text: 'Operé más acciones de las que me daba la R.' },
      { id: 'supere_mlpt', text: 'Superé la MLPT.' },
      { id: 'supere_perdida_diaria', text: 'Superé la pérdida máxima diaria.' },
      { id: 'limite_trades', text: 'Operé después de alcanzar mi límite de trades.' },
    ],
  },
  {
    id: 'manejo',
    label: 'Manejo',
    items: [
      { id: 'trailing_pronto', text: 'Activé el trailing demasiado pronto (antes de 2 velas).' },
      { id: 'sali_antes_t1', text: 'Salí antes de T1 por miedo.' },
      { id: 'sin_parciales', text: 'No tomé ganancias parciales.' },
      { id: 'sin_break_even', text: 'No moví a break even.' },
      { id: 'ignore_salida', text: 'Me quedé después de una señal de salida (TT, WRB o RBR mayor al 50%).' },
    ],
  },
  {
    id: 'psicologia',
    label: 'Psicología',
    items: [
      { id: 'fomo', text: 'FOMO.' },
      { id: 'venganza', text: 'Trade de venganza.' },
      { id: 'overtrading', text: 'Overtrading.' },
    ],
  },
];

export const ERROR_TEXT: Record<string, string> = Object.fromEntries(
  ERROR_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.text])),
);
