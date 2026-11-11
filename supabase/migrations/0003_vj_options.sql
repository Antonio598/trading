-- Opciones: instrumento (acción u opción) y multiplicador (1 en acciones, 100 en opciones).
-- Aditivo y seguro de repetir: solo agrega columnas a vj_trades. Los trades existentes quedan como acciones.

alter table public.vj_trades
  add column if not exists instrument text not null default 'stock'
    check (instrument in ('stock', 'option'));

alter table public.vj_trades
  add column if not exists multiplier integer not null default 1
    check (multiplier > 0);
