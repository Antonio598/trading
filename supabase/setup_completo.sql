-- ════════════════════════════════════════════════════════════════════════
--  VELEZ HUD · Instalación completa para el SQL Editor de Supabase
-- ════════════════════════════════════════════════════════════════════════
--  Seguro para un Supabase que ya tiene otras apps:
--   · Todo lo que crea lleva el prefijo vj_ (tablas, políticas, bucket).
--   · No borra (DROP) ni modifica nada que ya exista.
--   · Puedes ejecutarlo varias veces: lo que ya existe se salta.
--
--  ANTES DE EJECUTAR: cambia tu correo y contraseña en el PASO 4 (abajo).
--  Si tu correo ya tiene cuenta en este Supabase (por tus otras apps),
--  NO se cambia su contraseña: entras con la que ya tienes.
-- ════════════════════════════════════════════════════════════════════════

begin;

create extension if not exists pgcrypto;

-- ─────────────── PASO 1 · Tablas ───────────────

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

create table if not exists public.vj_trades (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null unique,
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
  r_value          numeric(12,2) not null,
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
-- Opciones (también actualiza instalaciones anteriores sin estas columnas)
alter table public.vj_trades add column if not exists instrument text not null default 'stock'
  check (instrument in ('stock', 'option'));
alter table public.vj_trades add column if not exists multiplier integer not null default 1
  check (multiplier > 0);

create index if not exists vj_trades_user_created_idx on public.vj_trades (user_id, created_at desc);
create index if not exists vj_trades_user_status_idx  on public.vj_trades (user_id, status);

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

create table if not exists public.vj_trade_reviews (
  trade_id         uuid primary key references public.vj_trades(id) on delete cascade,
  emotion          text check (emotion in ('tranquilo','ansioso','fomo','venganza','miedo','sobreconfiado','aburrido')),
  execution_rating integer check (execution_rating between 1 and 5),
  errors           text[] not null default '{}',
  note             text,
  screenshot_url   text,
  updated_at       timestamptz not null default now()
);

create table if not exists public.vj_rules_library (
  id       text primary key,
  category text not null,
  title    text not null,
  body     text not null
);

-- ─────────────── PASO 2 · Seguridad: cada usuario solo ve lo suyo ───────────────

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

-- ─────────────── PASO 3 · Fotos de los gráficos (bucket privado) ───────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vj-screenshots', 'vj-screenshots', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='vj_screenshots_select') then
    create policy vj_screenshots_select on storage.objects for select to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='vj_screenshots_insert') then
    create policy vj_screenshots_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='vj_screenshots_update') then
    create policy vj_screenshots_update on storage.objects for update to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='vj_screenshots_delete') then
    create policy vj_screenshots_delete on storage.objects for delete to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- ─────────────── PASO 4 · Tu usuario para entrar (login) ───────────────
-- Crea tu cuenta ya confirmada (no necesita correo de confirmación).
-- 👇 CAMBIA ESTOS DOS VALORES 👇
do $$
declare
  v_email    text := 'TU_CORREO@ejemplo.com';
  v_password text := 'TU_CONTRASEÑA_SEGURA';
  -- 👆 CAMBIA ESTOS DOS VALORES 👆
  v_uid      uuid;
begin
  v_email := lower(trim(v_email));

  if v_email like 'tu_correo@%' or v_password = 'TU_CONTRASEÑA_SEGURA' then
    raise notice 'PASO 4 omitido: no cambiaste el correo/contraseña. Las tablas sí quedaron creadas.';
    return;
  end if;
  if length(v_password) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    raise notice 'El correo % ya tiene cuenta (de tus otras apps). No se cambió su contraseña: entra con la que ya usas.', v_email;
    return;
  end if;

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    crypt(v_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  -- Columnas que solo existen en versiones recientes de Supabase: si están, se dejan en '' (no NULL).
  if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email_change_token_current') then
    execute 'update auth.users set email_change_token_current = '''' where id = $1' using v_uid;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='reauthentication_token') then
    execute 'update auth.users set reauthentication_token = '''' where id = $1' using v_uid;
  end if;

  -- Identidad de correo (necesaria para iniciar sesión con correo y contraseña).
  if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='provider_id') then
    execute 'insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             values ($1::text, $1, jsonb_build_object(''sub'', $1::text, ''email'', $2, ''email_verified'', true), ''email'', now(), now(), now())'
      using v_uid, v_email;
  else
    execute 'insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             values ($1::text, $1, jsonb_build_object(''sub'', $1::text, ''email'', $2), ''email'', now(), now(), now())'
      using v_uid, v_email;
  end if;

  raise notice 'Usuario % creado. Ya puedes entrar a la app.', v_email;
end $$;

commit;

-- ─────────────── Comprobación (debe mostrar 5 tablas, 5 + 4 políticas y 1 bucket) ───────────────
select 'tabla' as tipo, table_name as nombre from information_schema.tables where table_schema='public' and table_name like 'vj\_%'
union all
select 'política', schemaname || '.' || policyname from pg_policies where policyname like 'vj\_%'
union all
select 'bucket', id from storage.buckets where id = 'vj-screenshots'
order by 1, 2;
