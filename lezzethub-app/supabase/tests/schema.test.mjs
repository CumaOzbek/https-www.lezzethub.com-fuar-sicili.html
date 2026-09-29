import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Supabase şemasını PGlite (WebAssembly PostgreSQL) üzerinde test eder: npm run test:db
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);
try { await db.exec(read('locations.sql')); await db.exec(read('schema.sql')); } catch (e) { console.log('SCHEMA ERROR:', e.message); process.exit(1); }
ok(true, 'schema loaded');
ok((await db.query(`select _payment_mode() m`)).rows[0].m === 'offline', 'default payment mode is offline (pilot)');
// Aşağıdaki akış testleri online ödeme modunda çalışır; pilot mod ayrıca test edilir.
await db.exec(`update app_settings set value = 'online' where key = 'payment_mode'`);
ok((await db.query(`select count(*)::int n from tr_districts`)).rows[0].n === 973, '973 districts loaded');

// Kullanıcı oluştur (Supabase Auth kaydını taklit eder)
const signup = async (email, meta) => (await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta])).rows[0].id;
const as = async (id) => { await db.exec(`reset role`); if (id === null) { await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`); } else { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]); await db.exec(`set role authenticated`); } };
const service = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;`); };
const su = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); };
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const rpcFails = async (sql, params, expect, m) => { try { await db.query(sql, params); fail++; console.log('FAIL (no error):', m); } catch (e) { if (!expect || e.message.includes(expect)) pass++; else { fail++; console.log('FAIL (wrong error):', m, '→', e.message); } } };

const consent = { accepted_terms: true, kvkk_consent: true };
const admin = await signup('admin@x.com', { name: 'Yönetici', province: 'Hatay', district: 'Antakya', neighborhood: 'Kışlasaray', ...consent });
const ayse = await signup('ayse@x.com', { name: 'Ayşe Demir', province: 'Hatay', district: 'Antakya', neighborhood: 'Armutlu', intent: 'seller', ...consent });
const mehmet = await signup('mehmet@x.com', { name: 'Mehmet Kaya', province: 'Hatay', district: 'Antakya', neighborhood: 'Cumhuriyet', ...consent });
const fatma = await signup('fatma@x.com', { name: 'Fatma', province: 'Hatay', district: 'Mersin', neighborhood: '' }); // geçersiz ilçe → varsayılan
const kemal = await signup('kemal@x.com', { name: 'Kemal Kurye', province: 'Hatay', district: 'Defne', neighborhood: 'Harbiye', intent: 'courier', ...consent });
const serkan = await signup('serkan@x.com', { name: 'Serkan Usta', province: 'Ankara', district: 'Çankaya', neighborhood: 'Kızılay', intent: 'seller', ...consent });
await su(); await db.query(`update profiles set role = 'admin' where id = $1`, [admin]);

let r = await q(`select p.*, pp.email, pp.accepted_terms_at, pp.kvkk_consent_at from profiles p join profile_private pp using(id) where p.id = $1`, [ayse]);
ok(r[0].province === 'Hatay' && r[0].district === 'Antakya' && r[0].neighborhood === 'Armutlu' && r[0].email === 'ayse@x.com', 'profile created from signup');
ok(r[0].accepted_terms_at && r[0].kvkk_consent_at && r[0].seller_status === 'none', 'consents recorded, seller not yet approved');
r = await q(`select * from profiles where id = $1`, [fatma]);
ok(r[0].province === 'Ankara' && r[0].district === 'Çankaya' && r[0].neighborhood === 'Merkez', 'invalid signup meta falls back');
r = await q(`select body from notifications where user_id = $1`, [ayse]);
ok(r.length === 1 && r[0].body.includes('hijyen belgeni'), 'seller intent welcome notification');
r = await q(`select body from notifications where user_id = $1`, [kemal]);
ok(r[0].body.includes('ehliyet'), 'courier intent welcome notification');

// Doğrulama yardımcıları
r = await q(`select _normalize_iban('TR33 0006 1005 1978 6457 8413 26') a, _normalize_iban('TR330006100519786457841327') b, _normalize_phone('+90 532 111 22 33') c, _normalize_phone('12345') d`);
ok(r[0].a === 'TR330006100519786457841326' && r[0].b === null && r[0].c === '05321112233' && r[0].d === null, 'iban/phone normalization');

// Doğrudan yazma yasak
await as(mehmet);
await rpcFails(`insert into listings(owner_id,title,description,price,category,delivery,province,district,neighborhood) values ($1,'x','xxxxxxxxxxxx',1,'tatli','{pickup}','Hatay','Antakya','A')`, [mehmet], 'permission denied', 'direct insert blocked');
await rpcFails(`update orders set status = 'paid'`, [], 'permission denied', 'direct update blocked');
await rpcFails(`update profiles set seller_status = 'approved' where id = $1`, [mehmet], 'permission denied', 'self-approve blocked');
await rpcFails(`select public._notify($1, 'x', 'y')`, [mehmet], 'permission denied', 'internal function not callable');
await rpcFails(`select payment_confirm('t','p','x',1,'4242','VISA')`, [], 'permission denied', 'client cannot confirm payment');
await rpcFails(`select payment_prepare($1, $2)`, [mehmet, mehmet], 'permission denied', 'client cannot prepare payment');

// Özel alanlar
r = await q(`select * from profile_private`);
ok(r.length === 1 && r[0].id === mehmet, 'user sees only own private row');
await as(admin);
ok((await q(`select * from profile_private`)).length === 6, 'admin sees all private rows');
await as(null);
ok((await q(`select * from profiles`)).length === 6, 'anon sees public profiles');
ok((await q(`select * from tr_districts where province = 'İzmir'`)).length === 30, 'anon can read districts');
await rpcFails(`select * from profile_private`, [], 'permission denied', 'anon cannot read private');
await rpcFails(`select * from courier_profiles`, [], 'permission denied', 'anon cannot read couriers');

// Satıcı başvurusu: belge + beyan + açık rıza zorunlu
const IBAN = 'TR330006100519786457841326';
await as(ayse);
await rpcFails(`select save_listing(null,'Künefe','Tuzsuz peynirli künefe',180,'tatli','{}','','{pickup}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [], 'hijyen belgesi', 'unapproved seller cannot list');
const ayseDoc = `${ayse}/hijyen.jpg`;
await rpcFails(`select submit_seller_application('', 'image', '12345678AB', 'TR-31-K-012345', $1, 'Ayşe Demir', true, true)`, [IBAN], 'hijyen belgeni', 'doc required');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', 'TR-31-K-012345', $2, 'Ayşe Demir', true, true)`, [`${mehmet}/x.jpg`, IBAN], 'hijyen belgeni', 'doc must be in own folder');
await rpcFails(`select submit_seller_application($1, 'image', '123', 'TR-31-K-012345', $2, 'Ayşe Demir', true, true)`, [ayseDoc, IBAN], 'barkod', 'barcode required');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', '', $2, 'Ayşe Demir', true, true)`, [ayseDoc, IBAN], 'Gıda işletmesi', 'food registration no required');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', 'ABCDE', $2, 'Ayşe Demir', true, true)`, [ayseDoc, IBAN], 'Gıda işletmesi', 'food registration no must contain digits');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', 'TR-31-K-012345', 'TR000000000000000000000000', 'Ayşe Demir', true, true)`, [ayseDoc], 'IBAN', 'iban checksum');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', 'TR-31-K-012345', $2, 'Ayşe Demir', false, true)`, [ayseDoc, IBAN], 'mevzuat', 'declaration required');
await rpcFails(`select submit_seller_application($1, 'image', '12345678AB', 'TR-31-K-012345', $2, 'Ayşe Demir', true, false)`, [ayseDoc, IBAN], 'açık rıza', 'document consent required');
await q(`select submit_seller_application($1, 'image', '12345678AB', 'TR-31-K-012345', $2, 'Ayşe Demir', true, true)`, [ayseDoc, IBAN]);
r = await q(`select v.*, p.seller_status from verifications v join profiles p on p.id = v.user_id where v.user_id = $1`, [ayse]);
ok(r.length === 1 && r[0].status === 'pending' && r[0].seller_status === 'pending' && r[0].declaration_at && r[0].iban === IBAN, 'seller application pending');
await rpcFails(`select review_verification($1, true, '')`, [r[0].id], 'yönetici', 'user cannot self-review');
await as(mehmet);
ok((await q(`select * from verifications`)).length === 0, 'others cannot see verifications');
await as(admin);
const ayseVer = (await q(`select * from verifications where user_id = $1`, [ayse]))[0];
ok(ayseVer && ayseVer.doc_path === ayseDoc, 'admin sees application');
r = await q(`select title from notifications where user_id = $1`, [admin]);
ok(r.some((x) => x.title.startsWith('Yeni satıcı')), 'admin notified of application');
await rpcFails(`select review_verification($1, false, '')`, [ayseVer.id], 'gerekçe', 'reject requires note');
await q(`select review_verification($1, true, '')`, [ayseVer.id]);
await rpcFails(`select review_verification($1, true, '')`, [ayseVer.id], 'sonuçlandırıldı', 'review only once');
r = await q(`select seller_status, food_registration_no from profiles where id = $1`, [ayse]);
ok(r[0].seller_status === 'approved' && r[0].food_registration_no === 'TR-31-K-012345', 'seller approved, food registration no public');

// Serkan reddedilip yeniden başvurur
await as(serkan);
await q(`select submit_seller_application($1, 'pdf', 'ABCDEFGH12', 'TR-31-K-012345', $2, 'Serkan Usta', true, true)`, [`${serkan}/b.pdf`, IBAN]);
await as(admin);
const sv = (await q(`select id from verifications where user_id = $1`, [serkan]))[0];
await q(`select review_verification($1, false, 'Belge okunmuyor')`, [sv.id]);
await as(serkan);
ok((await q(`select seller_status from profiles where id = $1`, [serkan]))[0].seller_status === 'rejected', 'seller rejected');
r = await q(`select body from notifications where user_id = $1 order by created_at desc limit 1`, [serkan]);
ok(r[0].body.includes('Belge okunmuyor'), 'rejection reason notified');
await q(`select submit_seller_application($1, 'image', 'ABCDEFGH12', 'TR-31-K-012345', $2, 'Serkan Usta', true, true)`, [`${serkan}/c.jpg`, IBAN]);
ok((await q(`select count(*)::int n from verifications where user_id = $1`, [serkan]))[0].n === 1, 'reapplication replaces old one');

// Kurye başvurusu: A2/B ehliyet zorunlu
await as(kemal);
const kemalDoc = `${kemal}/ehliyet.jpg`;
await rpcFails(`select submit_courier_application('C', '123456', $1, 'image', '05321112233', 'Hatay', array['Antakya'], true, true)`, [kemalDoc], 'A2 veya B', 'license class restricted');
await rpcFails(`select submit_courier_application('A2', '123456', '', 'image', '05321112233', 'Hatay', array['Antakya'], true, true)`, [], 'Ehliyetinin', 'license photo required');
await rpcFails(`select submit_courier_application('A2', '123456', $1, 'image', '123', 'Hatay', array['Antakya'], true, true)`, [kemalDoc], 'Telefon', 'phone required');
await rpcFails(`select submit_courier_application('A2', '123456', $1, 'image', '05321112233', 'Hatay', array['Çankaya'], true, true)`, [kemalDoc], 'hizmet iline', 'district must match province');
await rpcFails(`select submit_courier_application('A2', '123456', $1, 'image', '05321112233', 'Hatay', array['Antakya'], false, true)`, [kemalDoc], 'açık rıza', 'courier consent required');
await q(`select submit_courier_application('A2', '123456', $1, 'image', '0532 111 22 33', 'Hatay', array['Antakya','Defne','Antakya'], true, true)`, [kemalDoc]);
r = await q(`select * from courier_profiles where user_id = $1`, [kemal]);
ok(r.length === 1 && r[0].vehicle === 'motorcycle' && r[0].phone === '05321112233' && r[0].service_districts.length === 2, 'courier profile created');
await as(mehmet);
ok((await q(`select * from courier_profiles`)).length === 0, 'pending courier hidden from others');
await as(admin);
await q(`select review_verification((select id from verifications where user_id = $1), true, '')`, [kemal]);
await as(mehmet);
r = await q(`select * from courier_profiles where service_province = 'Hatay' and 'Antakya' = any(service_districts)`);
ok(r.length === 1 && r[0].user_id === kemal, 'approved courier visible to users');
await rpcFails(`select update_courier_profile(false, null, null)`, [], 'bulunamadı', 'non-courier cannot update');
await as(kemal);
await q(`select update_courier_profile(false, null, null)`);
ok((await q(`select available from courier_profiles where user_id = $1`, [kemal]))[0].available === false, 'courier availability toggled');
await rpcFails(`select update_courier_profile(null, array['Çankaya'], null)`, [], 'hizmet iline', 'courier update district validation');

// İlan
await as(ayse);
await rpcFails(`select save_listing(null,'ab','uzun açıklama',100,'tatli','{}','','{pickup}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [], 'Başlık', 'title validation');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [], 'teslimat', 'delivery validation');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','x','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [], 'kime ait', 'shipping payer validation');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli',array['1','2','3','4','5','6','7'],'','{pickup}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [], '6 fotoğraf', 'photo limit');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','buyer','{}',false,'Buzdolabında 2 gün',true,true,'active')`, [], 'Alerjen', 'allergen declaration required');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','buyer','{sut}',true,'Buzdolabında 2 gün',true,true,'active')`, [], 'beyanını kaldır', 'allergens + no-allergen conflict');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','buyer','{sut}',false,'',true,true,'active')`, [], 'Son tüketim', 'shelf life required');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{cargo}','buyer','{sut}',false,'1 gün',false,true,'active')`, [], 'Kargo yalnızca', 'cargo requires shelf stable');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','buyer','{sut}',false,'1 gün',false,false,'active')`, [], 'yasaklı', 'safety confirmation required');
await rpcFails(`select save_listing(null,'Künefe','uzun açıklama metni',100,'tatli','{}','','{pickup}','buyer','{zehir}',false,'1 gün',false,true,'active')`, [], null, 'unknown allergen rejected');
r = await q(`select * from save_listing(null,'Künefe','Tuzsuz peynirli künefe',180,'tatli',array['https://x/1.jpg','https://x/2.jpg'],'1 saat','{pickup,courier,cargo}','seller','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`);
const kunefe = r[0];
ok(kunefe.province === 'Hatay' && kunefe.district === 'Antakya' && kunefe.shipping_payer === 'seller' && kunefe.images.length === 2, 'listing inherits location, keeps shipping payer');
ok(kunefe.allergens.join() === 'sut' && kunefe.shelf_life === 'Buzdolabında 2 gün' && kunefe.shelf_stable && kunefe.safety_confirmed_at, 'food safety fields saved');
r = await q(`select * from save_listing(null,'Tepsi Kebabı','Taş fırın tepsi kebabı',320,'ana-yemek','{}','','{pickup}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'passive')`);
const kebap = r[0];
await as(mehmet);
await rpcFails(`select save_listing($1,'Künefe','Tuzsuz peynirli künefe',1,'tatli','{}','','{pickup}','buyer','{sut}',false,'Buzdolabında 2 gün',true,true,'active')`, [kunefe.id], 'hijyen', 'non-seller cannot edit');
r = await q(`select id from listings`);
ok(r.length === 1 && r[0].id === kunefe.id, 'passive listing hidden from others');
await as(null);
ok((await q(`select id from listings`)).length === 1, 'anon sees active listings');
await as(ayse);
ok((await q(`select id from listings`)).length === 2, 'owner sees own passive listing');

// Admin yayından kaldırır
await as(admin);
await q(`select set_listing_status($1,'passive')`, [kebap.id]);
await as(ayse);
await rpcFails(`select set_listing_status($1,'active')`, [kebap.id], 'yönetici', 'owner cannot re-activate admin-removed');

// Profil güncelleme konumu ilanlara yayar (il değişimi dahil)
await rpcFails(`select update_profile('Ayşe','', 'Hatay','Çankaya','X','','','',null)`, [], 'il ve ilçe', 'district must belong to province');
await rpcFails(`select update_profile('Ayşe Demir','', 'Hatay','Defne','Harbiye','','123','',null)`, [], 'Telefon', 'phone validation');
await q(`select update_profile('Ayşe Demir','Bio','Hatay','Defne','Harbiye','Harbiye Mah. No:1','05551112233','Her gün',null)`);
r = await q(`select distinct province, district, neighborhood from listings where owner_id = $1`, [ayse]);
ok(r.length === 1 && r[0].district === 'Defne' && r[0].neighborhood === 'Harbiye', 'profile move updates listings');
ok((await q(`select phone from profile_private where id = $1`, [ayse]))[0].phone === '05551112233', 'phone saved');

// Sipariş akışı + online ödeme
await as(mehmet);
const future = new Date(Date.now() + 2 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
await rpcFails(`select create_order($1, 0, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'Adet', 'qty validation');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, past], 'geçmiş', 'past appointment');
await rpcFails(`select create_order($1, 1, $2, 'courier', '', '', 'x')`, [kunefe.id, future], 'adres', 'courier address');
await rpcFails(`select create_order($1, 1, $2, 'cargo', 'kısa', '', 'x')`, [kunefe.id, future], 'Kargo için', 'cargo address');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kebap.id, future], 'yayında değil', 'passive listing order');
r = await q(`select * from create_order($1, 2, $2, 'pickup', '', 'Fıstıklı', 'Merhaba! Sipariş verdim')`, [kunefe.id, future]);
const o = r[0];
ok(Number(o.subtotal) === 360 && Number(o.buyer_fee) === 36 && Number(o.seller_fee) === 54 && Number(o.buyer_total) === 396 && Number(o.seller_net) === 306, 'server commission');
ok(/^LH-\d{6}$/.test(o.code) && o.shipping_payer === 'seller' && o.payout_status === 'pending', 'order code, shipping payer copied');
r = await q(`select * from messages where order_id = $1`, [o.id]);
ok(r.length === 1 && r[0].sender_id === mehmet && r[0].text.startsWith('Merhaba'), 'first message');
await as(ayse);
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'Kendi', 'own listing order');
ok((await q(`select title from notifications where user_id = $1 and order_id = $2`, [ayse, o.id])).some((x) => x.title.startsWith('Yeni sipariş')), 'seller notified');

// Başkası siparişi göremez
await as(fatma);
ok((await q(`select * from orders`)).length === 0 && (await q(`select * from messages`)).length === 0, 'outsider cannot read order/messages');
await rpcFails(`select send_message($1, 'selam')`, [o.id], 'gönderemezsiniz', 'outsider message');
await rpcFails(`select order_action($1, 'approve')`, [o.id], 'yapılamaz', 'outsider action');

await as(mehmet);
await rpcFails(`select order_action($1, 'approve')`, [o.id], 'yapılamaz', 'buyer cannot approve');
await rpcFails(`select order_action($1, 'pay')`, [o.id], 'yapılamaz', 'no client-side pay action');
await service();
await rpcFails(`select payment_prepare($1, $2)`, [o.id, mehmet], 'şu anda ödeme', 'cannot pay before seller approval');
await as(ayse);
await q(`select order_action($1, 'approve')`, [o.id]);
await as(mehmet);
r = await q(`select status, pickup_address from orders where id = $1`, [o.id]);
ok(r[0].status === 'approved' && r[0].pickup_address === 'Harbiye Mah. No:1', 'approved + pickup address revealed');
ok((await q(`select body from notifications where user_id = $1 and order_id = $2 and title like 'Siparişin onaylandı%'`, [mehmet, o.id]))[0].body.includes('Online ödeme'), 'buyer asked to pay online');

await service();
await rpcFails(`select payment_prepare($1, $2)`, [o.id, ayse], 'yalnızca alıcı', 'only buyer can pay');
r = await q(`select payment_prepare($1, $2) j`, [o.id, mehmet]);
ok(r[0].j.order.code === o.code && r[0].j.buyerPrivate.email === 'mehmet@x.com', 'payment_prepare returns order + buyer');
await q(`select payment_record_pending($1, 'tok-fail', 396)`, [o.id]);
ok((await q(`select payment_fail('tok-fail', 'Kart reddedildi') id`))[0].id === o.id, 'payment_fail returns order');
await q(`select payment_prepare($1, $2)`, [o.id, mehmet]);
await q(`select payment_record_pending($1, 'tok-bad', 396)`, [o.id]);
ok((await q(`select payment_confirm('tok-bad', 'p0', 't0', 1, '4242', 'VISA') id`))[0].id === null, 'amount mismatch rejected');
ok((await q(`select status from payments where provider_token = 'tok-bad'`))[0].status === 'failed', 'mismatch marked failed');
ok((await q(`select status from orders where id = $1`, [o.id]))[0].status === 'approved', 'mismatch does not mark paid');
await q(`select payment_prepare($1, $2)`, [o.id, mehmet]);
await q(`select payment_record_pending($1, 'tok-ok', 396)`, [o.id]);
await q(`select payment_prepare($1, $2)`, [o.id, mehmet]).catch(() => null);
// Yeni deneme eskisini kapatır; bu yüzden tok-ok'u yeniden bekleyen yap.
await su(); await db.query(`update payments set status = 'pending', error_message = null where provider_token = 'tok-ok'`);
await service();
ok((await q(`select payment_confirm('tok-ok', 'pay-1', 'tx-1', 396.00, '4242', 'VISA') id`))[0].id === o.id, 'payment confirmed');
ok((await q(`select payment_confirm('tok-ok', 'pay-1', 'tx-1', 396.00, '4242', 'VISA') id`))[0].id === o.id, 'confirm idempotent');
await as(mehmet);
r = await q(`select status from orders where id = $1`, [o.id]);
ok(r[0].status === 'paid', 'order paid');
r = await q(`select status, card_last4, provider_payment_id from payments where order_id = $1 order by created_at`, [o.id]);
ok(r.filter((x) => x.status === 'succeeded').length === 1 && r.find((x) => x.status === 'succeeded').card_last4 === '4242', 'single succeeded payment visible to buyer');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title = 'Ödemen alındı 🎉'`, [mehmet]))[0].n === 1, 'buyer notified once');
await rpcFails(`select order_action($1, 'cancel')`, [o.id], 'yapılamaz', 'no cancel after payment');
await as(admin);
ok((await q(`select * from messages where order_id = $1`, [o.id])).length === 0, 'admin cannot read private chat');
ok((await q(`select * from payments where order_id = $1`, [o.id])).length >= 1, 'admin sees payments');
await as(mehmet);
await q(`select order_action($1, 'complete')`, [o.id]);
r = await q(`select status, history from orders where id = $1`, [o.id]);
ok(r[0].status === 'completed' && r[0].history.map((h) => h.status).join(',') === 'seller_pending,approved,paid,completed', 'full flow + history');
ok((await q(`select count(*)::int n from messages where order_id = $1 and is_system`, [o.id]))[0].n === 3, 'system messages on transitions');

// Satıcıya ödeme (payout)
await as(ayse);
await rpcFails(`select admin_mark_payout(array[$1::uuid])`, [o.id], 'yönetici', 'non-admin payout');
await as(admin);
await q(`select admin_mark_payout(array[$1::uuid])`, [o.id]);
r = await q(`select payout_status, payout_at from orders where id = $1`, [o.id]);
ok(r[0].payout_status === 'paid' && r[0].payout_at, 'payout marked');
await su();
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like 'Kazancın%'`, [ayse]))[0].n === 1, 'seller notified of payout');

// Kargo siparişi, kargo bilgisi ve iade
await as(mehmet);
r = await q(`select * from create_order($1, 1, $2, 'cargo', 'Cumhuriyet Mah. 12. Sok. No:4 Antakya/Hatay', '', 'x')`, [kunefe.id, future]);
const oc = r[0];
await as(ayse);
await q(`select order_action($1, 'approve')`, [oc.id]);
await rpcFails(`select set_shipment($1, 'Yurtiçi', 'YK123456')`, [oc.id], 'ödeme alındıktan', 'shipment only after payment');
await service();
await q(`select payment_prepare($1, $2)`, [oc.id, mehmet]);
await q(`select payment_record_pending($1, 'tok-c', $2)`, [oc.id, oc.buyer_total]);
await q(`select payment_confirm('tok-c', 'pay-2', 'tx-2', $1, '0002', 'MASTER_CARD')`, [oc.buyer_total]);
await as(mehmet);
await rpcFails(`select set_shipment($1, 'Yurtiçi', 'YK123456')`, [oc.id], 'yalnızca satıcı', 'buyer cannot set shipment');
await as(ayse);
await q(`select set_shipment($1, 'Yurtiçi Kargo', 'YK123456')`, [oc.id]);
r = await q(`select shipping_company, tracking_code from orders where id = $1`, [oc.id]);
ok(r[0].shipping_company === 'Yurtiçi Kargo' && r[0].tracking_code === 'YK123456', 'shipment saved');
await su();
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like '%kargoya%'`, [mehmet]))[0].n === 1, 'buyer notified of shipment');
await as(ayse);
await rpcFails(`select set_shipment($1, 'Yurtiçi', 'YK1')`, [o.id], 'kargo ile', 'pickup order has no shipment');
await service();
await rpcFails(`select * from payment_for_refund($1, $2)`, [oc.id, ayse], 'yönetici', 'refund requires admin');
r = await q(`select * from payment_for_refund($1, $2)`, [oc.id, admin]);
ok(r[0].provider_payment_id === 'pay-2' && r[0].provider_transaction_id === 'tx-2', 'refund target found');
await q(`select payment_mark_refunded($1, $2, 'Müşteri talebi')`, [r[0].id, admin]);
r = await q(`select o.status, p.status ps from orders o join payments p on p.order_id = o.id where o.id = $1 and p.provider_token = 'tok-c'`, [oc.id]);
ok(r[0].status === 'cancelled' && r[0].ps === 'refunded', 'refunded + cancelled');
await rpcFails(`select * from payment_for_refund($1, $2)`, [oc.id, admin], 'Yalnızca ödenmiş', 'no double refund');
await as(admin);
await rpcFails(`select admin_mark_payout(array[$1::uuid])`, [oc.id], 'tamamlanan', 'payout only for completed');

// İptal edilmiş siparişe gelen ödeme → admin uyarılır
await as(mehmet);
const oz = (await q(`select * from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future]))[0];
await as(ayse); await q(`select order_action($1, 'approve')`, [oz.id]);
await service(); await q(`select payment_prepare($1, $2)`, [oz.id, mehmet]); await q(`select payment_record_pending($1, 'tok-z', $2)`, [oz.id, oz.buyer_total]);
await as(mehmet); await q(`select order_action($1, 'cancel')`, [oz.id]);
ok((await q(`select status from payments where provider_token = 'tok-z'`))[0].status === 'failed', 'cancel fails pending payment');
await su(); await db.query(`update payments set status = 'pending' where provider_token = 'tok-z'`);
await service(); await q(`select payment_confirm('tok-z', 'pay-3', 'tx-3', $1, '4242', 'VISA')`, [oz.buyer_total]);
await su();
ok((await q(`select status from orders where id = $1`, [oz.id]))[0].status === 'cancelled', 'late payment does not revive cancelled order');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like 'İade gerekiyor%'`, [admin]))[0].n === 1, 'admin warned to refund late payment');

// Red ve iptal
await as(mehmet);
const o2 = (await q(`select id from create_order($1, 1, $2, 'courier', 'Cumhuriyet Mah. 1. Sokak', '', 'x')`, [kunefe.id, future]))[0].id;
await as(ayse);
await q(`select order_action($1, 'reject', 'Malzeme yok')`, [o2]);
r = await q(`select status, status_note from orders where id = $1`, [o2]);
ok(r[0].status === 'rejected' && r[0].status_note === 'Malzeme yok', 'seller reject with note');
await as(mehmet);
const o3 = (await q(`select id from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future]))[0].id;
await q(`select order_action($1, 'cancel')`, [o3]);
ok((await q(`select status from orders where id = $1`, [o3]))[0].status === 'cancelled', 'buyer cancel');

// Mesaj + okundu
await as(ayse);
await q(`select send_message($1, 'Afiyet olsun')`, [o.id]);
await as(mehmet);
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like '💬%' and not read`, [mehmet]))[0].n === 1, 'message notification');
await q(`select mark_chat_read($1)`, [o.id]);
ok((await q(`select count(*)::int n from messages where receiver_id = $1 and not read`, [mehmet]))[0].n === 0, 'messages marked read');
await q(`select mark_notifications_read()`);
ok((await q(`select count(*)::int n from notifications where not read`))[0].n === 0, 'all notifications read');

// Şikayet ve engelleme
await q(`select report_content('listing', $1, 'misleading', 'Fotoğraftaki gibi değil')`, [kunefe.id]);
await rpcFails(`select report_content('listing', $1, 'misleading', '')`, [kunefe.id], 'açık bir şikayetin', 'duplicate report');
await rpcFails(`select report_content('user', $1, 'abuse', '')`, [mehmet], 'Kendini', 'self report');
await as(admin);
const rep = (await q(`select * from reports`))[0];
await q(`select resolve_report($1)`, [rep.id]);
ok((await q(`select status from reports where id = $1`, [rep.id]))[0].status === 'resolved', 'report resolved');
await as(mehmet);
await q(`select block_user($1)`, [ayse]);
await rpcFails(`select send_message($1, 'selam')`, [o.id], 'mesajlaşamazsınız', 'blocked messaging');
await rpcFails(`select create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future], 'işlem yapamazsınız', 'blocked ordering');
await q(`select unblock_user($1)`, [ayse]);
await q(`select send_message($1, 'tekrar merhaba')`, [o.id]);
ok(true, 'unblock allows messaging');

// Pilot mod (teslimatta ödeme): komisyonsuz, ödeme adımı yok, onaydan doğrudan tamamlandıya.
await su(); await db.exec(`update app_settings set value = 'offline' where key = 'payment_mode'`);
await as(null);
ok((await q(`select value from app_settings where key = 'payment_mode'`))[0].value === 'offline', 'anon can read payment mode');
await rpcFails(`update app_settings set value = 'online'`, [], 'permission denied', 'client cannot change payment mode');
await as(mehmet);
const po = (await q(`select * from create_order($1, 2, $2, 'cargo', 'Cumhuriyet Mah. 5. Sok. No:1 Antakya', '', 'x')`, [kunefe.id, future]))[0];
ok(po.payment_method === 'on_delivery' && Number(po.buyer_fee) === 0 && Number(po.seller_fee) === 0 && Number(po.buyer_total) === 360 && Number(po.seller_net) === 360, 'pilot order has no fees');
await as(ayse);
await q(`select order_action($1, 'approve')`, [po.id]);
await as(mehmet);
ok((await q(`select body from notifications where user_id = $1 and order_id = $2 and title like 'Siparişin onaylandı%'`, [mehmet, po.id]))[0].body.includes('teslimatta'), 'buyer told to pay on delivery');
ok((await q(`select text from messages where order_id = $1 and is_system order by created_at desc limit 1`, [po.id]))[0].text.includes('Teslimatta ödeme'), 'system message shows on-delivery label');
await service();
await rpcFails(`select payment_prepare($1, $2)`, [po.id, mehmet], 'teslimatta', 'no online payment for on-delivery order');
await as(ayse);
await q(`select set_shipment($1, 'Aras Kargo', 'AR998877')`, [po.id]);
ok((await q(`select tracking_code from orders where id = $1`, [po.id]))[0].tracking_code === 'AR998877', 'shipment allowed after approval in pilot');
await as(mehmet);
await q(`select order_action($1, 'complete')`, [po.id]);
r = await q(`select status, history from orders where id = $1`, [po.id]);
ok(r[0].status === 'completed' && r[0].history.map((h) => h.status).join(',') === 'seller_pending,approved,completed', 'pilot flow completes without payment');
await as(admin);
await rpcFails(`select admin_mark_payout(array[$1::uuid])`, [po.id], 'aktarım yapılmaz', 'no payout for on-delivery order');
await su(); await db.exec(`update app_settings set value = 'online' where key = 'payment_mode'`);

// Hijyen şikayeti: ürünü satın almış alıcıdan tek şikayet → ilan otomatik incelemeye alınır.
await as(mehmet);
await q(`select report_content('listing', $1, 'hygiene', 'Midem bozuldu')`, [kunefe.id]);
await su();
r = await q(`select status, under_review from listings where id = $1`, [kunefe.id]);
ok(r[0].status === 'passive' && r[0].under_review === true, 'verified buyer hygiene report hides listing');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like 'İlanın incelemeye alındı%'`, [ayse]))[0].n === 1, 'seller notified of hygiene hold');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title like 'ACİL%'`, [admin]))[0].n === 1, 'admins alerted of hygiene hold');
await as(null);
ok((await q(`select id from listings where id = $1`, [kunefe.id])).length === 0, 'held listing hidden from public');
await as(ayse);
await rpcFails(`select set_listing_status($1, 'active')`, [kunefe.id], 'incelemede', 'owner cannot reactivate held listing');
await rpcFails(`select save_listing($1,'Künefe','Tuzsuz peynirli künefe',180,'tatli','{}','','{pickup}','seller','{sut}',false,'1 gün',false,true,'active')`, [kunefe.id], 'incelemede', 'owner cannot republish held listing via edit');
await rpcFails(`select admin_reinstate_listing($1)`, [kunefe.id], 'yönetici', 'only admin reinstates');
await as(admin);
await q(`select admin_reinstate_listing($1)`, [kunefe.id]);
await su();
r = await q(`select status, under_review from listings where id = $1`, [kunefe.id]);
ok(r[0].status === 'active' && r[0].under_review === false, 'admin reinstates listing');
ok((await q(`select count(*)::int n from reports where target_id = $1 and status = 'open'`, [kunefe.id]))[0].n === 0, 'reinstate resolves open reports');
// Satın almamış kişilerden: 1 şikayet yetmez, 2 farklı kişi → otomatik inceleme
await as(ayse);
const humus = (await q(`select * from save_listing(null,'Humus','Tahinli ev humusu, limonlu',120,'meze','{}','','{pickup}','buyer','{susam}',false,'Buzdolabında 2 gün',false,true,'active')`))[0];
await as(fatma);
await q(`select report_content('listing', $1, 'hygiene', 'Kötü koku')`, [humus.id]);
await su();
ok((await q(`select status from listings where id = $1`, [humus.id]))[0].status === 'active', 'single unverified hygiene report does not hide');
await as(serkan);
await q(`select report_content('listing', $1, 'hygiene', 'Bozuk')`, [humus.id]);
await su();
r = await q(`select status, under_review from listings where id = $1`, [humus.id]);
ok(r[0].status === 'passive' && r[0].under_review === true, 'two distinct hygiene reports hide listing');

// Admin işlemleri
await as(mehmet);
await rpcFails(`select admin_set_user_role($1, 'admin')`, [mehmet], 'yönetici', 'non-admin role change');
await as(admin);
await rpcFails(`select admin_set_user_active($1, false)`, [admin], 'Kendi', 'admin self deactivate');
await q(`select admin_set_user_active($1, false)`, [fatma]);
await as(fatma);
await rpcFails(`select update_profile('Fatma','','Ankara','Çankaya','X','','','',null)`, [], 'pasif', 'inactive user blocked');

// Hesap silme
await as(mehmet);
r = await q(`select id from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [kunefe.id, future]);
await rpcFails(`select delete_my_account()`, [], 'Devam eden', 'delete blocked with open orders');
await q(`select order_action($1, 'cancel')`, [r[0].id]);
await q(`select delete_my_account()`);
await su();
ok((await q(`select count(*)::int n from profiles where id = $1`, [mehmet]))[0].n === 0, 'profile cascaded');
r = await q(`select buyer_id, listing_title from orders where id = $1`, [o.id]);
ok(r[0].buyer_id === null && r[0].listing_title === 'Künefe', 'order history kept, buyer nulled');
await as(admin);
await q(`select admin_delete_user($1)`, [kemal]);
await su();
ok((await q(`select count(*)::int n from courier_profiles where user_id = $1`, [kemal]))[0].n === 0, 'courier profile cascaded');
ok((await q(`select count(*)::int n from verifications where user_id = $1`, [kemal]))[0].n === 0, 'verification cascaded');

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
for (const f of ['storage.sql', 'realtime.sql', 'realtime.sql', 'locations.sql', 'schema.sql']) await db.exec(read(f));
ok((await q(`select count(*)::int n from pg_publication_tables where pubname = 'supabase_realtime'`))[0].n === 9, 'realtime tables published (idempotent)');
r = await q(`select id, public from storage.buckets order by id`);
ok(r.length === 2 && r[0].id === 'documents' && r[0].public === false && r[1].public === true, 'documents bucket private');

// Tek dosyalık kurulum (kurulum.sql) güncel mi?
const { buildKurulum } = await import(path.resolve(DIR, '../scripts/build-kurulum.mjs'));
ok(read('kurulum.sql') === buildKurulum(), 'kurulum.sql is up to date (npm run db:bundle)');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
