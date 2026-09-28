import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Supabase şemasını PGlite (WebAssembly PostgreSQL) üzerinde test eder: npm run test:db
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(DIR, 'schema.sql'), 'utf8');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
try { await db.exec(SCHEMA); } catch (e) { console.log('SCHEMA ERROR:', e.message); process.exit(1); }
ok(true, 'schema loaded');

// Kullanıcı oluştur (Supabase Auth kaydını taklit eder)
const signup = async (email, meta) => (await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta])).rows[0].id;
const as = async (id) => { await db.exec(`reset role`); if (id === null) { await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`); } else { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]); await db.exec(`set role authenticated`); } };
const su = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); };
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const rpcFails = async (sql, params, expect, m) => { try { await db.query(sql, params); fail++; console.log('FAIL (no error):', m); } catch (e) { if (!expect || e.message.includes(expect)) pass++; else { fail++; console.log('FAIL (wrong error):', m, '→', e.message); } } };

const admin = await signup('admin@x.com', { name: 'Yönetici', district: 'Antakya', neighborhood: 'Kışlasaray', accepted_terms: true });
const ayse = await signup('ayse@x.com', { name: 'Ayşe Demir', district: 'Antakya', neighborhood: 'Armutlu', accepted_terms: true });
const mehmet = await signup('mehmet@x.com', { name: 'Mehmet Kaya', district: 'Antakya', neighborhood: 'Cumhuriyet', accepted_terms: true });
const fatma = await signup('fatma@x.com', { name: 'Fatma', district: 'Mersin', neighborhood: '' }); // geçersiz ilçe → varsayılan
await su(); await db.query(`update profiles set role = 'admin' where id = $1`, [admin]);

let r = await q(`select p.*, pp.email, pp.accepted_terms_at from profiles p join profile_private pp using(id) where p.id = $1`, [ayse]);
ok(r[0].district === 'Antakya' && r[0].neighborhood === 'Armutlu' && r[0].email === 'ayse@x.com' && r[0].accepted_terms_at, 'profile created from signup');
r = await q(`select * from profiles where id = $1`, [fatma]);
ok(r[0].district === 'Antakya' && r[0].neighborhood === 'Merkez', 'invalid signup meta falls back');
r = await q(`select count(*)::int n from notifications where user_id = $1`, [ayse]);
ok(r[0].n === 1, 'welcome notification');

// Doğrudan yazma yasak
await as(mehmet);
await rpcFails(`insert into listings(owner_id,title,description,price,category,delivery,district,neighborhood) values ($1,'x','xxxxxxxxxxxx',1,'tatli','{pickup}','Antakya','A')`, [mehmet], 'permission denied', 'direct insert blocked');
await rpcFails(`update orders set status = 'paid'`, [], 'permission denied', 'direct update blocked');
await rpcFails(`update profiles set role = 'admin' where id = $1`, [mehmet], 'permission denied', 'self-promote blocked');
await rpcFails(`select public._notify($1, 'x', 'y')`, [mehmet], 'permission denied', 'internal function not callable');

// Özel alanlar
r = await q(`select * from profile_private`);
ok(r.length === 1 && r[0].id === mehmet, 'user sees only own private row');
await as(admin);
r = await q(`select * from profile_private`);
ok(r.length === 4, 'admin sees all private rows');
await as(null);
r = await q(`select * from profiles`);
ok(r.length === 4, 'anon sees public profiles');
await rpcFails(`select * from profile_private`, [], 'permission denied', 'anon cannot read private');

// İlan
await as(ayse);
await rpcFails(`select save_listing(null,'ab','uzun açıklama',100,'tatli','{}','','{pickup}','active')`, [], 'Başlık', 'title validation');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{}','active')`, [], 'teslimat', 'delivery validation');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli',array['1','2','3','4','5','6','7'],'','{pickup}','active')`, [], '6 fotoğraf', 'photo limit');
r = await q(`select * from save_listing(null,'Künefe','Tuzsuz peynirli künefe',180,'tatli',array['https://x/1.jpg','https://x/2.jpg'],'1 saat','{pickup,courier}','active')`);
const kunefe = r[0];
ok(kunefe.district === 'Antakya' && kunefe.neighborhood === 'Armutlu' && kunefe.images.length === 2, 'listing inherits location, keeps images');
r = await q(`select * from save_listing(null,'Tepsi Kebabı','Taş fırın tepsi kebabı',320,'ana-yemek','{}','','{pickup}','passive')`);
const kebap = r[0];
await as(mehmet);
await rpcFails(`select save_listing($1,'Künefe','Tuzsuz peynirli künefe',1,'tatli','{}','','{pickup}','active')`, [kunefe.id], 'yetkiniz yok', 'edit others listing');
r = await q(`select id, title, status from listings`);
ok(r.length === 1 && r[0].id === kunefe.id, 'passive listing hidden from others');
await as(null);
r = await q(`select id from listings`);
ok(r.length === 1, 'anon sees active listings');
await as(ayse);
r = await q(`select id from listings`);
ok(r.length === 2, 'owner sees own passive listing');

// Admin yayından kaldırır
await as(admin);
await q(`select set_listing_status($1,'passive')`, [kebap.id]);
await as(ayse);
await rpcFails(`select set_listing_status($1,'active')`, [kebap.id], 'yönetici', 'owner cannot re-activate admin-removed');

// Profil güncelleme konumu ilanlara yayar
await q(`select update_profile('Ayşe Demir','Bio','Defne','Harbiye','Harbiye Mah. No:1','Her gün',null)`);
r = await q(`select distinct district, neighborhood from listings where owner_id = $1`, [ayse]);
ok(r.length === 1 && r[0].district === 'Defne' && r[0].neighborhood === 'Harbiye', 'profile move updates listings');
await rpcFails(`select update_profile('Ayşe','', 'Adana','X','','',null)`, [], 'Hatay', 'non-Hatay district rejected');

// Sipariş akışı
await as(mehmet);
const future = new Date(Date.now() + 2 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
await rpcFails(`select create_order($1, 0, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'Adet', 'qty validation');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, past], 'geçmiş', 'past appointment');
await rpcFails(`select create_order($1, 1, $2, 'courier', '', '', 'x')`, [kunefe.id, future], 'adres', 'courier address');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kebap.id, future], 'yayında değil', 'passive listing order');
r = await q(`select * from create_order($1, 2, $2, 'pickup', '', 'Fıstıklı', 'Merhaba! Sipariş verdim')`, [kunefe.id, future]);
const o = r[0];
ok(Number(o.subtotal) === 360 && Number(o.buyer_fee) === 36 && Number(o.seller_fee) === 54 && Number(o.buyer_total) === 396 && Number(o.seller_net) === 306, 'server commission');
ok(/^LH-\d{6}$/.test(o.code), 'order code');
r = await q(`select * from messages where order_id = $1`, [o.id]);
ok(r.length === 1 && r[0].sender_id === mehmet && r[0].text.startsWith('Merhaba'), 'first message');
await as(ayse);
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'Kendi', 'own listing order');
r = await q(`select title from notifications where user_id = $1 and order_id = $2`, [ayse, o.id]);
ok(r.some((x) => x.title.startsWith('Yeni sipariş')), 'seller notified');

// Başkası siparişi göremez
await as(fatma);
ok((await q(`select * from orders`)).length === 0 && (await q(`select * from messages`)).length === 0, 'outsider cannot read order/messages');
await rpcFails(`select send_message($1, 'selam')`, [o.id], 'gönderemezsiniz', 'outsider message');
await rpcFails(`select order_action($1, 'approve')`, [o.id], 'yapılamaz', 'outsider action');

await as(mehmet);
await rpcFails(`select order_action($1, 'approve')`, [o.id], 'yapılamaz', 'buyer cannot approve');
await rpcFails(`select order_action($1, 'pay')`, [o.id], 'yapılamaz', 'pay before approve');
await as(ayse);
await q(`select order_action($1, 'approve')`, [o.id]);
await as(mehmet);
r = await q(`select status, pickup_address from orders where id = $1`, [o.id]);
ok(r[0].status === 'approved' && r[0].pickup_address === 'Harbiye Mah. No:1', 'approved + pickup address revealed');
await q(`select order_action($1, 'pay')`, [o.id]);
r = await q(`select * from payments where order_id = $1`, [o.id]);
ok(r.length === 1 && r[0].status === 'pending' && Number(r[0].amount) === 396, 'payment pending');
await rpcFails(`select order_action($1, 'cancel')`, [o.id], 'yapılamaz', 'no cancel during payment');
await rpcFails(`select order_action($1, 'paymentApprove')`, [o.id], 'yapılamaz', 'buyer cannot approve payment');
await as(admin);
r = await q(`select title from notifications where user_id = $1`, [admin]);
ok(r.some((x) => x.title === 'Onay bekleyen ödeme'), 'admin notified of payment');
ok((await q(`select * from messages where order_id = $1`, [o.id])).length === 0, 'admin cannot read private chat');
await q(`select order_action($1, 'paymentApprove')`, [o.id]);
await as(mehmet);
await q(`select order_action($1, 'complete')`, [o.id]);
r = await q(`select status, history from orders where id = $1`, [o.id]);
ok(r[0].status === 'completed' && r[0].history.map((h) => h.status).join(',') === 'seller_pending,approved,payment_pending,paid,completed', 'full flow + history');
r = await q(`select count(*)::int n from messages where order_id = $1 and is_system`, [o.id]);
ok(r[0].n === 4, 'system messages on transitions');

// Red ve iptal
r = await q(`select id from create_order($1, 1, $2, 'courier', 'Cumhuriyet Mah. 1', '', 'x')`, [kunefe.id, future]);
const o2 = r[0].id;
await as(ayse);
await q(`select order_action($1, 'reject', 'Malzeme yok')`, [o2]);
r = await q(`select status, status_note from orders where id = $1`, [o2]);
ok(r[0].status === 'rejected' && r[0].status_note === 'Malzeme yok', 'seller reject with note');
await as(mehmet);
r = await q(`select id from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future]);
const o3 = r[0].id;
await q(`select order_action($1, 'cancel')`, [o3]);
ok((await q(`select status from orders where id = $1`, [o3]))[0].status === 'cancelled', 'buyer cancel');

// Mesaj + okundu
await as(ayse);
await q(`select send_message($1, 'Afiyet olsun')`, [o.id]);
await as(mehmet);
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like '💬%' and not read`, [mehmet]))[0].n === 1, 'message notification');
await q(`select mark_chat_read($1)`, [o.id]);
ok((await q(`select count(*)::int n from messages where receiver_id = $1 and not read`, [mehmet]))[0].n === 0, 'messages marked read');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like '💬%' and not read`, [mehmet]))[0].n === 0, 'message notifications cleared');
await q(`select mark_notifications_read()`);
ok((await q(`select count(*)::int n from notifications where not read`))[0].n === 0, 'all notifications read');

// Şikayet ve engelleme
await q(`select report_content('listing', $1, 'hygiene', 'Soğuk geldi')`, [kunefe.id]);
await rpcFails(`select report_content('listing', $1, 'hygiene', '')`, [kunefe.id], 'açık bir şikayetin', 'duplicate report');
await rpcFails(`select report_content('user', $1, 'abuse', '')`, [mehmet], 'Kendini', 'self report');
await as(fatma);
ok((await q(`select * from reports`)).length === 0, 'others cannot see reports');
await as(admin);
const rep = (await q(`select * from reports`))[0];
ok(rep && rep.reason === 'hygiene', 'admin sees report');
await q(`select resolve_report($1)`, [rep.id]);
ok((await q(`select status from reports where id = $1`, [rep.id]))[0].status === 'resolved', 'report resolved');
await as(mehmet);
await q(`select block_user($1)`, [ayse]);
await rpcFails(`select send_message($1, 'selam')`, [o.id], 'mesajlaşamazsınız', 'blocked messaging');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'işlem yapamazsınız', 'blocked ordering');
await as(ayse);
await rpcFails(`select send_message($1, 'selam')`, [o.id], 'mesajlaşamazsınız', 'blocked both ways');
await as(mehmet);
await q(`select unblock_user($1)`, [ayse]);
await q(`select send_message($1, 'tekrar merhaba')`, [o.id]);
ok(true, 'unblock allows messaging');

// Admin işlemleri
await as(mehmet);
await rpcFails(`select admin_set_user_role($1, 'admin')`, [mehmet], 'yönetici', 'non-admin role change');
await as(admin);
await rpcFails(`select admin_set_user_active($1, false)`, [admin], 'Kendi', 'admin self deactivate');
await q(`select admin_set_user_active($1, false)`, [fatma]);
await as(fatma);
await rpcFails(`select save_listing(null,'Künefe','Tuzsuz peynirli künefe',1,'tatli','{}','','{pickup}','active')`, [], 'pasif', 'inactive user blocked');

// Hesap silme
await as(mehmet);
r = await q(`select id from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future]);
await rpcFails(`select delete_my_account()`, [], 'Devam eden', 'delete blocked with open orders');
await q(`select order_action($1, 'cancel')`, [r[0].id]);
await q(`select delete_my_account()`);
await su();
ok((await q(`select count(*)::int n from auth.users where id = $1`, [mehmet]))[0].n === 0, 'account deleted');
ok((await q(`select count(*)::int n from profiles where id = $1`, [mehmet]))[0].n === 0, 'profile cascaded');
r = await q(`select buyer_id, listing_title from orders where id = $1`, [o.id]);
ok(r[0].buyer_id === null && r[0].listing_title === 'Künefe', 'order history kept, buyer nulled');

// Admin kullanıcı silme
await as(admin);
await q(`select admin_delete_user($1)`, [fatma]);
await su();
ok((await q(`select count(*)::int n from profiles where id = $1`, [fatma]))[0].n === 0, 'admin deleted user');

// storage.sql ve realtime.sql sözdizimi (Supabase yapıları taklit edilir)
await su();
await db.exec(`
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  create publication supabase_realtime;
`);
for (const f of ['storage.sql', 'realtime.sql', 'realtime.sql', 'schema.sql']) await db.exec(fs.readFileSync(path.join(DIR, f), 'utf8'));
ok((await q(`select count(*)::int n from pg_publication_tables where pubname = 'supabase_realtime'`))[0].n === 7, 'realtime tables published (idempotent)');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
