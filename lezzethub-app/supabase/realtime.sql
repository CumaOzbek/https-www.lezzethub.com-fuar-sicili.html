-- =====================================================================
-- LezzetHub — Anlık güncellemeler (Supabase Realtime)
-- schema.sql'den sonra çalıştır. Yeni mesaj, sipariş durumu ve bildirimler
-- uygulamaya anında düşer. Realtime satır düzeyi güvenliğe (RLS) uyar:
-- her kullanıcı yalnızca görmeye yetkili olduğu satırların değişikliklerini alır.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['listings','orders','messages','payments','notifications','reports','profiles','verifications','courier_profiles'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
