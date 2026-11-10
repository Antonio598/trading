/**
 * Servidor de producción (Docker / Easypanel). Sin dependencias extra: solo node:http.
 *  - Sirve la app compilada (dist/) con fallback SPA.
 *  - GET  /config.js     -> configuración pública (URL y anon key de Supabase) leída del entorno al arrancar.
 *  - POST /api/analizar  -> coach con IA (la llave de Anthropic se queda en el servidor).
 *  - GET  /healthz       -> chequeo de salud.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { handleAnalyze } from './analyze';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = resolve(process.env.STATIC_DIR || 'dist');

const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
};

/** Solo valores públicos: nunca pongas aquí llaves privadas. */
const CONFIG_JS = `window.__VJ_CONFIG__=${JSON.stringify({
  supabaseUrl: env.SUPABASE_URL ?? '',
  supabaseAnonKey: env.SUPABASE_ANON_KEY ?? '',
})};`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest)|image\/svg)/;

interface Cached {
  body: Buffer;
  gz: Buffer | null;
  type: string;
}
const cache = new Map<string, Cached>();

async function loadFile(path: string): Promise<Cached | null> {
  const hit = cache.get(path);
  if (hit) return hit;
  try {
    const s = await stat(path);
    if (!s.isFile()) return null;
  } catch {
    return null;
  }
  const body = await readFile(path);
  const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const gz = COMPRESSIBLE.test(type) && body.length > 1024 ? gzipSync(body) : null;
  const entry = { body, gz, type };
  cache.set(path, entry);
  return entry;
}

function cacheControl(urlPath: string): string {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (/\/(index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(urlPath) || urlPath.startsWith('/workbox-'))
    return 'no-cache';
  return 'public, max-age=3600';
}

function send(req: IncomingMessage, res: ServerResponse, file: Cached, urlPath: string, status = 200) {
  const useGz = !!file.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  res.writeHead(status, {
    'content-type': file.type,
    'cache-control': cacheControl(urlPath),
    'x-content-type-options': 'nosniff',
    ...(useGz ? { 'content-encoding': 'gzip', vary: 'Accept-Encoding' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : useGz ? file.gz : file.body);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 200_000) throw new Error('payload too large');
    chunks.push(c as Buffer);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  return new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  try {
    if (path === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    if (path === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(CONFIG_JS);
      return;
    }
    if (path === '/api/analizar') {
      const response = await handleAnalyze(await toRequest(req), env);
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => (headers[k] = v));
      res.writeHead(response.status, headers).end(await response.text());
      return;
    }
    if (path.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"No encontrado"}');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }

    // Archivos estáticos (protegido contra rutas tipo ../)
    const target = normalize(join(ROOT, path));
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403).end();
      return;
    }
    const file = path !== '/' ? await loadFile(target) : null;
    if (file) return send(req, res, file, path);

    // Archivo con extensión que no existe -> 404; rutas de la app -> index.html
    if (extname(path)) {
      res.writeHead(404).end();
      return;
    }
    const index = await loadFile(join(ROOT, 'index.html'));
    if (!index) {
      res.writeHead(500).end('Falta dist/index.html: ejecuta el build.');
      return;
    }
    send(req, res, index, '/index.html');
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Error del servidor');
  }
});

server.listen(PORT, () => {
  console.log(`Velez HUD escuchando en el puerto ${PORT}`);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) console.warn('⚠ Falta SUPABASE_URL o SUPABASE_ANON_KEY: la app no podrá iniciar sesión.');
  if (!env.ANTHROPIC_API_KEY) console.warn('⚠ Falta ANTHROPIC_API_KEY: el coach con IA estará desactivado.');
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
