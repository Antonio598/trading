import { create } from 'zustand';
import { enqueue, fetchRemote, flush, readCache, readOutbox, requeueFailedUploads, saveLocalBlob, tradeRow, writeCache } from '../lib/repo';
import { isNetworkError } from '../lib/supabase';
import { exitPnl, sharesClosed, toR, totals } from '../domain/risk';
import { etDayKey } from '../domain/time';
import type { ExitReason, Profile, ReviewRow, TradeRecord } from '../domain/types';

interface JournalState {
  uid: string | null;
  email: string | null;
  loaded: boolean;
  profile: Profile | null;
  trades: TradeRecord[];
  pending: number;
  syncing: boolean;
  online: boolean;
  syncError: string | null;

  init(uid: string, email: string | null): Promise<void>;
  reset(): void;
  sync(): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  addTrade(t: TradeRecord): Promise<void>;
  addExit(tradeId: string, price: number, shares: number, reason: ExitReason): Promise<void>;
  saveReview(review: ReviewRow): Promise<void>;
  /** Guarda (o quita, con null) la captura del trade. Funciona sin internet. */
  setScreenshot(tradeId: string, image: Blob | null): Promise<void>;
}

async function persist(s: JournalState) {
  if (s.uid) await writeCache(s.uid, { profile: s.profile, trades: s.trades });
}

export const useJournal = create<JournalState>((set, get) => ({
  uid: null,
  email: null,
  loaded: false,
  profile: null,
  trades: [],
  pending: 0,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncError: null,

  async init(uid, email) {
    if (get().uid === uid && get().loaded) return;
    const cache = await readCache(uid);
    await requeueFailedUploads(uid).catch(() => 0);
    const pending = (await readOutbox(uid)).length;
    set({ uid, email, profile: cache?.profile ?? null, trades: cache?.trades ?? [], pending, loaded: !!cache });
    await get().sync();
    set({ loaded: true });
  },

  reset() {
    set({ uid: null, email: null, loaded: false, profile: null, trades: [], pending: 0, syncError: null });
  },

  async sync() {
    const uid = get().uid;
    if (!uid || get().syncing) return;
    set({ syncing: true });
    try {
      const res = await flush(uid);
      set({ pending: res.pending, syncError: res.error });
      // Solo refrescamos desde el servidor cuando la cola está vacía, para no pisar cambios locales.
      if (res.pending === 0) {
        const remote = await fetchRemote(uid);
        set({ profile: remote.profile ?? get().profile, trades: remote.trades, online: true });
        await persist(get());
      }
    } catch (e) {
      if (isNetworkError(e)) set({ online: false });
      else set({ syncError: (e as Error).message });
    } finally {
      set({ syncing: false });
    }
  },

  async saveProfile(p) {
    const uid = get().uid!;
    const profile = { ...p, id: uid };
    set({ profile });
    await persist(get());
    await enqueue(uid, {
      table: 'vj_profiles',
      row: { ...profile, updated_at: new Date().toISOString() },
      onConflict: 'id',
    });
    set({ pending: get().pending + 1 });
    void get().sync();
  },

  async addTrade(t) {
    const uid = get().uid!;
    const trade = { ...t, user_id: uid };
    set({ trades: [trade, ...get().trades] });
    await persist(get());
    await enqueue(uid, { table: 'vj_trades', row: tradeRow(trade), onConflict: 'id' });
    set({ pending: get().pending + 1 });
    void get().sync();
  },

  async addExit(tradeId, price, shares, reason) {
    const uid = get().uid!;
    const trade = get().trades.find((t) => t.id === tradeId);
    if (!trade) return;
    const pnl = exitPnl(Number(trade.entry), price, shares, trade.direction, trade.instrument);
    const id = crypto.randomUUID();
    const exit = {
      id,
      client_id: id,
      trade_id: tradeId,
      created_at: new Date().toISOString(),
      price,
      shares,
      reason,
      pnl_usd: pnl,
      r_result: toR(pnl, Number(trade.r_value)),
    };
    const exits = [...trade.exits, exit];
    const closed = sharesClosed(exits) >= trade.shares;
    const updated: TradeRecord = {
      ...trade,
      exits,
      status: closed ? 'closed' : 'open',
      closed_at: closed ? exit.created_at : null,
    };
    set({ trades: get().trades.map((t) => (t.id === tradeId ? updated : t)) });
    await persist(get());
    await enqueue(uid, { table: 'vj_trade_exits', row: exit, onConflict: 'id' });
    let added = 1;
    if (closed) {
      await enqueue(uid, { table: 'vj_trades', row: tradeRow(updated), onConflict: 'id' });
      added++;
    }
    set({ pending: get().pending + added });
    void get().sync();
  },

  async setScreenshot(tradeId, image) {
    const uid = get().uid!;
    const trade = get().trades.find((t) => t.id === tradeId);
    if (!trade) return;
    const path = `${uid}/${tradeId}.jpg`;
    if (image) {
      await saveLocalBlob(path, image);
      await enqueue(uid, { kind: 'upload', path });
    } else {
      await enqueue(uid, { kind: 'remove', path });
    }
    const review: ReviewRow = trade.review
      ? { ...trade.review, screenshot_url: image ? path : null }
      : { trade_id: tradeId, emotion: null, execution_rating: null, errors: [], note: null, screenshot_url: image ? path : null };
    set({ pending: get().pending + 1 });
    // saveReview encola la fila después de la subida, respetando el orden.
    await get().saveReview(review);
  },

  async saveReview(review) {
    const uid = get().uid!;
    set({ trades: get().trades.map((t) => (t.id === review.trade_id ? { ...t, review } : t)) });
    await persist(get());
    await enqueue(uid, {
      table: 'vj_trade_reviews',
      row: { ...review, updated_at: new Date().toISOString() },
      onConflict: 'trade_id',
    });
    set({ pending: get().pending + 1 });
    void get().sync();
  },
}));

/** Trades abiertos hoy (día de mercado ET) y P&L realizado hoy. */
export function dayStats(trades: TradeRecord[], now = new Date()) {
  const today = etDayKey(now);
  const todays = trades.filter((t) => etDayKey(t.opened_at) === today);
  const pnlToday = trades
    .flatMap((t) => t.exits)
    .filter((e) => etDayKey(e.created_at) === today)
    .reduce((a, e) => a + Number(e.pnl_usd), 0);
  return { tradesToday: todays.length, pnlToday };
}

export function tradeTotals(t: TradeRecord) {
  return { ...totals(t.exits), closedShares: sharesClosed(t.exits) };
}
