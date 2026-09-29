-- =====================================================================
-- LezzetHub — Supabase veritabanı şeması (Türkiye geneli)
-- Supabase panelinde SQL Editor'de SIRAYLA çalıştır:
--   1) locations.sql   2) schema.sql (bu dosya)   3) storage.sql   4) realtime.sql
--
-- Güvenlik modeli:
--  * Tablolara istemciden doğrudan yazma YOKTUR; değişiklikler SECURITY DEFINER fonksiyonlarıyla yapılır.
--  * Satış için onaylı hijyen belgesi, kurye listesinde görünmek için onaylı A2/B ehliyet gerekir.
--  * Ödemeyi onaylama / iade yalnızca sunucudaki ödeme fonksiyonları (service_role) tarafından yapılır.
--  * Okumalar satır düzeyi güvenlik (RLS) ile sınırlanır.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Sabitler ve yardımcılar
-- ---------------------------------------------------------------------

create or replace function public.buyer_fee_rate() returns numeric language sql immutable as $$ select 0.10::numeric $$;
create or replace function public.seller_fee_rate() returns numeric language sql immutable as $$ select 0.15::numeric $$;

create or replace function public._valid_location(p_province text, p_district text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tr_districts where province = p_province and district = p_district)
$$;

create or replace function public._fail(msg text) returns void
language plpgsql as $$ begin raise exception '%', msg using errcode = 'P0001'; end $$;

-- 05XXXXXXXXX biçimine getirir; geçersizse null.
create or replace function public._normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '90%' and length(d) = 12 then d := '0' || substr(d, 3); end if;
  if length(d) = 10 and d like '5%' then d := '0' || d; end if;
  if d ~ '^05\d{9}$' then return d; end if;
  return null;
end $$;

-- TR IBAN biçim + mod-97 kontrolü; geçerliyse boşluksuz büyük harfli IBAN, değilse null.
create or replace function public._normalize_iban(p text) returns text
language plpgsql immutable as $$
declare
  iban text := upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'));
  r text; num text := ''; ch text; rem int := 0; i int;
begin
  if iban !~ '^TR\d{24}$' then return null; end if;
  r := substr(iban, 5) || substr(iban, 1, 4);
  for i in 1..length(r) loop
    ch := substr(r, i, 1);
    if ch ~ '[A-Z]' then num := num || (ascii(ch) - 55)::text; else num := num || ch; end if;
  end loop;
  for i in 1..length(num) loop
    rem := (rem * 10 + substr(num, i, 1)::int) % 97;
  end loop;
  if rem = 1 then return iban; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------

-- Platform ayarları. payment_mode:
--   'offline' (varsayılan, pilot): alıcı teslimatta doğrudan satıcıya öder; komisyon alınmaz, para platformdan geçmez.
--   'online': iyzico ile online ödeme ve komisyon (şirket + iyzico hesabı ve ödeme fonksiyonları gerekir).
-- Online ödemeye geçmek için: update public.app_settings set value = 'online' where key = 'payment_mode';
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings(key, value) values ('payment_mode', 'offline') on conflict (key) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  role text not null default 'user' check (role in ('user','admin')),
  active boolean not null default true,
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_url text,
  province text not null,
  district text not null,
  neighborhood text not null check (char_length(btrim(neighborhood)) between 1 and 80),
  availability text not null default '' check (char_length(availability) <= 120),
  seller_status text not null default 'none' check (seller_status in ('none','pending','approved','rejected')),
  courier_status text not null default 'none' check (courier_status in ('none','pending','approved','rejected')),
  -- Tarım ve Orman Bakanlığı gıda işletmesi kayıt numarası (satıcı onayında doldurulur, herkese açık).
  food_registration_no text,
  created_at timestamptz not null default now()
);

-- Yalnızca kullanıcının kendisi ve adminlerin görebildiği alanlar.
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  address text not null default '' check (char_length(address) <= 300),
  phone text not null default '',
  accepted_terms_at timestamptz,
  kvkk_consent_at timestamptz
);

-- Satıcı (hijyen belgesi) ve kurye (ehliyet) başvuruları. Sahibi ve adminler görür.
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('seller','courier')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  doc_path text not null,          -- 'documents' özel kovasındaki dosya yolu
  doc_type text not null check (doc_type in ('image','pdf')),
  doc_number text not null,        -- satıcı: e-Devlet barkod no, kurye: ehliyet belge no
  license_class text check (license_class in ('A2','B')),
  food_registration_no text,
  iban text,
  iban_holder text,
  declaration_at timestamptz,
  document_consent_at timestamptz not null,
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (user_id, kind)
);

-- Onaylı kuryelerin rehber bilgisi (giriş yapmış kullanıcılar görür).
create table if not exists public.courier_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  license_class text not null check (license_class in ('A2','B')),
  vehicle text not null check (vehicle in ('motorcycle','car')),
  phone text not null,
  service_province text not null,
  service_districts text[] not null check (cardinality(service_districts) >= 1),
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  description text not null check (char_length(description) between 10 and 500),
  price numeric(10,2) not null check (price > 0 and price <= 100000),
  category text not null check (category in ('ana-yemek','tatli','hamur-isi','meze','corba','salata','icecek','diger')),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  prep_time text not null default '' check (char_length(prep_time) <= 120),
  delivery text[] not null check (cardinality(delivery) >= 1 and delivery <@ array['pickup','courier','cargo']::text[]),
  shipping_payer text not null default 'buyer' check (shipping_payer in ('buyer','seller')),
  -- Gıda güvenliği: alerjen beyanı (boş = alerjen içermez beyanı), son tüketim/saklama, oda sıcaklığında dayanıklılık.
  allergens text[] not null default '{}' check (allergens <@ array['gluten','sut','yumurta','kuruyemis','yerfistigi','susam','soya','balik','kabuklu','yumusakca','kereviz','hardal','acibakla','sulfit']::text[]),
  shelf_life text not null default '' check (char_length(shelf_life) <= 160),
  shelf_stable boolean not null default false,
  safety_confirmed_at timestamptz,
  status text not null default 'active' check (status in ('active','passive')),
  removed_by_admin boolean not null default false,
  -- Hijyen şikayeti nedeniyle otomatik yayından kaldırıldı; yalnızca admin geri açabilir.
  under_review boolean not null default false,
  province text not null,
  district text not null,
  neighborhood text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_owner_idx on public.listings(owner_id);
create index if not exists listings_location_idx on public.listings(province, district) where status = 'active';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  buyer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  listing_title text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity between 1 and 50),
  appointment timestamptz not null,
  delivery text not null check (delivery in ('pickup','courier','cargo')),
  shipping_payer text not null check (shipping_payer in ('buyer','seller')),
  -- 'on_delivery': teslimatta doğrudan satıcıya ödeme (komisyonsuz); 'online': iyzico ile.
  payment_method text not null default 'online' check (payment_method in ('online','on_delivery')),
  address text not null default '',
  pickup_address text,
  shipping_company text,
  tracking_code text,
  note text not null default '' check (char_length(note) <= 300),
  subtotal numeric(10,2) not null,
  buyer_fee numeric(10,2) not null,
  seller_fee numeric(10,2) not null,
  buyer_total numeric(10,2) not null,
  seller_net numeric(10,2) not null,
  status text not null default 'seller_pending'
    check (status in ('seller_pending','approved','paid','completed','rejected','cancelled')),
  status_note text,
  payout_status text not null default 'pending' check (payout_status in ('pending','paid')),
  payout_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_buyer_idx on public.orders(buyer_id);
create index if not exists orders_seller_idx on public.orders(seller_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  receiver_id uuid references public.profiles(id) on delete set null,
  is_system boolean not null default false,
  text text not null check (char_length(text) between 1 and 1000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_order_idx on public.messages(order_id, created_at);

-- Online ödemeler (iyzico). Kart bilgisi saklanmaz; yalnızca son 4 hane ve kart ailesi.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'TRY',
  provider text not null default 'iyzico' check (provider in ('iyzico','test')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  provider_token text unique,
  provider_payment_id text,
  provider_transaction_id text,
  card_last4 text,
  card_association text,
  error_message text,
  refund_note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index if not exists payments_order_idx on public.payments(order_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  order_id uuid references public.orders(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing','user')),
  target_id uuid not null,
  reason text not null check (reason in ('misleading','hygiene','abuse','fraud','other')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Önceki sürümden yükseltme: eksik sütunları ekle (yeni kurulumda etkisizdir).
alter table public.profiles add column if not exists food_registration_no text;
alter table public.verifications add column if not exists food_registration_no text;
alter table public.listings add column if not exists allergens text[] not null default '{}';
alter table public.listings add column if not exists shelf_life text not null default '';
alter table public.listings add column if not exists shelf_stable boolean not null default false;
alter table public.listings add column if not exists safety_confirmed_at timestamptz;
alter table public.listings add column if not exists under_review boolean not null default false;
alter table public.orders add column if not exists payment_method text not null default 'online';

-- Kargo yalnızca soğuk zincir gerektirmeyen ürünlerde (eski kayıtlar kontrol edilmez: NOT VALID).
alter table public.listings drop constraint if exists listings_cargo_shelf_stable;
alter table public.listings add constraint listings_cargo_shelf_stable check (not ('cargo' = any (delivery)) or shelf_stable) not valid;

-- ---------------------------------------------------------------------
-- Oturum ve bildirim yardımcıları
-- ---------------------------------------------------------------------

create or replace function public._payment_mode() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = 'payment_mode'), 'offline')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function public._me() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'Bu işlem için giriş yapmalısın.' using errcode = 'P0001'; end if;
  if not me.active then raise exception 'Hesabın pasif durumda. Lütfen destek ile iletişime geçin.' using errcode = 'P0001'; end if;
  return me;
end $$;

create or replace function public._require_admin() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me profiles := _me();
begin
  if me.role <> 'admin' then perform _fail('Bu işlem için yönetici yetkisi gerekiyor.'); end if;
  return me;
end $$;

create or replace function public._is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public._notify(p_user uuid, p_title text, p_body text, p_order uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, title, body, order_id)
  select p_user, p_title, p_body, p_order where p_user is not null
$$;

create or replace function public._notify_admins(p_title text, p_body text, p_order uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, title, body, order_id)
  select id, p_title, p_body, p_order from profiles where role = 'admin' and active
$$;

create or replace function public._status_label(s text) returns text
language sql immutable as $$
  select case s
    when 'seller_pending' then 'Satıcı Onayı Bekliyor'
    when 'approved' then 'Ödeme Bekleniyor'
    when 'paid' then 'Ödendi · Hazırlanıyor'
    when 'completed' then 'Tamamlandı'
    when 'rejected' then 'Reddedildi'
    when 'cancelled' then 'İptal Edildi'
    else s end
$$;

create or replace function public._tl(n numeric) returns text
language sql immutable as $$
  select replace(trim(to_char(n, 'FM999G999G990D00')), '.00', '') || ' ₺'
$$;

create or replace function public._transition(p_order public.orders, p_to text, p_by uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set
    status = p_to,
    status_note = p_note,
    updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('status', p_to, 'at', now(), 'by', p_by, 'note', p_note))
  where id = p_order.id;
  insert into messages(order_id, is_system, text, read)
  values (p_order.id, true, 'Sipariş durumu: ' ||
    case when p_to = 'approved' and p_order.payment_method = 'on_delivery' then 'Onaylandı · Teslimatta ödeme' else _status_label(p_to) end ||
    coalesce(' — ' || nullif(p_note, ''), ''), true);
end $$;

-- ---------------------------------------------------------------------
-- Yeni kullanıcı: auth.users'a kayıt eklendiğinde profil oluştur
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(nullif(btrim(meta->>'name'), ''), split_part(new.email, '@', 1));
  v_province text := meta->>'province';
  v_district text := meta->>'district';
  v_neighborhood text := coalesce(nullif(btrim(meta->>'neighborhood'), ''), 'Merkez');
  v_intent text := coalesce(meta->>'intent', 'buyer');
begin
  -- Geçersiz konum kaydı engellemesin diye güvenli varsayılan; kullanıcı profilinden düzeltebilir.
  if not _valid_location(v_province, v_district) then v_province := 'Ankara'; v_district := 'Çankaya'; end if;
  if char_length(v_name) < 3 then v_name := rpad(v_name, 3, '.'); end if;
  insert into profiles(id, name, province, district, neighborhood)
  values (new.id, left(v_name, 80), v_province, v_district, left(v_neighborhood, 80));
  insert into profile_private(id, email, accepted_terms_at, kvkk_consent_at)
  values (new.id, coalesce(new.email, ''),
          case when (meta->>'accepted_terms')::boolean then now() end,
          case when (meta->>'kvkk_consent')::boolean then now() end);
  perform _notify(new.id, 'LezzetHub’a hoş geldin! 🧡',
    case v_intent
      when 'seller' then 'Satış yapmak için hijyen belgeni yükleyerek satıcı başvurunu tamamla.'
      when 'courier' then 'Kurye olarak görünmek için ehliyet bilgilerini yükleyerek başvurunu tamamla.'
      else 'Profilini tamamla ve komşularının lezzetlerini keşfet.' end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profil ve hesap
-- ---------------------------------------------------------------------

create or replace function public.update_profile(
  p_name text, p_bio text, p_province text, p_district text, p_neighborhood text,
  p_address text, p_phone text, p_availability text, p_avatar_url text
) returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  v_phone text := '';
begin
  if char_length(btrim(p_name)) < 3 then perform _fail('Lütfen ad soyad girin.'); end if;
  if not _valid_location(p_province, p_district) then perform _fail('Lütfen geçerli bir il ve ilçe seçin.'); end if;
  if btrim(coalesce(p_neighborhood, '')) = '' then perform _fail('Mahalle zorunludur.'); end if;
  if btrim(coalesce(p_phone, '')) <> '' then
    v_phone := _normalize_phone(p_phone);
    if v_phone is null then perform _fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.'); end if;
  end if;
  update profiles set
    name = btrim(p_name), bio = btrim(coalesce(p_bio, '')), province = p_province, district = p_district,
    neighborhood = btrim(p_neighborhood), availability = btrim(coalesce(p_availability, '')),
    avatar_url = nullif(p_avatar_url, '')
  where id = me.id;
  update profile_private set address = btrim(coalesce(p_address, '')), phone = v_phone where id = me.id;
  update listings set province = p_province, district = p_district, neighborhood = btrim(p_neighborhood) where owner_id = me.id;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me profiles := _me();
begin
  if exists (select 1 from orders where (buyer_id = me.id or seller_id = me.id) and status in ('seller_pending','approved','paid')) then
    perform _fail('Devam eden siparişlerin var. Hesabını silmeden önce siparişlerini tamamla veya iptal et.');
  end if;
  delete from auth.users where id = me.id;
end $$;

-- ---------------------------------------------------------------------
-- Satıcı ve kurye başvuruları
-- ---------------------------------------------------------------------

drop function if exists public.submit_seller_application(text, text, text, text, text, boolean, boolean);
create or replace function public.submit_seller_application(
  p_doc_path text, p_doc_type text, p_barcode text, p_food_registration_no text, p_iban text, p_iban_holder text,
  p_accept_declaration boolean, p_accept_consent boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  v_iban text := _normalize_iban(p_iban);
begin
  if me.seller_status = 'approved' then perform _fail('Satıcı hesabın zaten onaylı.'); end if;
  if coalesce(p_doc_path, '') = '' or split_part(p_doc_path, '/', 1) <> me.id::text then perform _fail('E-Devlet onaylı hijyen belgeni yüklemelisin.'); end if;
  if p_doc_type not in ('image','pdf') then perform _fail('Belge fotoğraf veya PDF olmalıdır.'); end if;
  if char_length(regexp_replace(coalesce(p_barcode, ''), '\s', '', 'g')) < 8 then perform _fail('Belgenin e-Devlet doğrulama (barkod) numarasını girin.'); end if;
  if coalesce(btrim(p_food_registration_no), '') !~ '^[A-Za-z0-9ÇĞİÖŞÜçğıöşü./ -]{5,40}$' or p_food_registration_no !~ '[0-9]{3,}' then
    perform _fail('Gıda işletmesi kayıt numaranı girin (İl/İlçe Tarım ve Orman Müdürlüğü’nden alınır).');
  end if;
  if v_iban is null then perform _fail('Geçerli bir TR IBAN girin (TR ile başlayan 26 karakter).'); end if;
  if char_length(btrim(coalesce(p_iban_holder, ''))) < 3 then perform _fail('IBAN sahibinin adını soyadını girin.'); end if;
  if not coalesce(p_accept_declaration, false) then perform _fail('Satış yapabilmek için mevzuat ve sorumluluk beyanını onaylamalısın.'); end if;
  if not coalesce(p_accept_consent, false) then perform _fail('Belgelerinin işlenmesine ilişkin açık rızayı onaylamalısın.'); end if;
  delete from verifications where user_id = me.id and kind = 'seller';
  insert into verifications(user_id, kind, doc_path, doc_type, doc_number, food_registration_no, iban, iban_holder, declaration_at, document_consent_at)
  values (me.id, 'seller', p_doc_path, p_doc_type, btrim(p_barcode), upper(btrim(p_food_registration_no)), v_iban, btrim(p_iban_holder), now(), now());
  update profiles set seller_status = 'pending' where id = me.id;
  perform _notify_admins('Yeni satıcı başvurusu 📄', me.name || ' hijyen belgesini yükledi; onay bekliyor.');
end $$;

create or replace function public.submit_courier_application(
  p_license_class text, p_license_number text, p_doc_path text, p_doc_type text, p_phone text,
  p_service_province text, p_service_districts text[], p_accept_consent boolean, p_accept_declaration boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  v_phone text := _normalize_phone(p_phone);
  d text;
begin
  if me.courier_status = 'approved' then perform _fail('Kurye hesabın zaten onaylı.'); end if;
  if coalesce(p_license_class, '') not in ('A2','B') then perform _fail('Kurye olabilmek için A2 veya B sınıfı ehliyet gereklidir.'); end if;
  if char_length(regexp_replace(coalesce(p_license_number, ''), '\s', '', 'g')) < 5 then perform _fail('Ehliyet belge numaranı girin.'); end if;
  if coalesce(p_doc_path, '') = '' or split_part(p_doc_path, '/', 1) <> me.id::text then perform _fail('Ehliyetinin fotoğrafını yüklemelisin.'); end if;
  if p_doc_type not in ('image','pdf') then perform _fail('Belge fotoğraf veya PDF olmalıdır.'); end if;
  if v_phone is null then perform _fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.'); end if;
  if coalesce(cardinality(p_service_districts), 0) = 0 then perform _fail('Hizmet vereceğin en az bir ilçe seçin.'); end if;
  foreach d in array p_service_districts loop
    if not _valid_location(p_service_province, d) then perform _fail('Seçilen ilçeler hizmet iline ait olmalı.'); end if;
  end loop;
  if not coalesce(p_accept_consent, false) then perform _fail('Belgelerinin işlenmesine ve telefonunun paylaşılmasına ilişkin açık rızayı onaylamalısın.'); end if;
  if not coalesce(p_accept_declaration, false) then perform _fail('Kurye sorumluluk beyanını onaylamalısın.'); end if;
  delete from verifications where user_id = me.id and kind = 'courier';
  insert into verifications(user_id, kind, doc_path, doc_type, doc_number, license_class, declaration_at, document_consent_at)
  values (me.id, 'courier', p_doc_path, p_doc_type, btrim(p_license_number), p_license_class, now(), now());
  insert into courier_profiles(user_id, license_class, vehicle, phone, service_province, service_districts, available, updated_at)
  values (me.id, p_license_class, case when p_license_class = 'A2' then 'motorcycle' else 'car' end, v_phone,
          p_service_province, (select array_agg(distinct x) from unnest(p_service_districts) x), true, now())
  on conflict (user_id) do update set license_class = excluded.license_class, vehicle = excluded.vehicle, phone = excluded.phone,
    service_province = excluded.service_province, service_districts = excluded.service_districts, updated_at = now();
  update profiles set courier_status = 'pending' where id = me.id;
  update profile_private set phone = v_phone where id = me.id and phone = '';
  perform _notify_admins('Yeni kurye başvurusu 🛵', me.name || ' ' || p_license_class || ' sınıfı ehliyetini yükledi; onay bekliyor.');
end $$;

create or replace function public.update_courier_profile(p_available boolean, p_service_districts text[], p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  c courier_profiles;
  d text;
  v_phone text;
begin
  select * into c from courier_profiles where user_id = me.id;
  if c.user_id is null then perform _fail('Kurye profilin bulunamadı.'); end if;
  if p_service_districts is not null then
    if cardinality(p_service_districts) = 0 then perform _fail('En az bir ilçe seçin.'); end if;
    foreach d in array p_service_districts loop
      if not _valid_location(c.service_province, d) then perform _fail('Seçilen ilçeler hizmet iline ait olmalı.'); end if;
    end loop;
  end if;
  if p_phone is not null then
    v_phone := _normalize_phone(p_phone);
    if v_phone is null then perform _fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.'); end if;
  end if;
  update courier_profiles set
    available = coalesce(p_available, available),
    service_districts = coalesce((select array_agg(distinct x) from unnest(p_service_districts) x), service_districts),
    phone = coalesce(v_phone, phone),
    updated_at = now()
  where user_id = me.id;
end $$;

create or replace function public.review_verification(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles := _require_admin();
  v verifications;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
  v_what text;
begin
  select * into v from verifications where id = p_id for update;
  if v.id is null then perform _fail('Başvuru bulunamadı.'); end if;
  if v.status <> 'pending' then perform _fail('Bu başvuru zaten sonuçlandırıldı.'); end if;
  if not p_approve and btrim(coalesce(p_note, '')) = '' then perform _fail('Reddetme gerekçesini yazmalısın; kullanıcıya iletilecek.'); end if;
  update verifications set status = v_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = me.id where id = p_id;
  if v.kind = 'seller' then
    update profiles set seller_status = v_status,
      food_registration_no = case when p_approve then v.food_registration_no else food_registration_no end
    where id = v.user_id;
  else update profiles set courier_status = v_status where id = v.user_id; end if;
  v_what := case when v.kind = 'seller' then 'Satıcı' else 'Kurye' end;
  if p_approve then
    perform _notify(v.user_id, v_what || ' başvurun onaylandı ✅',
      case when v.kind = 'seller' then 'Artık ilan verip satış yapabilirsin.' else 'Artık yakınındaki satıcı ve alıcılar seni kurye listesinde görebilir.' end);
  else
    perform _notify(v.user_id, v_what || ' başvurun reddedildi', 'Gerekçe: ' || btrim(p_note) || '. Belgeni düzeltip yeniden başvurabilirsin.');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- İlanlar
-- ---------------------------------------------------------------------

drop function if exists public.save_listing(uuid, text, text, numeric, text, text[], text, text[], text, text);
create or replace function public.save_listing(
  p_id uuid, p_title text, p_description text, p_price numeric, p_category text,
  p_images text[], p_prep_time text, p_delivery text[], p_shipping_payer text,
  p_allergens text[], p_no_allergens boolean, p_shelf_life text, p_shelf_stable boolean, p_safety_confirmed boolean,
  p_status text
) returns public.listings language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
  v_allergens text[] := coalesce((select array_agg(distinct a) from unnest(p_allergens) a), '{}');
begin
  if me.seller_status <> 'approved' then perform _fail('İlan verebilmek için satıcı başvurunun (hijyen belgesi) onaylanması gerekir.'); end if;
  if char_length(btrim(p_title)) < 3 then perform _fail('Başlık en az 3 karakter olmalıdır.'); end if;
  if char_length(btrim(p_description)) < 10 then perform _fail('Açıklama en az 10 karakter olmalıdır.'); end if;
  if p_price is null or p_price <= 0 then perform _fail('Geçerli bir fiyat girin.'); end if;
  if coalesce(cardinality(p_delivery), 0) = 0 then perform _fail('En az bir teslimat seçeneği seçmelisiniz.'); end if;
  if coalesce(p_shipping_payer, '') not in ('buyer','seller') then perform _fail('Kargo/kurye ücretinin kime ait olduğunu seçin.'); end if;
  if coalesce(cardinality(p_images), 0) > 6 then perform _fail('En fazla 6 fotoğraf ekleyebilirsin.'); end if;
  if cardinality(v_allergens) = 0 and not coalesce(p_no_allergens, false) then perform _fail('Alerjenleri işaretle ya da ürünün alerjen içermediğini beyan et.'); end if;
  if cardinality(v_allergens) > 0 and coalesce(p_no_allergens, false) then perform _fail('Alerjen seçtiysen “alerjen içermez” beyanını kaldır.'); end if;
  if char_length(btrim(coalesce(p_shelf_life, ''))) < 3 then perform _fail('Son tüketim ve saklama bilgisini yaz (ör. “Buzdolabında 2 gün”).'); end if;
  if 'cargo' = any (p_delivery) and not coalesce(p_shelf_stable, false) then perform _fail('Kargo yalnızca oda sıcaklığında dayanıklı, soğuk zincir gerektirmeyen ürünlerde seçilebilir.'); end if;
  if not coalesce(p_safety_confirmed, false) then perform _fail('Ürünün yasaklı / yüksek riskli gıdalardan olmadığını onaylamalısın.'); end if;

  if p_id is null then
    insert into listings(owner_id, title, description, price, category, images, prep_time, delivery, shipping_payer,
                         allergens, shelf_life, shelf_stable, safety_confirmed_at, status, province, district, neighborhood)
    values (me.id, btrim(p_title), btrim(p_description), round(p_price, 2), p_category, coalesce(p_images, '{}'),
            btrim(coalesce(p_prep_time, '')), p_delivery, p_shipping_payer,
            v_allergens, btrim(p_shelf_life), coalesce(p_shelf_stable, false), now(), p_status, me.province, me.district, me.neighborhood)
    returning * into l;
  else
    select * into l from listings where id = p_id for update;
    if l.id is null then perform _fail('İlan bulunamadı.'); end if;
    if l.owner_id <> me.id then perform _fail('Bu ilanı düzenleme yetkiniz yok.'); end if;
    if l.under_review and p_status = 'active' then perform _fail('Bu ilan hijyen şikayeti nedeniyle incelemede; inceleme bitene kadar yayına alınamaz.'); end if;
    if l.removed_by_admin and p_status = 'active' then perform _fail('Bu ilan yönetici tarafından yayından kaldırıldı.'); end if;
    update listings set
      title = btrim(p_title), description = btrim(p_description), price = round(p_price, 2), category = p_category,
      images = coalesce(p_images, '{}'), prep_time = btrim(coalesce(p_prep_time, '')), delivery = p_delivery,
      shipping_payer = p_shipping_payer, allergens = v_allergens, shelf_life = btrim(p_shelf_life),
      shelf_stable = coalesce(p_shelf_stable, false), safety_confirmed_at = now(), status = p_status, updated_at = now()
    where id = p_id returning * into l;
  end if;
  return l;
end $$;

create or replace function public.set_listing_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
begin
  select * into l from listings where id = p_id for update;
  if l.id is null then perform _fail('İlan bulunamadı.'); end if;
  if me.role = 'admin' then
    update listings set status = p_status, removed_by_admin = (p_status = 'passive'),
      under_review = case when p_status = 'active' then false else under_review end, updated_at = now() where id = p_id;
    if p_status = 'passive' and l.owner_id <> me.id then
      perform _notify(l.owner_id, 'İlanın yayından kaldırıldı', '“' || l.title || '” ilanı yönetici tarafından yayından kaldırıldı.');
    end if;
  else
    if l.owner_id <> me.id then perform _fail('Bu ilan üzerinde yetkiniz yok.'); end if;
    if l.under_review and p_status = 'active' then perform _fail('Bu ilan hijyen şikayeti nedeniyle incelemede; inceleme bitene kadar yayına alınamaz.'); end if;
    if l.removed_by_admin and p_status = 'active' then perform _fail('Bu ilan yönetici tarafından yayından kaldırıldı.'); end if;
    if p_status = 'active' and me.seller_status <> 'approved' then perform _fail('İlanı yayına almak için satıcı başvurunun onaylı olması gerekir.'); end if;
    update listings set status = p_status, updated_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.delete_listing(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
begin
  select * into l from listings where id = p_id;
  if l.id is null then perform _fail('İlan bulunamadı.'); end if;
  if me.role <> 'admin' and l.owner_id <> me.id then perform _fail('Bu ilanı silme yetkiniz yok.'); end if;
  if exists (select 1 from orders where listing_id = p_id and status in ('seller_pending','approved','paid')) then
    perform _fail('Bu ilana ait devam eden siparişler var. Önce siparişleri sonuçlandırın veya ilanı pasifleştirin.');
  end if;
  delete from listings where id = p_id;
  if me.role = 'admin' and l.owner_id <> me.id then
    perform _notify(l.owner_id, 'İlanın silindi', '“' || l.title || '” ilanı yönetici tarafından silindi.');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Siparişler
-- ---------------------------------------------------------------------

create or replace function public.create_order(
  p_listing_id uuid, p_quantity int, p_appointment timestamptz, p_delivery text,
  p_address text, p_note text, p_first_message text
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
  seller profiles;
  o orders;
  v_sub numeric; v_bfee numeric; v_sfee numeric;
  v_method text;
  v_code text;
begin
  select * into l from listings where id = p_listing_id;
  if l.id is null then perform _fail('İlan bulunamadı.'); end if;
  select * into seller from profiles where id = l.owner_id;
  if l.status <> 'active' or not seller.active or seller.seller_status <> 'approved' then perform _fail('Bu ilan şu anda yayında değil.'); end if;
  if l.owner_id = me.id then perform _fail('Kendi ilanınıza sipariş veremezsiniz.'); end if;
  if _is_blocked_between(me.id, l.owner_id) then perform _fail('Bu satıcıyla işlem yapamazsınız.'); end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then perform _fail('Adet 1 ile 50 arasında olmalıdır.'); end if;
  if not (p_delivery = any (l.delivery)) then perform _fail('Bu ilan seçilen teslimat yöntemini desteklemiyor.'); end if;
  if p_appointment < now() then perform _fail('Randevu zamanı geçmiş bir zaman olamaz.'); end if;
  if p_delivery <> 'pickup' and char_length(btrim(coalesce(p_address, ''))) < 10 then
    perform _fail(case when p_delivery = 'cargo' then 'Kargo için açık adresini (mahalle, sokak, no, ilçe/il) girin.' else 'Kurye teslimatı için adres girin.' end);
  end if;

  v_method := case when _payment_mode() = 'online' then 'online' else 'on_delivery' end;
  v_sub := round(l.price * p_quantity, 2);
  -- Teslimatta ödemede (pilot) platform para almadığı için hizmet bedeli yoktur.
  v_bfee := case when v_method = 'online' then round(v_sub * buyer_fee_rate(), 2) else 0 end;
  v_sfee := case when v_method = 'online' then round(v_sub * seller_fee_rate(), 2) else 0 end;
  loop
    v_code := 'LH-' || (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  insert into orders(code, buyer_id, seller_id, listing_id, listing_title, unit_price, quantity, appointment, delivery, shipping_payer,
                     payment_method, address, note, subtotal, buyer_fee, seller_fee, buyer_total, seller_net, history)
  values (v_code, me.id, l.owner_id, l.id, l.title, l.price, p_quantity, p_appointment, p_delivery, l.shipping_payer, v_method,
          case when p_delivery = 'pickup' then '' else btrim(p_address) end, btrim(coalesce(p_note, '')),
          v_sub, v_bfee, v_sfee, v_sub + v_bfee, v_sub - v_sfee,
          jsonb_build_array(jsonb_build_object('status', 'seller_pending', 'at', now(), 'by', me.id)))
  returning * into o;

  insert into messages(order_id, sender_id, receiver_id, text)
  values (o.id, me.id, l.owner_id, left(coalesce(nullif(btrim(p_first_message), ''), 'Merhaba! Yeni bir sipariş oluşturdum.'), 1000));
  perform _notify(l.owner_id, 'Yeni sipariş talebi 🛎', me.name || ', “' || l.title || '” için ' || p_quantity || ' adet sipariş verdi.', o.id);
  return o;
end $$;

-- api.availableActions ile aynı kurallar. Ödeme ve iade ayrı akışlardır (ödeme fonksiyonları).
create or replace function public.order_action(p_order_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  o orders;
  is_buyer boolean; is_seller boolean;
  allowed text[] := '{}';
  v_title text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  is_buyer := o.buyer_id = me.id;
  is_seller := o.seller_id = me.id;

  case o.status
    when 'seller_pending' then
      if is_seller then allowed := allowed || array['approve','reject']; end if;
      if is_buyer then allowed := allowed || array['cancel']; end if;
    when 'approved' then
      if (is_buyer or is_seller) and o.payment_method = 'on_delivery' then allowed := allowed || array['complete']; end if;
      if is_buyer or is_seller then allowed := allowed || array['cancel']; end if;
    when 'paid' then
      if is_buyer or is_seller then allowed := allowed || array['complete']; end if;
    else null;
  end case;
  if not (p_action = any (allowed)) then perform _fail('Bu işlem şu anda yapılamaz.'); end if;

  v_title := '“' || o.listing_title || '” (' || o.code || ')';

  if p_action = 'approve' then
    if o.delivery = 'pickup' then
      update orders set pickup_address = coalesce(
        (select nullif(address, '') from profile_private where id = me.id), me.neighborhood || ', ' || me.district || '/' || me.province)
      where id = o.id;
    end if;
    perform _transition(o, 'approved', me.id);
    perform _notify(o.buyer_id, 'Siparişin onaylandı ✅',
      case when o.payment_method = 'online'
        then v_title || ' satıcı tarafından onaylandı. Online ödemeyi yaparak siparişini kesinleştir.'
        else v_title || ' satıcı tarafından onaylandı. Ödemeyi teslimatta doğrudan satıcıya yapacaksın (' || _tl(o.buyer_total) || ').' end, o.id);
  elsif p_action = 'reject' then
    perform _transition(o, 'rejected', me.id, coalesce(v_note, 'Satıcı siparişi reddetti'));
    perform _notify(o.buyer_id, 'Sipariş reddedildi', v_title || ' satıcı tarafından reddedildi.', o.id);
  elsif p_action = 'cancel' then
    perform _transition(o, 'cancelled', me.id, coalesce(v_note, 'Sipariş iptal edildi'));
    if o.buyer_id is distinct from me.id then perform _notify(o.buyer_id, 'Sipariş iptal edildi', v_title || ' iptal edildi.', o.id); end if;
    if o.seller_id is distinct from me.id then perform _notify(o.seller_id, 'Sipariş iptal edildi', v_title || ' iptal edildi.', o.id); end if;
    update payments set status = 'failed', error_message = 'Sipariş iptal edildi' where order_id = o.id and status = 'pending';
  elsif p_action = 'complete' then
    perform _transition(o, 'completed', me.id);
    perform _notify(case when is_buyer then o.seller_id else o.buyer_id end,
      'Sipariş tamamlandı 🧡', v_title || ' tamamlandı olarak işaretlendi. Afiyet olsun!', o.id);
  end if;
end $$;

create or replace function public.set_shipment(p_order_id uuid, p_company text, p_tracking text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  if o.seller_id is distinct from me.id then perform _fail('Kargo bilgisini yalnızca satıcı girebilir.'); end if;
  if o.delivery <> 'cargo' then perform _fail('Bu sipariş kargo ile gönderilmiyor.'); end if;
  if o.payment_method = 'online' and o.status <> 'paid' then perform _fail('Kargo bilgisi ödeme alındıktan sonra girilebilir.'); end if;
  if o.payment_method = 'on_delivery' and o.status <> 'approved' then perform _fail('Kargo bilgisi sipariş onaylandıktan sonra girilebilir.'); end if;
  if char_length(btrim(coalesce(p_company, ''))) < 2 or char_length(btrim(coalesce(p_tracking, ''))) < 4 then
    perform _fail('Kargo firmasını ve takip numarasını girin.');
  end if;
  update orders set shipping_company = btrim(p_company), tracking_code = btrim(p_tracking), updated_at = now() where id = o.id;
  insert into messages(order_id, is_system, text, read)
  values (o.id, true, 'Kargoya verildi: ' || btrim(p_company) || ' · Takip no: ' || btrim(p_tracking), true);
  perform _notify(o.buyer_id, 'Siparişin kargoya verildi 📦', o.listing_title || ' — ' || btrim(p_company) || ', takip no: ' || btrim(p_tracking), o.id);
end $$;

-- ---------------------------------------------------------------------
-- Online ödeme (YALNIZCA sunucu fonksiyonları / service_role çağırır)
-- ---------------------------------------------------------------------

-- Ödeme başlatılabilir mi? Siparişi ve alıcı bilgilerini döner.
create or replace function public.payment_prepare(p_order_id uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders; b profiles; bp profile_private;
begin
  select * into o from orders where id = p_order_id;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  if o.buyer_id is distinct from p_user then perform _fail('Bu siparişin ödemesini yalnızca alıcı yapabilir.'); end if;
  if o.payment_method <> 'online' then perform _fail('Bu siparişin ödemesi teslimatta doğrudan satıcıya yapılır.'); end if;
  if o.status <> 'approved' then perform _fail('Bu sipariş için şu anda ödeme yapılamaz.'); end if;
  select * into b from profiles where id = p_user;
  if not b.active then perform _fail('Hesabın pasif durumda.'); end if;
  select * into bp from profile_private where id = p_user;
  -- Yarım kalan eski ödeme denemelerini kapat.
  update payments set status = 'failed', error_message = 'Yeni ödeme denemesi başlatıldı' where order_id = o.id and status = 'pending';
  return jsonb_build_object('order', to_jsonb(o), 'buyer', to_jsonb(b), 'buyerPrivate', to_jsonb(bp));
end $$;

create or replace function public.payment_record_pending(p_order_id uuid, p_token text, p_amount numeric) returns void
language sql security definer set search_path = public as $$
  insert into payments(order_id, amount, provider, status, provider_token) values (p_order_id, p_amount, 'iyzico', 'pending', p_token);
$$;

-- iyzico sonucu doğrulandıktan sonra çağrılır. Tutar sipariş toplamıyla eşleşmelidir; eşleşmezse ödeme
-- başarısız sayılır, adminler uyarılır ve null döner (kayıt geri alınmasın diye hata fırlatılmaz).
-- Tekrar çağrılırsa sonuç değişmez.
create or replace function public.payment_confirm(
  p_token text, p_payment_id text, p_transaction_id text, p_paid_price numeric, p_last4 text, p_association text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  p payments; o orders; v_title text;
begin
  select * into p from payments where provider_token = p_token for update;
  if p.id is null then perform _fail('Ödeme kaydı bulunamadı.'); end if;
  if p.status = 'succeeded' then return p.order_id; end if;
  select * into o from orders where id = p.order_id for update;
  if round(p_paid_price, 2) <> o.buyer_total then
    update payments set status = 'failed', error_message = 'Tutar uyuşmazlığı' where id = p.id;
    perform _notify_admins('Ödeme tutarı uyuşmuyor ⚠️', o.code || ' için beklenen ' || _tl(o.buyer_total) || ', gelen ' || _tl(p_paid_price) || '. İade edin.', o.id);
    return null;
  end if;
  update payments set status = 'succeeded', provider_payment_id = p_payment_id, provider_transaction_id = p_transaction_id,
    card_last4 = p_last4, card_association = p_association, paid_at = now()
  where id = p.id;
  if o.status = 'approved' then
    perform _transition(o, 'paid', o.buyer_id);
    v_title := '“' || o.listing_title || '” (' || o.code || ')';
    perform _notify(o.buyer_id, 'Ödemen alındı 🎉', v_title || ' için ' || _tl(o.buyer_total) || ' ödemen alındı. Satıcı hazırlığa başlıyor.', o.id);
    perform _notify(o.seller_id, 'Ödeme alındı 🎉', v_title || ' için ödeme alındı. Randevu saatine göre hazırlığa başlayabilirsin.', o.id);
  else
    -- Sipariş bu arada iptal edildiyse ödeme iade edilmelidir.
    perform _notify_admins('İade gerekiyor ⚠️', o.code || ' iptal edilmişken ödeme alındı; iade edin.', o.id);
  end if;
  return o.id;
end $$;

create or replace function public.payment_fail(p_token text, p_error text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  update payments set status = 'failed', error_message = left(coalesce(p_error, 'Ödeme başarısız'), 300)
  where provider_token = p_token and status = 'pending' returning * into p;
  return p.order_id;
end $$;

-- İade öncesi kontrol: admin mi, iade edilecek başarılı ödeme var mı?
create or replace function public.payment_for_refund(p_order_id uuid, p_admin uuid) returns public.payments
language plpgsql security definer set search_path = public as $$
declare p payments; o orders;
begin
  if not exists (select 1 from profiles where id = p_admin and role = 'admin' and active) then perform _fail('Bu işlem için yönetici yetkisi gerekiyor.'); end if;
  select * into o from orders where id = p_order_id;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  if o.status <> 'paid' then perform _fail('Yalnızca ödenmiş ve tamamlanmamış siparişler iade edilebilir.'); end if;
  select * into p from payments where order_id = p_order_id and status = 'succeeded' order by paid_at desc limit 1;
  if p.id is null then perform _fail('İade edilecek başarılı ödeme bulunamadı.'); end if;
  return p;
end $$;

create or replace function public.payment_mark_refunded(p_payment_id uuid, p_admin uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare p payments; o orders; v_title text;
begin
  select * into p from payments where id = p_payment_id for update;
  if p.id is null or p.status <> 'succeeded' then perform _fail('İade edilecek başarılı ödeme bulunamadı.'); end if;
  update payments set status = 'refunded', refunded_at = now(), refund_note = coalesce(nullif(btrim(p_note), ''), 'Yönetici tarafından iade edildi') where id = p.id;
  select * into o from orders where id = p.order_id for update;
  perform _transition(o, 'cancelled', p_admin, 'İade edildi' || coalesce(' — ' || nullif(btrim(p_note), ''), ''));
  v_title := '“' || o.listing_title || '” (' || o.code || ')';
  perform _notify(o.buyer_id, 'Ödemen iade edildi', v_title || ' iptal edildi ve ' || _tl(p.amount) || ' kartına iade edildi.', o.id);
  perform _notify(o.seller_id, 'Sipariş iptal ve iade edildi', v_title || ' yönetici tarafından iptal edilip iade edildi.', o.id);
end $$;

-- ---------------------------------------------------------------------
-- Mesajlar ve bildirimler
-- ---------------------------------------------------------------------

create or replace function public.send_message(p_order_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  o orders;
  v_to uuid;
  v_body text := btrim(coalesce(p_text, ''));
begin
  select * into o from orders where id = p_order_id;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  if me.id is distinct from o.buyer_id and me.id is distinct from o.seller_id then perform _fail('Bu sohbete mesaj gönderemezsiniz.'); end if;
  if v_body = '' then return; end if;
  if char_length(v_body) > 1000 then perform _fail('Mesaj en fazla 1000 karakter olabilir.'); end if;
  v_to := case when me.id = o.buyer_id then o.seller_id else o.buyer_id end;
  if v_to is null then perform _fail('Karşı taraf hesabını silmiş.'); end if;
  if _is_blocked_between(me.id, v_to) then perform _fail('Bu kullanıcıyla mesajlaşamazsınız.'); end if;
  insert into messages(order_id, sender_id, receiver_id, text) values (o.id, me.id, v_to, v_body);
  perform _notify(v_to, '💬 ' || me.name, case when char_length(v_body) > 80 then left(v_body, 80) || '…' else v_body end, o.id);
end $$;

create or replace function public.mark_chat_read(p_order_id uuid) returns void
language sql security definer set search_path = public as $$
  update messages set read = true where order_id = p_order_id and receiver_id = auth.uid() and not read;
  update notifications set read = true where user_id = auth.uid() and order_id = p_order_id and title like '💬%' and not read;
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- ---------------------------------------------------------------------
-- Şikayet ve engelleme
-- ---------------------------------------------------------------------

-- Hijyen şikayetinde otomatik yayından kaldırma eşiği: ürünü satın almış bir alıcıdan 1 şikayet
-- veya 2 farklı kişiden şikayet.
create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
  v_hold boolean := false;
begin
  if p_target_type = 'listing' and not exists (select 1 from listings where id = p_target_id) then perform _fail('Şikayet edilen içerik bulunamadı.'); end if;
  if p_target_type = 'user' and not exists (select 1 from profiles where id = p_target_id) then perform _fail('Şikayet edilen içerik bulunamadı.'); end if;
  if p_target_type = 'user' and p_target_id = me.id then perform _fail('Kendini şikayet edemezsin.'); end if;
  if exists (select 1 from reports where reporter_id = me.id and target_id = p_target_id and status = 'open') then
    perform _fail('Bu içerik için açık bir şikayetin zaten var. İnceleniyor.');
  end if;
  insert into reports(reporter_id, target_type, target_id, reason, note)
  values (me.id, p_target_type, p_target_id, p_reason, left(btrim(coalesce(p_note, '')), 500));

  if p_target_type = 'listing' and p_reason = 'hygiene' then
    select * into l from listings where id = p_target_id for update;
    v_hold := exists (select 1 from orders where listing_id = p_target_id and buyer_id = me.id and status in ('paid','completed'))
      or (select count(distinct reporter_id) from reports where target_id = p_target_id and reason = 'hygiene' and status = 'open') >= 2;
    if v_hold and not l.under_review then
      update listings set under_review = true, status = 'passive', updated_at = now() where id = l.id;
      perform _notify(l.owner_id, 'İlanın incelemeye alındı ⚠️',
        '“' || l.title || '” hakkında hijyen / gıda güvenliği şikayeti geldi. İlan inceleme bitene kadar yayından kaldırıldı; yönetici seninle iletişime geçebilir.');
      perform _notify_admins('ACİL: Hijyen şikayeti 🚨', '“' || l.title || '” ilanı hijyen şikayeti nedeniyle otomatik olarak yayından kaldırıldı. Lütfen 24 saat içinde inceleyin.');
      return;
    end if;
  end if;
  perform _notify_admins('Yeni şikayet 🚩', case when p_target_type = 'listing' then 'Bir ilan şikayet edildi.' else 'Bir kullanıcı şikayet edildi.' end);
end $$;

-- Admin: incelemedeki ilanı temize çıkarıp yeniden yayına alır, ilgili açık şikayetleri kapatır.
create or replace function public.admin_reinstate_listing(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l listings;
  owner profiles;
begin
  perform _require_admin();
  select * into l from listings where id = p_id for update;
  if l.id is null then perform _fail('İlan bulunamadı.'); end if;
  select * into owner from profiles where id = l.owner_id;
  update listings set under_review = false, removed_by_admin = false,
    status = case when owner.active and owner.seller_status = 'approved' then 'active' else status end,
    updated_at = now()
  where id = p_id;
  update reports set status = 'resolved' where target_id = p_id and status = 'open';
  perform _notify(l.owner_id, 'İlanın yeniden yayında ✅', '“' || l.title || '” ilanı incelendi ve yeniden yayına alındı.');
end $$;

create or replace function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := _me();
begin
  if p_user_id = me.id then perform _fail('Kendini engelleyemezsin.'); end if;
  insert into blocks(blocker_id, blocked_id) values (me.id, p_user_id) on conflict do nothing;
end $$;

create or replace function public.unblock_user(p_user_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------

create or replace function public.resolve_report(p_report_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update reports set status = 'resolved' where id = p_report_id;
  if not found then perform _fail('Şikayet bulunamadı.'); end if;
end $$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := _require_admin();
begin
  if p_user_id = me.id then perform _fail('Kendi hesabınızı pasifleştiremezsiniz.'); end if;
  update profiles set active = p_active where id = p_user_id;
  if not found then perform _fail('Kullanıcı bulunamadı.'); end if;
  if not p_active then update listings set status = 'passive' where owner_id = p_user_id; end if;
end $$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := _require_admin();
begin
  if p_user_id = me.id then perform _fail('Kendi yetkinizi değiştiremezsiniz.'); end if;
  update profiles set role = p_role where id = p_user_id;
  if not found then perform _fail('Kullanıcı bulunamadı.'); end if;
end $$;

create or replace function public.admin_delete_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare me profiles := _require_admin();
begin
  if p_user_id = me.id then perform _fail('Kendi hesabınızı silemezsiniz.'); end if;
  if exists (select 1 from orders where (buyer_id = p_user_id or seller_id = p_user_id) and status in ('seller_pending','approved','paid')) then
    perform _fail('Kullanıcının devam eden siparişleri var. Önce siparişleri sonuçlandırın veya kullanıcıyı pasifleştirin.');
  end if;
  delete from auth.users where id = p_user_id;
end $$;

-- Tamamlanan siparişlerin net tutarının satıcının IBAN'ına aktarıldığını işaretler.
create or replace function public.admin_mark_payout(p_order_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles := _require_admin(); o orders;
begin
  for o in select * from orders where id = any (p_order_ids) for update loop
    if o.payment_method <> 'online' then perform _fail('Teslimatta ödenen siparişlerde satıcıya aktarım yapılmaz.'); end if;
    if o.status <> 'completed' then perform _fail('Yalnızca tamamlanan siparişler için satıcıya ödeme yapılır.'); end if;
    if o.payout_status = 'paid' then continue; end if;
    update orders set payout_status = 'paid', payout_at = now() where id = o.id;
    perform _notify(o.seller_id, 'Kazancın hesabına gönderildi 💸', '“' || o.listing_title || '” (' || o.code || ') için ' || _tl(o.seller_net) || ' IBAN’ına aktarıldı.', o.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Yetkiler ve satır düzeyi güvenlik
-- ---------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.tr_districts enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.verifications enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

revoke all on public.app_settings, public.tr_districts, public.profiles, public.profile_private, public.verifications, public.courier_profiles,
  public.listings, public.orders, public.messages, public.payments, public.notifications, public.reports, public.blocks
  from anon, authenticated;
grant select on public.app_settings, public.tr_districts, public.profiles, public.listings to anon, authenticated;
grant select on public.profile_private, public.verifications, public.courier_profiles, public.orders, public.messages,
  public.payments, public.notifications, public.reports, public.blocks to authenticated;

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select using (true);

drop policy if exists districts_read on public.tr_districts;
create policy districts_read on public.tr_districts for select using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (active or id = auth.uid() or public.is_admin());

drop policy if exists private_read on public.profile_private;
create policy private_read on public.profile_private for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists verifications_read on public.verifications;
create policy verifications_read on public.verifications for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists couriers_read on public.courier_profiles;
create policy couriers_read on public.courier_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.profiles p where p.id = user_id and p.active and p.courier_status = 'approved'));

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (
    (status = 'active' and not removed_by_admin
      and exists (select 1 from public.profiles p where p.id = owner_id and p.active and p.seller_status = 'approved'))
    or owner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists blocks_read on public.blocks;
create policy blocks_read on public.blocks for select to authenticated using (blocker_id = auth.uid());

-- İç yardımcılar ve ödeme fonksiyonları istemciden çağrılamaz.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.buyer_fee_rate(), public.seller_fee_rate() to anon, authenticated;
grant execute on function
  public.update_profile(text, text, text, text, text, text, text, text, text),
  public.delete_my_account(),
  public.submit_seller_application(text, text, text, text, text, text, boolean, boolean),
  public.submit_courier_application(text, text, text, text, text, text, text[], boolean, boolean),
  public.update_courier_profile(boolean, text[], text),
  public.review_verification(uuid, boolean, text),
  public.save_listing(uuid, text, text, numeric, text, text[], text, text[], text, text[], boolean, text, boolean, boolean, text),
  public.set_listing_status(uuid, text),
  public.delete_listing(uuid),
  public.create_order(uuid, int, timestamptz, text, text, text, text),
  public.order_action(uuid, text, text),
  public.set_shipment(uuid, text, text),
  public.send_message(uuid, text),
  public.mark_chat_read(uuid),
  public.mark_notifications_read(),
  public.report_content(text, uuid, text, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.resolve_report(uuid),
  public.admin_reinstate_listing(uuid),
  public.admin_set_user_active(uuid, boolean),
  public.admin_set_user_role(uuid, text),
  public.admin_delete_user(uuid),
  public.admin_mark_payout(uuid[])
  to authenticated;
grant select on all tables in schema public to service_role;
grant execute on function
  public.payment_prepare(uuid, uuid),
  public.payment_record_pending(uuid, text, numeric),
  public.payment_confirm(text, text, text, numeric, text, text),
  public.payment_fail(text, text),
  public.payment_for_refund(uuid, uuid),
  public.payment_mark_refunded(uuid, uuid, text)
  to service_role;
