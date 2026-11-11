import { useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { Bucket, EquityPoint, ScorePoint } from '../domain/stats';
import { fmtR } from './hud/primitives';

export const C = {
  cyan: '#8B7CFF',
  bull: '#3DDC97',
  bear: '#FF6B7D',
  warn: '#F5B84A',
  dim: '#8A94A6',
  grid: 'rgba(138,148,166,0.12)',
  surface: '#17181E',
};
const signColor = (v: number) => (v >= 0 ? C.bull : C.bear);
const tick = { fill: C.dim, fontSize: 11, fontWeight: 600, fontFamily: 'Manrope, system-ui, sans-serif' };
const rTick = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Number(Math.abs(v).toFixed(1))}R`;

/* ─────────── Tooltip en panel de vidrio ─────────── */
function Glass({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lift"
      style={{ background: 'rgba(31,33,40,0.96)', backdropFilter: 'blur(10px)' }}
    >
      {children}
    </div>
  );
}

function BucketTip({ active, payload }: { active?: boolean; payload?: { payload: Bucket }[] }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <Glass>
      <div className="font-bold text-ink">{b.label}</div>
      <div className="font-num mt-0.5" style={{ color: signColor(b.netR) }}>
        {b.netR >= 0 ? '▲' : '▼'} {fmtR(b.netR)} neto
      </div>
      <div className="font-num text-ink-dim">
        {fmtR(b.avgR)} prom · {b.count} trade{b.count === 1 ? '' : 's'}
      </div>
    </Glass>
  );
}

/* ─────────── Barra con extremo de dato redondeado según el signo ─────────── */
function roundedPath(x: number, y: number, w: number, h: number, r: number, c: [boolean, boolean, boolean, boolean]) {
  const [tl, tr, br, bl] = c.map((k) => (k ? Math.min(r, w / 2, h / 2) : 0));
  return `M${x + tl},${y} H${x + w - tr} Q${x + w},${y} ${x + w},${y + tr} V${y + h - br} Q${x + w},${y + h} ${x + w - br},${y + h} H${x + bl} Q${x},${y + h} ${x},${y + h - bl} V${y + tl} Q${x},${y} ${x + tl},${y} Z`;
}

function SignedBar(horizontal: boolean) {
  return function Shape(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, value } = props as { x: number; y: number; width: number; height: number; value: number | number[] };
    const v = Array.isArray(value) ? value[1] - value[0] : value;
    const left = Math.min(x, x + width);
    const top = Math.min(y, y + height);
    const w = Math.abs(width);
    const h = Math.abs(height);
    if (w < 0.5 || h < 0.5) return <g />;
    const pos = v >= 0;
    const corners: [boolean, boolean, boolean, boolean] = horizontal
      ? pos
        ? [false, true, true, false]
        : [true, false, false, true]
      : pos
        ? [true, true, false, false]
        : [false, false, true, true];
    return <path d={roundedPath(left, top, w, h, 4, corners)} fill={signColor(v)} />;
  };
}
const VBar = SignedBar(false);
const HBar = SignedBar(true);

/* ─────────── Tabla accesible bajo cada gráfica ─────────── */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer select-none text-ink-dim hover:text-accent">Ver tabla</summary>
      <table className="font-num mt-2 w-full">
        <thead>
          <tr className="text-left text-ink-dim">
            {head.map((h) => (
              <th key={h} className="py-1 pr-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className="py-1 pr-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* ─────────── Curva de equity en R ─────────── */
export function EquityChart({ data }: { data: EquityPoint[] }) {
  const reduce = !!useReducedMotion();
  const last = data[data.length - 1]?.cum ?? 0;
  const color = last >= 0 ? C.cyan : C.bear;
  return (
    <div className="h-52" role="img" aria-label={`Curva de equity: ${data.length} trades, acumulado ${fmtR(last)}`}>
      <ResponsiveContainer>
        <AreaChart data={[{ n: 0, label: 'Inicio', r: 0, cum: 0 }, ...data]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="n" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={rTick} width={44} />
          <ReferenceLine y={0} stroke={C.dim} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: C.cyan, strokeOpacity: 0.4 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Glass>
                  <div className="font-bold text-ink">{(payload[0].payload as EquityPoint).label}</div>
                  <div className="font-num" style={{ color: signColor((payload[0].payload as EquityPoint).r) }}>
                    Trade {fmtR((payload[0].payload as EquityPoint).r)}
                  </div>
                  <div className="font-num text-ink">Acumulado {fmtR((payload[0].payload as EquityPoint).cum)}</div>
                </Glass>
              ) : null
            }
          />
          <Area
            type="linear"
            dataKey="cum"
            stroke={color}
            strokeWidth={2}
            fill="url(#eqFill)"
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: C.surface, strokeWidth: 2 }}
            isAnimationActive={!reduce}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────── Barras verticales de R por categoría (estado, hora) ─────────── */
export function RBarChart({ data, markKeys, height = 200 }: { data: Bucket[]; markKeys?: Set<string>; height?: number }) {
  const reduce = !!useReducedMotion();
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label} ${fmtR(d.netR)}`).join(', ')}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="key"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={(p: { x: number; y: number; payload: { value: string } }) => {
              const b = data.find((d) => d.key === p.payload.value);
              const mark = markKeys?.has(p.payload.value);
              return (
                <text x={p.x} y={p.y + 12} textAnchor="middle" {...tick} fill={mark ? C.cyan : C.dim}>
                  {b?.label}
                  {mark ? '◆' : ''}
                </text>
              );
            }}
          />
          <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={rTick} width={44} />
          <ReferenceLine y={0} stroke={C.dim} />
          <Tooltip cursor={{ fill: 'rgba(0,229,255,0.06)' }} content={<BucketTip />} />
          <Bar dataKey="netR" shape={VBar} isAnimationActive={!reduce} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────── Barras horizontales ranqueadas (setup, emoción) ─────────── */
function RankLabel(props: unknown) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props as { x: number; y: number; width: number; height: number; value: number };
  // En barras negativas recharts entrega x en el cero: la etiqueta va a la derecha del cero, no sobre el nombre.
  const tx = value >= 0 ? x + width + 6 : x + 6;
  return (
    <text x={tx} y={y + height / 2} dy={4} fontSize={11} fontWeight={700} fontFamily="Manrope, system-ui, sans-serif" fill={value >= 0 ? C.bull : C.bear}>
      {fmtR(value)}
    </text>
  );
}

export function RRankChart({ data }: { data: Bucket[] }) {
  const reduce = !!useReducedMotion();
  const height = Math.max(120, data.length * 36 + 30);
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label} ${fmtR(d.netR)}`).join(', ')}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={rTick} />
          <YAxis type="category" dataKey="label" tick={{ ...tick, fill: 'rgba(255,255,255,0.85)' }} axisLine={false} tickLine={false} width={86} />
          <ReferenceLine x={0} stroke={C.dim} />
          <Tooltip cursor={{ fill: 'rgba(0,229,255,0.06)' }} content={<BucketTip />} />
          <Bar
            dataKey="netR"
            shape={HBar}
            isAnimationActive={!reduce}
            maxBarSize={22}
            label={RankLabel}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────── Score vs R ─────────── */
export function ScoreScatter({ data }: { data: ScorePoint[] }) {
  const reduce = !!useReducedMotion();
  return (
    <div className="h-56" role="img" aria-label={`Score contra resultado en R, ${data.length} trades`}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} />
          <XAxis type="number" dataKey="score" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={tick} axisLine={false} tickLine={false} name="Score" />
          <YAxis type="number" dataKey="r" tick={tick} axisLine={false} tickLine={false} tickFormatter={rTick} width={44} name="R" />
          <ZAxis range={[64, 64]} />
          <ReferenceLine y={0} stroke={C.dim} />
          <ReferenceLine x={60} stroke={C.warn} strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '60', position: 'insideTopLeft', ...tick, fill: C.warn }} />
          <ReferenceLine x={80} stroke={C.bull} strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '80', position: 'insideTopLeft', ...tick, fill: C.bull }} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: C.cyan }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScorePoint;
              return (
                <Glass>
                  <div className="font-bold text-ink">{p.symbol}</div>
                  <div className="font-num text-ink">Score {p.score}</div>
                  <div className="font-num" style={{ color: signColor(p.r) }}>
                    {fmtR(p.r)}
                  </div>
                </Glass>
              );
            }}
          />
          <Scatter data={data} isAnimationActive={!reduce}>
            {data.map((d, i) => (
              <Cell key={i} fill={signColor(d.r)} stroke={C.surface} strokeWidth={2} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
