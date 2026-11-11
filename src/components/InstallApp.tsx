import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useState } from 'react';
import { detectPlatform, useInstall } from '../lib/install';
import { Panel } from './hud/primitives';

/** Pasos para iPhone: Safari → Compartir → Agregar a inicio. */
function IosSteps({ other }: { other: boolean }) {
  return (
    <ol className="space-y-3 text-[15px] text-ink">
      {other && (
        <li className="flex gap-3">
          <Step n={1} />
          <span>
            Abre esta página en <b>Safari</b> (en otros navegadores también funciona desde su menú Compartir).
          </span>
        </li>
      )}
      <li className="flex gap-3">
        <Step n={other ? 2 : 1} />
        <span className="leading-relaxed">
          Toca <b>Compartir</b>
          <span className="mx-1 inline-grid h-7 w-7 place-items-center rounded-lg bg-void-3 align-middle text-accent" aria-hidden>
            <Share size={15} />
          </span>
          abajo en la barra de Safari.
        </span>
      </li>
      <li className="flex gap-3">
        <Step n={other ? 3 : 2} />
        <span className="leading-relaxed">
          Baja y toca <b>Agregar a inicio</b>
          <span className="mx-1 inline-grid h-7 w-7 place-items-center rounded-lg bg-void-3 align-middle text-accent" aria-hidden>
            <SquarePlus size={15} />
          </span>
        </span>
      </li>
      <li className="flex gap-3">
        <Step n={other ? 4 : 3} />
        <span>
          Toca <b>Agregar</b>. Velez aparecerá en tu pantalla de inicio y se abrirá como app, a pantalla completa.
        </span>
      </li>
    </ol>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/[0.16] text-[13px] font-extrabold text-accent" aria-hidden>
      {n}
    </span>
  );
}

/** Tarjeta completa (pantalla Plan). No se muestra si ya está instalada. */
export function InstallPanel() {
  const { installed, deferred, install } = useInstall();
  const platform = detectPlatform();
  const [busy, setBusy] = useState(false);
  if (installed) return null;

  return (
    <Panel title="Instala la app en tu celular" hint="Gratis, sin tienda de apps. Se abre a pantalla completa y funciona sin internet.">
      {platform.startsWith('ios') ? (
        <IosSteps other={platform === 'ios-other'} />
      ) : deferred ? (
        <button
          className="btn-primary w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await install();
            setBusy(false);
          }}
        >
          <Download size={18} /> Instalar Velez
        </button>
      ) : (
        <p className="text-[15px] text-ink">
          {platform === 'android' ? (
            <>
              En Chrome, toca el menú <b>⋮</b> y luego <b>Instalar app</b> (o <b>Agregar a pantalla principal</b>).
            </>
          ) : (
            <>
              En tu celular, abre esta misma dirección. En la computadora, busca el ícono <b>Instalar</b> en la barra de direcciones del navegador.
            </>
          )}
        </p>
      )}
    </Panel>
  );
}

/** Aviso compacto arriba de la app, solo en el celular y hasta que se descarte. */
export function InstallBanner() {
  const { installed, dismissed, deferred, install, dismiss } = useInstall();
  const platform = detectPlatform();
  const [open, setOpen] = useState(false);
  if (installed || dismissed || platform === 'desktop') return null;
  const ios = platform.startsWith('ios');

  return (
    <div className="mb-4 rounded-card bg-accent/[0.12] p-4">
      <div className="flex items-start gap-3">
        <img src="/icons/apple-touch-icon.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-ink">Instala Velez en tu pantalla de inicio</div>
          <div className="mt-0.5 text-[13px] text-ink-dim">Se abre como app y funciona sin internet.</div>
        </div>
        <button onClick={dismiss} aria-label="Ocultar aviso" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-dim hover:bg-void-3">
          <X size={18} />
        </button>
      </div>
      {ios ? (
        open ? (
          <div className="mt-4">
            <IosSteps other={platform === 'ios-other'} />
          </div>
        ) : (
          <button className="btn-primary mt-3 w-full !min-h-[46px]" onClick={() => setOpen(true)}>
            Cómo instalarla
          </button>
        )
      ) : deferred ? (
        <button className="btn-primary mt-3 w-full !min-h-[46px]" onClick={() => install()}>
          <Download size={18} /> Instalar
        </button>
      ) : (
        <p className="mt-3 text-[14px] text-ink">
          Toca el menú <b>⋮</b> de Chrome y luego <b>Instalar app</b>.
        </p>
      )}
    </div>
  );
}
