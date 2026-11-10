# trading

**Velez HUD** — checklist pre-trade, bitácora y coach para day traders que siguen el Método Oliver Velez.
App web para celular (PWA) en español.

## Qué hace

1. **Nuevo:** antes de entrar, llenas una checklist con toques. Te da un puntaje (0–100), te dice si el trade vale la pena y cuántas acciones comprar según tu R.
2. **Trades:** cierras el trade (con salidas parciales), marcas cómo te sentiste y qué hiciste mal. Puedes adjuntar una foto del gráfico y exportar todo a Excel.
3. **Progreso:** tu resultado en R, tus errores más caros, hallazgos automáticos y un coach con IA que analiza tu semana.
4. **Reglas:** el método en tarjetas cortas, con buscador.

Funciona sin internet y sincroniza cuando vuelve la conexión.

## Tecnología

React + TypeScript + Vite + Tailwind + Framer Motion + Recharts · Supabase (auth, Postgres, Storage) · Claude API para el coach semanal.

## Correr en local

```bash
npm install
cp .env.example .env.local   # y llena los valores
npm run dev                  # http://localhost:5173
npm test                     # pruebas
```

Variables en `.env.local`:

| Variable | Para qué | ¿Va al navegador? |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de tu Supabase | Sí |
| `VITE_SUPABASE_ANON_KEY` | Llave pública (anon) de Supabase | Sí |
| `ANTHROPIC_API_KEY` | Coach con IA (solo servidor) | **No** — nunca le pongas el prefijo `VITE_` |

Nunca pongas la *service role key* de Supabase en este proyecto.

## Base de datos

Las migraciones están en `supabase/migrations/`. Todas las tablas llevan el prefijo `vj_` para convivir con otras apps en la misma base de datos, y tienen Row Level Security (cada usuario solo ve sus datos).

- `0001_vj_init.sql` — tablas de perfil, trades, salidas, revisiones y reglas.
- `0002_vj_screenshots.sql` — bucket privado para las fotos de los gráficos.

## Publicar

`api/analizar.ts` es una función lista para **Vercel**. Configura ahí `ANTHROPIC_API_KEY`, `SUPABASE_URL` y `SUPABASE_ANON_KEY` (además de las `VITE_*` para el build).
