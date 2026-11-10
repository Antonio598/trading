-- Velez Checklist & Journal — esquema inicial
-- Base de datos COMPARTIDA con otras apps: todo lleva prefijo vj_, es aditivo
-- (if not exists), no hace DROP, no altera objetos ajenos y no toca auth.users.

begin;

create extension if not exists pgcrypto;

-- ───────────── Perfil / Mi plan ─────────────
create table if not exists public.vj_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  account_size    numeric(14,2) not null default 0,
  r_value         numeric(12,2) not null default 0,
  max_daily_loss  numeric(12,2) not null default 0,
  mlpt            numeric(12,2) not null default 0,
  max_trades_day  integer,
  timeframes      integer[] not null default '{5}',
  reduce_motion   boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ───────────── Trades ─────────────
create table if not exists public.vj_trades (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null unique,            -- idempotencia para sync offline
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  symbol           text not null,
  direction        text not null check (direction in ('long','short')),
  timeframe        integer not null check (timeframe in (1,2,5,15,60)),
  setup            text not null,
  trend_type       text not null check (trend_type in ('regular','poder','super','lateral','contra')),
  ma_state         text not null check (ma_state in ('estrecho','neutral','amplio')),
  state_transition boolean not null default false,
  entry            numeric(14,4) not null,
  stop             numeric(14,4) not null,
  stop_type        text not null check (stop_type in ('evento','mlpt','elefante')),
  shares           integer not null check (shares >= 0),
  risk_usd         numeric(12,2) not null,
  r_value          numeric(12,2) not null,          -- R vigente al abrir (snapshot)
  t1               numeric(14,4),
  t2               numeric(14,4),
  t3               numeric(14,4),
  trailing_method  text check (trailing_method in ('vela','8mm','20mm','vela_grande')),
  checklist_json   jsonb not null default '{}'::jsonb,
  quality_score    integer not null check (quality_score between 0 and 100),
  verdict          text not null check (verdict in ('aplus','aceptable','no_operar')),
  critical_flags   text[] not null default '{}',
  status           text not null default 'open' check (status in ('open','closed')),
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz
);
create index if not exists vj_trades_user_created_idx on public.vj_trades (user_id, created_at desc);
create index if not exists vj_trades_user_status_idx  on public.vj_trades (user_id, status);

-- ───────────── Salidas (parciales) ─────────────
create table if not exists public.vj_trade_exits (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null unique,
  trade_id   uuid not null references public.vj_trades(id) on delete cascade,
  created_at timestamptz not null default now(),
  price      numeric(14,4) not null,
  shares     integer not null check (shares > 0),
  reason     text not null check (reason in ('t1','t2','t3','trailing','stop','break_even','manual','fin_dia')),
  pnl_usd    numeric(12,2) not null,
  r_result   numeric(8,3) not null
);
create index if not exists vj_trade_exits_trade_idx on public.vj_trade_exits (trade_id);

-- ───────────── Revisión del trade ─────────────
create table if not exists public.vj_trade_reviews (
  trade_id         uuid primary key references public.vj_trades(id) on delete cascade,
  emotion          text check (emotion in ('tranquilo','ansioso','fomo','venganza','miedo','sobreconfiado','aburrido')),
  execution_rating integer check (execution_rating between 1 and 5),
  errors           text[] not null default '{}',
  note             text,
  screenshot_url   text,
  updated_at       timestamptz not null default now()
);

-- ───────────── Biblioteca de reglas (contenido estático) ─────────────
create table if not exists public.vj_rules_library (
  id       text primary key,
  category text not null,
  title    text not null,
  body     text not null
);

-- ───────────── Row Level Security ─────────────
alter table public.vj_profiles      enable row level security;
alter table public.vj_trades        enable row level security;
alter table public.vj_trade_exits   enable row level security;
alter table public.vj_trade_reviews enable row level security;
alter table public.vj_rules_library enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='vj_profiles_own') then
    create policy vj_profiles_own on public.vj_profiles
      for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and policyname='vj_trades_own') then
    create policy vj_trades_own on public.vj_trades
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and policyname='vj_trade_exits_own') then
    create policy vj_trade_exits_own on public.vj_trade_exits
      for all to authenticated
      using (exists (select 1 from public.vj_trades t where t.id = trade_id and t.user_id = auth.uid()))
      with check (exists (select 1 from public.vj_trades t where t.id = trade_id and t.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and policyname='vj_trade_reviews_own') then
    create policy vj_trade_reviews_own on public.vj_trade_reviews
      for all to authenticated
      using (exists (select 1 from public.vj_trades t where t.id = trade_id and t.user_id = auth.uid()))
      with check (exists (select 1 from public.vj_trades t where t.id = trade_id and t.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and policyname='vj_rules_library_read') then
    create policy vj_rules_library_read on public.vj_rules_library
      for select to authenticated using (true);
  end if;
end $$;

grant select, insert, update, delete on public.vj_profiles, public.vj_trades,
  public.vj_trade_exits, public.vj_trade_reviews to authenticated;
grant select on public.vj_rules_library to authenticated;

commit;
