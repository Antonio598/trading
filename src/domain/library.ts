import { RULES } from './rules';
import { SETUPS } from './setups';
import { dt, type DirText, type Direction } from './types';

export interface LibraryCard {
  id: string;
  title: DirText;
  body: DirText;
  /** Lista opcional de puntos (p. ej. criterios de un setup). */
  points?: { text: DirText; optional?: boolean }[];
  tags?: string[];
}

export interface LibrarySection {
  id: string;
  title: string;
  hint: string;
  cards: LibraryCard[];
}

const rule = (id: string): LibraryCard => ({ id, title: RULES[id].title, body: RULES[id].body });

export const LIBRARY: LibrarySection[] = [
  {
    id: 'basico',
    title: 'Empieza aquí',
    hint: 'Lo mínimo para usar la app',
    cards: [rule('r'), rule('score'), rule('mlpt')],
  },
  {
    id: 'tendencia',
    title: 'Tendencia y líneas',
    hint: 'Cómo leer el gráfico antes de entrar',
    cards: [rule('grafico'), rule('medias'), rule('tendencia'), rule('con20'), rule('estado'), rule('transicion'), rule('marcoMayor')],
  },
  {
    id: 'leyes',
    title: 'Leyes del mercado',
    hint: 'Las que usa la checklist',
    cards: [rule('ley2'), rule('ley3'), rule('ley5')],
  },
  {
    id: 'senales',
    title: 'Señales, ubicación y horarios',
    hint: 'Lo que confirma una entrada',
    cards: [rule('senalReversa'), rule('ubicacion'), rule('tiempos'), rule('volumen')],
  },
  {
    id: 'setups',
    title: 'Setups',
    hint: 'Qué debe cumplir cada patrón',
    cards: SETUPS.map((s) => ({
      id: `setup-${s.id}`,
      title: s.label,
      body: [
        s.continuation ? 'Setup de continuación: evítalo cuando las líneas estén muy separadas (estado amplio).' : '',
        s.climactic ? 'Setup climático: es el único que se permite contra tendencia.' : '',
        s.isSignal ? 'Este patrón ya cuenta como señal de reversa.' : '',
        s.tifIgnorable ? 'Si la vela ya eliminó el extremo de la anterior, puedes entrar antes de que cierre.' : '',
        s.fastTrail ? 'El trailing vela a vela empieza tras 1 vela a favor.' : '',
      ]
        .filter(Boolean)
        .join(' ') || 'Marca cada punto en la checklist antes de entrar.',
      points: s.criteria.map((c) => ({ text: c.text, optional: c.optional })),
      tags: [dt(s.short, 'long'), dt(s.short, 'short')],
    })),
  },
  {
    id: 'entrada',
    title: 'Entrada y stop',
    hint: 'Cómo entrar y dónde salir si sale mal',
    cards: [rule('entradaCentavo'), rule('tif'), rule('stop')],
  },
  {
    id: 'salida',
    title: 'Salida',
    hint: 'Cómo tomar ganancias',
    cards: [rule('objetivos'), rule('trailing'), rule('salidas')],
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Busca en título, texto, puntos y etiquetas (sin importar acentos). */
export function searchLibrary(q: string, dir: Direction): LibrarySection[] {
  const nq = norm(q.trim());
  if (!nq) return LIBRARY;
  return LIBRARY.map((sec) => ({
    ...sec,
    cards: sec.cards.filter((c) =>
      norm(
        [dt(c.title, dir), dt(c.body, dir), ...(c.points ?? []).map((p) => dt(p.text, dir)), ...(c.tags ?? [])].join(' '),
      ).includes(nq),
    ),
  })).filter((s) => s.cards.length > 0);
}
