/** Instalación como app (PWA): Android/Chrome tiene botón nativo; iPhone se instala desde Safari → Compartir. */
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop';

export function detectPlatform(ua = navigator.userAgent): Platform {
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = 'vj-install-dismissed';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  dismissed: boolean;
  install(): Promise<boolean>;
  dismiss(): void;
}

export const useInstall = create<InstallState>((set, get) => ({
  deferred: null,
  installed: typeof window !== 'undefined' && isStandalone(),
  dismissed: (() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  })(),
  async install() {
    const ev = get().deferred;
    if (!ev) return false;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    set({ deferred: null, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
  dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sin storage */
    }
    set({ dismissed: true });
  },
}));

/** Se llama una vez al arrancar, antes de que el navegador dispare el evento. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // guardamos el evento para mostrar nuestro propio botón
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, deferred: null }));
}
