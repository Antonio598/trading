-- Capturas de pantalla de trades (Supabase Storage).
-- Aditivo: un bucket privado nuevo "vj-screenshots" y políticas con prefijo vj_
-- que SOLO aplican a ese bucket. No toca otros buckets ni políticas.
-- Ruta de cada archivo: <user_id>/<trade_id>.jpg

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vj-screenshots', 'vj-screenshots', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'vj_screenshots_select') then
    create policy vj_screenshots_select on storage.objects for select to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'vj_screenshots_insert') then
    create policy vj_screenshots_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'vj_screenshots_update') then
    create policy vj_screenshots_update on storage.objects for update to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'vj_screenshots_delete') then
    create policy vj_screenshots_delete on storage.objects for delete to authenticated
      using (bucket_id = 'vj-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

commit;
