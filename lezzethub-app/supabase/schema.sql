-- =====================================================================
-- LezzetHub — Supabase veritabanı şeması
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.
-- Ardından storage.sql ve realtime.sql dosyalarını da aynı şekilde çalıştır.
--
-- Güvenlik modeli:
--  * Tablolara istemciden doğrudan yazma YOKTUR (insert/update/delete yetkisi kaldırıldı).
--  * Tüm değişiklikler aşağıdaki SECURITY DEFINER fonksiyonlarıyla yapılır; iş kuralları
--    (sipariş durum akışı, komisyon, yetki) sunucuda uygulanır.
--  * Okuma satır düzeyi güvenlik (RLS) ile sınırlanır.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Sabitler
-- ---------------------------------------------------------------------

create or replace function public.hatay_districts() returns text[]
language sql immutable as $$
  select array['Antakya','Arsuz','Altınözü','Belen','Defne','Dörtyol','Erzin','Hassa',
               'İskenderun','Kırıkhan','Kumlu','Payas','Reyhanlı','Samandağ','Yayladağı']
$$;

create or replace function public.buyer_fee_rate() returns numeric language sql immutable as $$ select 0.10::numeric $$;
create or replace function public.seller_fee_rate() returns numeric language sql immutable as $$ select 0.15::numeric $$;

-- ---------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  role text not null default 'user' check (role in ('user','admin')),
  active boolean not null default true,
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_url text,
  district text not null check (district = any (public.hatay_districts())),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 1 and 60),
  availability text not null default '' check (char_length(availability) <= 120),
  created_at timestamptz not null default now()
);

-- Yalnızca kullanıcının kendisi ve adminlerin görebildiği alanlar.
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  address text not null default '' check (char_length(address) <= 300),
  accepted_terms_at timestamptz
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
  delivery text[] not null check (cardinality(delivery) >= 1 and delivery <@ array['courier','pickup']::text[]),
  status text not null default 'active' check (status in ('active','passive')),
  removed_by_admin boolean not null default false,
  district text not null,
  neighborhood text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_owner_idx on public.listings(owner_id);
create index if not exists listings_district_idx on public.listings(district) where status = 'active';

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
  delivery text not null check (delivery in ('courier','pickup')),
  address text not null default '',
  pickup_address text,
  note text not null default '' check (char_length(note) <= 300),
  subtotal numeric(10,2) not null,
  buyer_fee numeric(10,2) not null,
  seller_fee numeric(10,2) not null,
  buyer_total numeric(10,2) not null,
  seller_net numeric(10,2) not null,
  status text not null default 'seller_pending'
    check (status in ('seller_pending','approved','payment_pending','paid','completed','rejected','cancelled')),
  status_note text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_buyer_idx on public.orders(buyer_id);
create index if not exists orders_seller_idx on public.orders(seller_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null, -- null: sistem mesajı
  receiver_id uuid references public.profiles(id) on delete set null,
  is_system boolean not null default false,
  text text not null check (char_length(text) between 1 and 1000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_order_idx on public.messages(order_id, created_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

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

-- ---------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active)
$$;

-- Oturum açmış ve aktif kullanıcıyı döner; değilse anlaşılır bir hata verir.
create or replace function public._me() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'Bu işlem için giriş yapmalısın.' using errcode = 'P0001'; end if;
  if not me.active then raise exception 'Hesabın pasif durumda. Lütfen destek ile iletişime geçin.' using errcode = 'P0001'; end if;
  return me;
end $$;

create or replace function public._fail(msg text) returns void
language plpgsql as $$ begin raise exception '%', msg using errcode = 'P0001'; end $$;

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

create or replace function public._status_label(s text) returns text
language sql immutable as $$
  select case s
    when 'seller_pending' then 'Satıcı Onayı Bekliyor'
    when 'approved' then 'Onaylandı'
    when 'payment_pending' then 'Ödeme Admin Onayı Bekliyor'
    when 'paid' then 'Ödeme Onaylandı'
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
  values (p_order.id, true, 'Sipariş durumu: ' || _status_label(p_to) || coalesce(' — ' || nullif(p_note, ''), ''), true);
end $$;

-- ---------------------------------------------------------------------
-- Yeni kullanıcı: auth.users'a kayıt eklendiğinde profil oluştur
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(nullif(btrim(meta->>'name'), ''), split_part(new.email, '@', 1));
  v_district text := meta->>'district';
  v_neighborhood text := coalesce(nullif(btrim(meta->>'neighborhood'), ''), 'Merkez');
begin
  if v_district is null or not (v_district = any (hatay_districts())) then v_district := 'Antakya'; end if;
  if char_length(v_name) < 3 then v_name := rpad(v_name, 3, '.'); end if;
  insert into profiles(id, name, district, neighborhood) values (new.id, left(v_name, 80), v_district, left(v_neighborhood, 60));
  insert into profile_private(id, email, accepted_terms_at)
  values (new.id, coalesce(new.email, ''), case when (meta->>'accepted_terms')::boolean then now() end);
  perform _notify(new.id, 'LezzetHub’a hoş geldin! 🧡', 'Profilini tamamla, ilk ilanını ver ya da komşularının lezzetlerini keşfet.');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------

create or replace function public.update_profile(
  p_name text, p_bio text, p_district text, p_neighborhood text,
  p_address text, p_availability text, p_avatar_url text
) returns void language plpgsql security definer set search_path = public as $$
declare me profiles := _me();
begin
  if char_length(btrim(p_name)) < 3 then perform _fail('Lütfen ad soyad girin.'); end if;
  if not (p_district = any (hatay_districts())) then perform _fail('Lütfen Hatay ilçelerinden birini seçin.'); end if;
  if btrim(coalesce(p_neighborhood, '')) = '' then perform _fail('Mahalle zorunludur.'); end if;
  update profiles set
    name = btrim(p_name), bio = btrim(coalesce(p_bio, '')), district = p_district,
    neighborhood = btrim(p_neighborhood), availability = btrim(coalesce(p_availability, '')),
    avatar_url = nullif(p_avatar_url, '')
  where id = me.id;
  update profile_private set address = btrim(coalesce(p_address, '')) where id = me.id;
  -- İlanlar satıcının konumunu miras alır.
  update listings set district = p_district, neighborhood = btrim(p_neighborhood) where owner_id = me.id;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me profiles := _me();
begin
  if exists (select 1 from orders where (buyer_id = me.id or seller_id = me.id)
             and status in ('seller_pending','approved','payment_pending','paid')) then
    perform _fail('Devam eden siparişlerin var. Hesabını silmeden önce siparişlerini tamamla veya iptal et.');
  end if;
  delete from auth.users where id = me.id; -- profil ve bağlı veriler cascade ile silinir
end $$;

-- ---------------------------------------------------------------------
-- İlanlar
-- ---------------------------------------------------------------------

create or replace function public.save_listing(
  p_id uuid, p_title text, p_description text, p_price numeric, p_category text,
  p_images text[], p_prep_time text, p_delivery text[], p_status text
) returns public.listings language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  l listings;
begin
  if char_length(btrim(p_title)) < 3 then perform _fail('Başlık en az 3 karakter olmalıdır.'); end if;
  if char_length(btrim(p_description)) < 10 then perform _fail('Açıklama en az 10 karakter olmalıdır.'); end if;
  if p_price is null or p_price <= 0 then perform _fail('Geçerli bir fiyat girin.'); end if;
  if coalesce(cardinality(p_delivery), 0) = 0 then perform _fail('En az bir teslimat seçeneği seçmelisiniz.'); end if;
  if coalesce(cardinality(p_images), 0) > 6 then perform _fail('En fazla 6 fotoğraf ekleyebilirsin.'); end if;

  if p_id is null then
    insert into listings(owner_id, title, description, price, category, images, prep_time, delivery, status, district, neighborhood)
    values (me.id, btrim(p_title), btrim(p_description), round(p_price, 2), p_category, coalesce(p_images, '{}'),
            btrim(coalesce(p_prep_time, '')), p_delivery, p_status, me.district, me.neighborhood)
    returning * into l;
  else
    select * into l from listings where id = p_id for update;
    if l.id is null then perform _fail('İlan bulunamadı.'); end if;
    if l.owner_id <> me.id then perform _fail('Bu ilanı düzenleme yetkiniz yok.'); end if;
    if l.removed_by_admin and p_status = 'active' then perform _fail('Bu ilan yönetici tarafından yayından kaldırıldı.'); end if;
    update listings set
      title = btrim(p_title), description = btrim(p_description), price = round(p_price, 2), category = p_category,
      images = coalesce(p_images, '{}'), prep_time = btrim(coalesce(p_prep_time, '')), delivery = p_delivery,
      status = p_status, updated_at = now()
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
    update listings set status = p_status, removed_by_admin = (p_status = 'passive'), updated_at = now() where id = p_id;
    if p_status = 'passive' and l.owner_id <> me.id then
      perform _notify(l.owner_id, 'İlanın yayından kaldırıldı', '“' || l.title || '” ilanı yönetici tarafından yayından kaldırıldı.');
    end if;
  else
    if l.owner_id <> me.id then perform _fail('Bu ilan üzerinde yetkiniz yok.'); end if;
    if l.removed_by_admin and p_status = 'active' then perform _fail('Bu ilan yönetici tarafından yayından kaldırıldı.'); end if;
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
  if exists (select 1 from orders where listing_id = p_id and status in ('seller_pending','approved','payment_pending','paid')) then
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
  v_code text;
begin
  select * into l from listings where id = p_listing_id;
  if l.id is null then perform _fail('İlan bulunamadı.'); end if;
  select * into seller from profiles where id = l.owner_id;
  if l.status <> 'active' or not seller.active then perform _fail('Bu ilan şu anda yayında değil.'); end if;
  if l.owner_id = me.id then perform _fail('Kendi ilanınıza sipariş veremezsiniz.'); end if;
  if _is_blocked_between(me.id, l.owner_id) then perform _fail('Bu satıcıyla işlem yapamazsınız.'); end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then perform _fail('Adet 1 ile 50 arasında olmalıdır.'); end if;
  if not (p_delivery = any (l.delivery)) then perform _fail('Bu ilan seçilen teslimat yöntemini desteklemiyor.'); end if;
  if p_appointment < now() then perform _fail('Randevu zamanı geçmiş bir zaman olamaz.'); end if;
  if p_delivery = 'courier' and char_length(btrim(coalesce(p_address, ''))) < 5 then perform _fail('Kurye teslimatı için adres girin.'); end if;

  v_sub := round(l.price * p_quantity, 2);
  v_bfee := round(v_sub * buyer_fee_rate(), 2);
  v_sfee := round(v_sub * seller_fee_rate(), 2);
  loop
    v_code := 'LH-' || (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  insert into orders(code, buyer_id, seller_id, listing_id, listing_title, unit_price, quantity, appointment, delivery,
                     address, note, subtotal, buyer_fee, seller_fee, buyer_total, seller_net, history)
  values (v_code, me.id, l.owner_id, l.id, l.title, l.price, p_quantity, p_appointment, p_delivery,
          case when p_delivery = 'courier' then btrim(p_address) else '' end, btrim(coalesce(p_note, '')),
          v_sub, v_bfee, v_sfee, v_sub + v_bfee, v_sub - v_sfee,
          jsonb_build_array(jsonb_build_object('status', 'seller_pending', 'at', now(), 'by', me.id)))
  returning * into o;

  -- Sipariş açılınca otomatik ilk mesaj (metni istemci randevuyu yerel saatle biçimlendirerek gönderir).
  insert into messages(order_id, sender_id, receiver_id, text)
  values (o.id, me.id, l.owner_id, left(coalesce(nullif(btrim(p_first_message), ''), 'Merhaba! Yeni bir sipariş oluşturdum.'), 1000));
  perform _notify(l.owner_id, 'Yeni sipariş talebi 🛎',
    me.name || ', “' || l.title || '” için ' || p_quantity || ' adet sipariş verdi.', o.id);
  return o;
end $$;

create or replace function public.order_action(p_order_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  o orders;
  is_buyer boolean; is_seller boolean; is_adm boolean;
  allowed text[] := '{}';
  v_title text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  a record;
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null then perform _fail('Sipariş bulunamadı.'); end if;
  is_buyer := o.buyer_id = me.id;
  is_seller := o.seller_id = me.id;
  is_adm := me.role = 'admin';

  -- api.availableActions ile aynı kurallar
  case o.status
    when 'seller_pending' then
      if is_seller then allowed := allowed || array['approve','reject']; end if;
      if is_buyer then allowed := allowed || array['cancel']; end if;
    when 'approved' then
      if is_buyer then allowed := allowed || array['pay','cancel']; end if;
      if is_seller then allowed := allowed || array['cancel']; end if;
    when 'payment_pending' then
      if is_adm then allowed := allowed || array['paymentApprove','paymentReject']; end if;
    when 'paid' then
      if is_buyer or is_seller then allowed := allowed || array['complete']; end if;
      if is_adm then allowed := allowed || array['cancel']; end if;
    else null;
  end case;
  if not (p_action = any (allowed)) then perform _fail('Bu işlem şu anda yapılamaz.'); end if;

  v_title := '“' || o.listing_title || '” (' || o.code || ')';

  if p_action = 'approve' then
    if o.delivery = 'pickup' then
      update orders set pickup_address = coalesce(
        (select nullif(address, '') from profile_private where id = me.id), me.neighborhood || ', ' || me.district)
      where id = o.id;
    end if;
    perform _transition(o, 'approved', me.id);
    perform _notify(o.buyer_id, 'Siparişin onaylandı ✅', v_title || ' satıcı tarafından onaylandı. Ödeme adımına geçebilirsin.', o.id);

  elsif p_action = 'reject' then
    perform _transition(o, 'rejected', me.id, coalesce(v_note, 'Satıcı siparişi reddetti'));
    perform _notify(o.buyer_id, 'Sipariş reddedildi', v_title || ' satıcı tarafından reddedildi.', o.id);

  elsif p_action = 'cancel' then
    perform _transition(o, 'cancelled', me.id, coalesce(v_note, 'Sipariş iptal edildi'));
    if o.buyer_id is distinct from me.id then perform _notify(o.buyer_id, 'Sipariş iptal edildi', v_title || ' iptal edildi.', o.id); end if;
    if o.seller_id is distinct from me.id then perform _notify(o.seller_id, 'Sipariş iptal edildi', v_title || ' iptal edildi.', o.id); end if;
    update payments set status = 'rejected' where order_id = o.id and status = 'pending';

  elsif p_action = 'pay' then
    perform _transition(o, 'payment_pending', me.id);
    insert into payments(order_id, amount) values (o.id, o.buyer_total);
    perform _notify(o.seller_id, 'Ödeme başlatıldı 💳', v_title || ' için alıcı ödemeyi başlattı, admin onayı bekleniyor.', o.id);
    for a in select id from profiles where role = 'admin' and active loop
      perform _notify(a.id, 'Onay bekleyen ödeme', v_title || ' — ' || _tl(o.buyer_total), o.id);
    end loop;

  elsif p_action in ('paymentApprove', 'paymentReject') then
    update payments set status = case when p_action = 'paymentApprove' then 'approved' else 'rejected' end,
      admin_id = me.id, admin_note = v_note, decided_at = now()
    where order_id = o.id and status = 'pending';
    if p_action = 'paymentApprove' then
      perform _transition(o, 'paid', me.id);
      perform _notify(o.buyer_id, 'Ödemen onaylandı 🎉', v_title || ' için ödemen onaylandı. Randevu zamanında teslimat yapılacak.', o.id);
      perform _notify(o.seller_id, 'Ödeme onaylandı 🎉', v_title || ' için ödeme onaylandı. Hazırlığa başlayabilirsin.', o.id);
    else
      perform _transition(o, 'rejected', me.id, coalesce(v_note, 'Ödeme admin tarafından reddedildi'));
      perform _notify(o.buyer_id, 'Ödeme reddedildi', v_title || ' için ödeme reddedildi.', o.id);
      perform _notify(o.seller_id, 'Ödeme reddedildi', v_title || ' için ödeme reddedildi.', o.id);
    end if;

  elsif p_action = 'complete' then
    perform _transition(o, 'completed', me.id);
    perform _notify(case when is_buyer then o.seller_id else o.buyer_id end,
      'Sipariş tamamlandı 🧡', v_title || ' tamamlandı olarak işaretlendi. Afiyet olsun!', o.id);
  end if;
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
  update notifications set read = true
  where user_id = auth.uid() and order_id = p_order_id and title like '💬%' and not read;
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- ---------------------------------------------------------------------
-- Şikayet ve engelleme (App Store kullanıcı içeriği kuralı)
-- ---------------------------------------------------------------------

create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me profiles := _me();
  a record;
begin
  if p_target_type = 'listing' and not exists (select 1 from listings where id = p_target_id) then perform _fail('Şikayet edilen içerik bulunamadı.'); end if;
  if p_target_type = 'user' and not exists (select 1 from profiles where id = p_target_id) then perform _fail('Şikayet edilen içerik bulunamadı.'); end if;
  if p_target_type = 'user' and p_target_id = me.id then perform _fail('Kendini şikayet edemezsin.'); end if;
  if exists (select 1 from reports where reporter_id = me.id and target_id = p_target_id and status = 'open') then
    perform _fail('Bu içerik için açık bir şikayetin zaten var. İnceleniyor.');
  end if;
  insert into reports(reporter_id, target_type, target_id, reason, note)
  values (me.id, p_target_type, p_target_id, p_reason, left(btrim(coalesce(p_note, '')), 500));
  for a in select id from profiles where role = 'admin' and active loop
    perform _notify(a.id, 'Yeni şikayet 🚩', case when p_target_type = 'listing' then 'Bir ilan şikayet edildi.' else 'Bir kullanıcı şikayet edildi.' end);
  end loop;
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
  if exists (select 1 from orders where (buyer_id = p_user_id or seller_id = p_user_id)
             and status in ('seller_pending','approved','payment_pending','paid')) then
    perform _fail('Kullanıcının devam eden siparişleri var. Önce siparişleri sonuçlandırın veya kullanıcıyı pasifleştirin.');
  end if;
  delete from auth.users where id = p_user_id;
end $$;

-- ---------------------------------------------------------------------
-- Yetkiler ve satır düzeyi güvenlik
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- İstemci tablolara doğrudan yazamaz; yalnızca okur.
revoke all on public.profiles, public.profile_private, public.listings, public.orders, public.messages,
  public.payments, public.notifications, public.reports, public.blocks from anon, authenticated;
grant select on public.profiles, public.listings to anon, authenticated;
grant select on public.profile_private, public.orders, public.messages, public.payments,
  public.notifications, public.reports, public.blocks to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (active or id = auth.uid() or public.is_admin());

drop policy if exists private_read on public.profile_private;
create policy private_read on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (
    (status = 'active' and not removed_by_admin and exists (select 1 from public.profiles p where p.id = owner_id and p.active))
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
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists blocks_read on public.blocks;
create policy blocks_read on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

-- İç yardımcı fonksiyonlar dışarıdan çağrılamaz; yalnızca herkese açık RPC'ler çağrılabilir.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_admin(), public.hatay_districts(), public.buyer_fee_rate(), public.seller_fee_rate()
  to anon, authenticated;
grant execute on function
  public.update_profile(text, text, text, text, text, text, text),
  public.delete_my_account(),
  public.save_listing(uuid, text, text, numeric, text, text[], text, text[], text),
  public.set_listing_status(uuid, text),
  public.delete_listing(uuid),
  public.create_order(uuid, int, timestamptz, text, text, text, text),
  public.order_action(uuid, text, text),
  public.send_message(uuid, text),
  public.mark_chat_read(uuid),
  public.mark_notifications_read(),
  public.report_content(text, uuid, text, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.resolve_report(uuid),
  public.admin_set_user_active(uuid, boolean),
  public.admin_set_user_role(uuid, text),
  public.admin_delete_user(uuid)
  to authenticated;
