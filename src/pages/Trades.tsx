import { ArrowDownRight, ArrowUpRight, Download, OctagonX, Plus } from 'lucide-react';
import { tradesToCsv } from '../domain/csv';
import { downloadText } from '../lib/download';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RadialScore } from '../components/hud/gauges';
import { Panel, Stat, cx, fmtR, price, usd } from '../components/hud/primitives';
import { SETUP_BY_ID } from '../domain/setups';
import { etDayKey } from '../domain/time';
import { dt, type TradeRecord } from '../domain/types';
import { dayStats, tradeTotals, useJournal } from '../state/journal';

function DirBadge({ t }: { t: TradeRecord }) {
  const long = t.direction === 'long';
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-bold uppercase', long ? 'text-bull' : 'text-bear')}>
      {long ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {long ? 'Largo' : 'Corto'}
    </span>
  );
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'America/New_York', day: '2-digit', month: 'short' }).format(new Date(iso));

export function Trades() {
  const { trades, profile } = useJournal();
  const open = trades.filter((t) => t.status === 'open');
  const closed = trades.filter((t) => t.status === 'closed');
  const day = useMemo(() => dayStats(trades), [trades]);
  const rToday = useMemo(() => {
    const today = etDayKey();
    return trades.flatMap((t) => t.exits).filter((e) => etDayKey(e.created_at) === today).reduce((a, e) => a + Number(e.r_result), 0);
  }, [trades]);
  const lossLeft = profile ? profile.max_daily_loss + day.pnlToday : 0;

  return (
    <div className="space-y-3 pb-24">
      <Panel title="Hoy">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Trades"
            value={`${day.tradesToday}${profile?.max_trades_day ? `/${profile.max_trades_day}` : ''}`}
            tone={profile?.max_trades_day && day.tradesToday >= profile.max_trades_day ? 'bear' : undefined}
          />
          <Stat label="R neto" value={fmtR(rToday)} tone={rToday > 0 ? 'bull' : rToday < 0 ? 'bear' : undefined} />
          <Stat label="P&L" value={usd(day.pnlToday, 0)} tone={day.pnlToday > 0 ? 'bull' : day.pnlToday < 0 ? 'bear' : undefined} />
        </div>
        {profile && profile.max_daily_loss > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-ink-dim">
              <span>Pérdida diaria usada</span>
              <span className="font-num">{usd(Math.max(0, -day.pnlToday), 0)} / {usd(profile.max_daily_loss, 0)}</span>
            </div>
            <div className="mt-1 h-1.5 bg-white/10">
              <div
                className={cx('h-full', lossLeft <= 0 ? 'bg-bear' : -day.pnlToday > profile.max_daily_loss * 0.5 ? 'bg-warn' : 'bg-bull')}
                style={{ width: `${Math.min(100, (Math.max(0, -day.pnlToday) / profile.max_daily_loss) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </Panel>

      <div className="flex items-center justify-between">
        <h2 className="hud-label text-cyan-neon">Abiertos · {open.length}</h2>
        <Link to="/" className="btn-ghost !min-h-[40px] !px-3 !text-xs">
          <Plus size={14} /> Nuevo
        </Link>
      </div>
      {open.length === 0 && <p className="text-sm text-ink-dim">No tienes trades abiertos.</p>}
      {open.map((t) => {
        const { closedShares } = tradeTotals(t);
        return (
          <div key={t.id} className="hud-panel p-4">
            <div className="flex items-center gap-3">
              <RadialScore score={t.quality_score} critical={t.critical_flags.length > 0} size={50} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold">{t.symbol}</span>
                  <DirBadge t={t} />
                  <span className="text-xs text-ink-dim">{dt(SETUP_BY_ID[t.setup].short, t.direction)} · {t.timeframe}m</span>
                </div>
                <div className="font-num mt-0.5 text-xs text-ink-dim">
                  {t.shares - closedShares}/{t.shares} acc · E {price(t.entry)} · S {price(t.stop)} · {fmtTime(t.opened_at)} ET
                </div>
                {t.critical_flags.length > 0 && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-bear">
                    <OctagonX size={12} /> {t.critical_flags.length} regla(s) rota(s)
                  </div>
                )}
              </div>
            </div>
            <Link to={`/trades/${t.id}`} className="btn-primary mt-3 w-full">
              Cerrar trade
            </Link>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <h2 className="hud-label text-cyan-neon">Cerrados · {closed.length}</h2>
        {trades.length > 0 && (
          <button
            className="btn-ghost !min-h-[40px] !px-3 !text-xs"
            onClick={() => downloadText(`velez-trades-${etDayKey()}.csv`, tradesToCsv(trades))}
            aria-label="Exportar todos los trades a Excel (CSV)"
          >
            <Download size={14} /> Excel
          </button>
        )}
      </div>
      {closed.length === 0 && <p className="text-sm text-ink-dim">Aquí aparecerán tus trades cuando los cierres.</p>}
      <div className="space-y-1.5">
        {closed.slice(0, 100).map((t) => {
          const { r, pnl } = tradeTotals(t);
          return (
            <Link
              to={`/trades/${t.id}`}
              key={t.id}
              className="flex items-center gap-3 border-l-2 bg-white/[0.025] px-3 py-2.5"
              style={{ borderColor: r > 0 ? '#00FF9C' : r < 0 ? '#FF2E63' : '#8A94A6' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{t.symbol}</span>
                  <DirBadge t={t} />
                  <span className="truncate text-xs text-ink-dim">{dt(SETUP_BY_ID[t.setup].short, t.direction)}</span>
                </div>
                <div className="text-xs text-ink-dim">
                  {fmtDay(t.opened_at)} · score {t.quality_score}
                  {t.review?.errors.length ? ` · ${t.review.errors.length} error(es)` : ''}
                  {!t.review && ' · sin revisión'}
                </div>
              </div>
              <div className="text-right">
                <div className={cx('font-num text-base font-bold', r > 0 ? 'text-bull' : r < 0 ? 'text-bear' : 'text-ink')}>{fmtR(r)}</div>
                <div className="font-num text-xs text-ink-dim">{usd(pnl)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
