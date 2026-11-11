/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** En desarrollo, sirve /api/analizar con el mismo handler que usa Vercel. La llave nunca llega al navegador. */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'vj-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/analizar', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(`http://localhost${req.url ?? ''}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const { handleAnalyze } = await server.ssrLoadModule('/server/analyze.ts');
          const response: Response = await handleAnalyze(request, {
            ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
            SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
            SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
          });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Error del servidor de desarrollo.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    devApi(loadEnv(mode, process.cwd(), '')),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Velez Checklist & Journal',
        short_name: 'Velez',
        description: 'Checklist pre-trade, bitácora y feedback del Método Velez',
        lang: 'es-MX',
        theme_color: '#0E0F13',
        background_color: '#0E0F13',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // config.js lo genera el servidor con las variables de entorno: nunca precachear la versión vacía.
        globIgnores: ['config.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/config.js',
            handler: 'NetworkFirst',
            options: { cacheName: 'vj-config', networkTimeoutSeconds: 3 },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
  },
}));
