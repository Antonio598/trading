import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../lib/image';
import { screenshotUrl } from '../lib/repo';
import type { TradeRecord } from '../domain/types';
import { useJournal } from '../state/journal';
import { Panel } from './hud/primitives';

export function ScreenshotPanel({ trade }: { trade: TradeRecord }) {
  const setScreenshot = useJournal((s) => s.setScreenshot);
  const path = trade.review?.screenshot_url ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const [version, setVersion] = useState(0);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setMissing(false);
    if (path)
      screenshotUrl(path)
        .catch(() => null)
        .then((u) => {
          if (!alive) return;
          if (u?.startsWith('blob:')) objectUrl = u;
          setUrl(u);
          setMissing(!u);
        });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, version]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await setScreenshot(trade.id, await compressImage(file));
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Foto del gráfico" hint="Opcional. Te ayuda a recordar qué viste cuando revises tus trades.">
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

      {path && (
        <button type="button" onClick={() => setBig(true)} className="mb-3 block w-full overflow-hidden border border-white/10" aria-label="Ver captura en grande">
          {url ? (
            <img src={url} alt={`Captura del gráfico de ${trade.symbol}`} className="max-h-64 w-full object-contain" />
          ) : (
            <div className="grid h-32 place-items-center px-4 text-center text-sm text-ink-dim">
              {missing ? 'Esta captura está guardada en otro dispositivo.' : 'Cargando captura…'}
            </div>
          )}
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => camRef.current?.click()}>
          <Camera size={16} /> Cámara
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => galRef.current?.click()}>
          <ImagePlus size={16} /> {path ? 'Cambiar' : 'Galería'}
        </button>
      </div>
      {path && (
        <button className="mt-2 inline-flex min-h-[40px] items-center gap-1 text-sm text-bear" disabled={busy} onClick={() => setScreenshot(trade.id, null)}>
          <Trash2 size={14} /> Quitar captura
        </button>
      )}
      {busy && <p className="mt-2 text-xs text-ink-dim">Guardando…</p>}

      {big && url && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3" onClick={() => setBig(false)} role="dialog" aria-modal="true" aria-label="Captura">
          <button className="absolute right-3 top-3 grid h-11 w-11 place-items-center text-ink" aria-label="Cerrar" onClick={() => setBig(false)}>
            <X size={24} />
          </button>
          <img src={url} alt={`Captura del gráfico de ${trade.symbol}`} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </Panel>
  );
}
