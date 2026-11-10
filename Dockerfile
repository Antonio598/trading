# Velez HUD — imagen de producción (Easypanel / cualquier Docker)
#
# Variables de entorno (se leen al ARRANCAR, no hace falta reconstruir al cambiarlas):
#   SUPABASE_URL        URL de tu Supabase                         (requerida)
#   SUPABASE_ANON_KEY   llave pública "anon" de Supabase           (requerida)
#   ANTHROPIC_API_KEY   llave de Anthropic para el coach con IA    (opcional)
#   PORT                puerto interno (por defecto 3000)
# Nunca pongas la service role key de Supabase.

# ---------- 1) Build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm run build:server

# ---------- 2) Runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# El servidor es un solo archivo empaquetado: no necesita node_modules.
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "dist-server/index.mjs"]
