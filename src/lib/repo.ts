/**
 * Capa de datos local-first: todo se escribe primero en IndexedDB y se encola
 * para Supabase. Si no hay red, la cola se reintenta al volver la conexión.
 */
import { createStore, del as idbDel, get as idbGet, set as idbSet, type UseStore } from 'idb-keyval';
import { isNetworkError, supabase } from './supabase';
import type { ExitRow, Profile, ReviewRow, TradeRecord, TradeRow } from '../domain/types';

/** Se crea en el primer uso (no al importar), para no romper donde no hay IndexedDB. */
let _store: UseStore | null = null;
const store = () => (_store ??= createStore('velez-journal', 'kv'));
const get = <T,>(key: string) => idbGet<T>(key, store());
const set = (key: string, value: unknown) => idbSet(key, value, store());
const del = (key: string) => idbDel(key, store());

type Table = 'vj_profiles' | 'vj_trades' | 'vj_trade_exits' | 'vj_trade_reviews';

export const SCREENSHOT_BUCKET = 'vj-screenshots';

export type OutboxOp =
  | { id: string; kind?: 'upsert'; table: Table; row: Record<string, unknown>; onConflict: string }
  | { id: string; kind: 'upload'; path: string }
  | { id: string; kind: 'remove'; path: string };

type NewOp = OutboxOp extends infer O ? (O extends OutboxOp ? Omit<O, 'id'> : never) : never;

/* ─────────── Imágenes guardadas en el dispositivo ─────────── */
const blobKey = (path: string) => `blob:${path}`;
export const saveLocalBlob = (path: string, blob: Blob) => set(blobKey(path), blob);
export const getLocalBlob = (path: string) => get<Blob>(blobKey(path));

/** URL para mostrar una captura: primero la copia local, si no, una URL firmada por 1 h. */
export async function screenshotUrl(path: string): Promise<string | null> {
  const local = await getLocalBlob(path).catch(() => undefined);
  if (local) return URL.createObjectURL(local);
  const { data, error } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export interface Cache {
  profile: Profile | null;
  trades: TradeRecord[];
}

const outboxKey = (uid: string) => `outbox:${uid}`;
const cacheKey = (uid: string) => `cache:${uid}`;

export async function readCache(uid: string): Promise<Cache | null> {
  return (await get<Cache>(cacheKey(uid))) ?? null;
}

export async function writeCache(uid: string, cache: Cache): Promise<void> {
  await set(cacheKey(uid), cache);
}

export async function readOutbox(uid: string): Promise<OutboxOp[]> {
  return (await get<OutboxOp[]>(outboxKey(uid))) ?? [];
}

const retryKey = (uid: string) => `retry-uploads:${uid}`;

/** Vuelve a encolar las capturas que no se pudieron subir (se llama al abrir la app). */
export async function requeueFailedUploads(uid: string): Promise<number> {
  const paths = (await get<string[]>(retryKey(uid))) ?? [];
  if (!paths.length) return 0;
  await set(retryKey(uid), []);
  let n = 0;
  for (const path of paths) {
    if (await getLocalBlob(path)) {
      await enqueue(uid, { kind: 'upload', path });
      n++;
    }
  }
  return n;
}

export async function enqueue(uid: string, op: NewOp): Promise<void> {
  const ops = await readOutbox(uid);
  ops.push({ ...op, id: crypto.randomUUID() } as OutboxOp);
  await set(outboxKey(uid), ops);
}

async function runOp(op: OutboxOp): Promise<{ message: string } | null> {
  if (op.kind === 'upload') {
    const blob = await getLocalBlob(op.path);
    if (!blob) return null; // ya no existe localmente: nada que subir
    const { error } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(op.path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (!error) await del(blobKey(op.path)); // ya está en la nube
    return error;
  }
  if (op.kind === 'remove') {
    await del(blobKey(op.path));
    const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).remove([op.path]);
    return error;
  }
  const { error } = await supabase.from(op.table).upsert(op.row, { onConflict: op.onConflict });
  return error;
}

export interface FlushResult {
  pending: number;
  error: string | null;
}

let flushing: Promise<FlushResult> | null = null;

/** Envía la cola en orden. Se detiene ante errores de red; descarta (y reporta) errores del servidor. */
export function flush(uid: string): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    let ops = await readOutbox(uid);
    let error: string | null = null;
    while (ops.length) {
      const op = ops[0];
      let e: { message: string } | null;
      try {
        e = await runOp(op);
      } catch (err) {
        e = { message: String((err as Error)?.message ?? err) };
      }
      if (e) {
        if (isNetworkError(e)) break;
        if (op.kind === 'upload') {
          // La imagen sigue en el celular; se reintenta la próxima vez que abras la app.
          const retry = (await get<string[]>(retryKey(uid))) ?? [];
          if (!retry.includes(op.path)) await set(retryKey(uid), [...retry, op.path]);
          error = 'Las capturas se guardan solo en este celular por ahora (falta activar el almacenamiento en la nube).';
        } else {
          error = `${op.kind === 'remove' ? 'captura' : op.table}: ${e.message}`;
        }
        console.error('[sync] descartado', op, e);
      }
      ops = ops.slice(1);
      await set(outboxKey(uid), ops);
    }
    return { pending: ops.length, error };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function fetchRemote(uid: string): Promise<Cache> {
  const [p, t] = await Promise.all([
    supabase.from('vj_profiles').select('*').eq('id', uid).maybeSingle(),
    supabase
      .from('vj_trades')
      .select('*, vj_trade_exits(*), vj_trade_reviews(*)')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  const trades: TradeRecord[] = (t.data ?? []).map((r: Record<string, unknown>) => {
    const { vj_trade_exits, vj_trade_reviews, ...row } = r;
    return {
      ...(row as unknown as TradeRow),
      exits: ((vj_trade_exits as ExitRow[]) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      review: one(vj_trade_reviews as ReviewRow | ReviewRow[] | null),
    };
  });
  return { profile: (p.data as Profile | null) ?? null, trades };
}

/** Fila plana para upsert (sin relaciones anidadas). */
export function tradeRow(t: TradeRecord): Record<string, unknown> {
  const { exits: _e, review: _r, ...row } = t;
  return row as unknown as Record<string, unknown>;
}
