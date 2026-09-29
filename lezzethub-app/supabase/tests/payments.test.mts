// Online ödeme akışı testi: gerçek SQL şeması (PGlite) + ödeme çekirdeği + sahte iyzico sunucusu.
// Çalıştır: npm run test:payments
import { PGlite } from '@electric-sql/pglite';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { authorizationHeader, createIyzicoClient, formatPrice, verifyResponseSignature, type FetchLike } from '../functions/_shared/iyzico.ts';
import { buildInitializeBody, callbackPage, createCheckout, handleCallback, isAllowedReturnUrl, refundOrder, withParams, type PaymentDb } from '../functions/_shared/payment-core.ts';

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const throwsWith = async (fn: () => Promise<unknown>, expect: string, m: string) => {
  try { await fn(); fail++; console.log('FAIL (no error):', m); } catch (e) { if (String((e as Error).message).includes(expect)) pass++; else { fail++; console.log('FAIL (wrong error):', m, '→', (e as Error).message); } }
};

// --- 1) İmzalama: resmi iyzipay-node (lib/utils.js generateHashV2) ile birebir aynı algoritma ---
const cfg = { apiKey: 'sandbox-api-key', secretKey: 'sandbox-secret-key', baseUrl: 'https://sandbox-api.iyzipay.com' };
{
  const body = { locale: 'tr', conversationId: '123', token: 'tok' };
  const rnd = '1700000000abc';
  const uri = '/payment/iyzipos/checkoutform/auth/ecom/detail';
  const sig = createHmac('sha256', cfg.secretKey).update(rnd + uri + JSON.stringify(body)).digest('hex');
  const expected = 'IYZWSv2 ' + Buffer.from(`apiKey:${cfg.apiKey}&randomKey:${rnd}&signature:${sig}`).toString('base64');
  ok((await authorizationHeader(cfg, uri, body, rnd)) === expected, 'authorization header matches iyzipay');
  const params = ['SUCCESS', 'p1', 'TRY', 'b1', 'c1', '396.0', '396.0', 'tok'];
  const rsig = createHmac('sha256', cfg.secretKey).update(params.join(':')).digest('hex');
  ok(await verifyResponseSignature(cfg.secretKey, params, rsig), 'response signature verified');
  ok(!(await verifyResponseSignature(cfg.secretKey, params, rsig.replace(/^./, 'x'))), 'tampered signature rejected');
  ok(!(await verifyResponseSignature(cfg.secretKey, params, undefined)), 'missing signature rejected');
  ok(formatPrice(396) === '396.0' && formatPrice(12.5) === '12.5' && formatPrice(0.1 + 0.2) === '0.30000000000000004', 'formatPrice like iyzipay');
}

// --- 2) Sahte iyzico sunucusu ---
type Charge = { token: string; conversationId: string; basketId: string; paidPrice: number; price: number; result: 'SUCCESS' | 'FAILURE'; paymentId: string };
const charges = new Map<string, Charge>();
const refunds: any[] = [];
let nextResult: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
let tamper = false;
let lastInit: any = null;
const sign = (p: unknown[]) => createHmac('sha256', cfg.secretKey).update(p.join(':')).digest('hex');
const mockFetch: FetchLike = async (url, init) => {
  const u = new URL(url);
  const body = JSON.parse(init.body);
  const rnd = init.headers['x-iyzi-rnd'];
  const authOk = init.headers.Authorization === (await authorizationHeader(cfg, u.pathname, body, rnd));
  const reply = (x: unknown) => ({ json: async () => x });
  if (!authOk) return reply({ status: 'failure', errorMessage: 'auth' });
  if (u.pathname.endsWith('/initialize/auth/ecom')) {
    lastInit = body;
    const itemsSum = body.basketItems.reduce((s: number, i: any) => s + Number(i.price), 0);
    if (Math.abs(itemsSum - Number(body.price)) > 0.001) return reply({ status: 'failure', errorMessage: 'basket sum' });
    const token = 'tok-' + (charges.size + 1);
    charges.set(token, { token, conversationId: body.conversationId, basketId: body.basketId, paidPrice: Number(body.paidPrice), price: Number(body.price), result: nextResult, paymentId: 'pay-' + (charges.size + 1) });
    return reply({ status: 'success', token, paymentPageUrl: 'https://sandbox-cpp.iyzipay.com?token=' + token, conversationId: body.conversationId, signature: sign([body.conversationId, token]) });
  }
  if (u.pathname.endsWith('/auth/ecom/detail')) {
    const c = charges.get(body.token)!;
    const paid = tamper ? c.paidPrice - 1 : c.paidPrice;
    const res = { status: 'success', paymentStatus: c.result, paymentId: c.paymentId, currency: 'TRY', basketId: c.basketId, conversationId: c.conversationId, paidPrice: paid, price: c.price, token: c.token, lastFourDigits: '0008', cardAssociation: 'MASTER_CARD', itemTransactions: [{ paymentTransactionId: 'tx-' + c.paymentId }], errorMessage: c.result === 'FAILURE' ? 'Kart limiti yetersiz' : undefined };
    // Gerçek iyzico ile aynı alan sırası; fiyatlar formatPrice ile.
    return reply({ ...res, signature: sign([res.paymentStatus, res.paymentId, res.currency, res.basketId, res.conversationId, formatPrice(c.paidPrice), formatPrice(c.price), res.token]) });
  }
  if (u.pathname === '/v2/payment/refund') {
    refunds.push(body);
    return reply({ status: 'success', paymentId: body.paymentId, price: Number(body.price) });
  }
  return reply({ status: 'failure', errorMessage: 'not found' });
};
const iyz = createIyzicoClient(cfg, mockFetch);

// --- 3) Gerçek şema üzerinde uçtan uca ---
const DIR = path.resolve(import.meta.dirname, '..');
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(fs.readFileSync(path.join(DIR, 'locations.sql'), 'utf8'));
await db.exec(fs.readFileSync(path.join(DIR, 'schema.sql'), 'utf8'));

const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const as = async (id: string) => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]); await db.exec('set role authenticated'); };
const service = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;`); };
const signup = async (email: string, meta: object) => (await q(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta]))[0].id as string;

const admin = await signup('admin@x.com', { name: 'Yönetici', province: 'İzmir', district: 'Konak', neighborhood: 'Alsancak' });
const seller = await signup('satici@x.com', { name: 'Ayşe Demir', province: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı' });
const buyer = await signup('alici@x.com', { name: 'Mehmet Ali Kaya', province: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik' });
await q(`update profiles set role = 'admin' where id = $1`, [admin]);
await q(`update profiles set seller_status = 'approved' where id = $1`, [seller]);
await as(buyer);
await q(`select update_profile('Mehmet Ali Kaya','','İzmir','Bornova','Kazımdirik','Kazımdirik Mah. 100. Sok. No:5','0532 111 22 33','',null)`);
await as(seller);
const listing = (await q(`select * from save_listing(null,'Boyoz','Sabah fırından çıkma boyoz',25,'hamur-isi','{}','','{pickup,cargo}','buyer','active')`))[0];
const future = new Date(Date.now() + 86400000).toISOString();
const newApprovedOrder = async (delivery = 'pickup', addr = '') => {
  await as(buyer);
  const o = (await q(`select * from create_order($1, 4, $2, $3, $4, '', 'Merhaba')`, [listing.id, future, delivery, addr]))[0];
  await as(seller);
  await q(`select order_action($1, 'approve')`, [o.id]);
  return o;
};

const pdb: PaymentDb = {
  async rpc(name, args) {
    await service();
    const keys = Object.keys(args);
    const call = `${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
    // PostgREST bileşik dönüşleri nesne olarak verir; burada to_jsonb ile taklit edilir.
    const sql = name === 'payment_for_refund' ? `select to_jsonb(t) as r from ${call} t` : `select ${call} as r`;
    try { return (await q(sql, keys.map((k) => args[k])))[0].r; } catch (e) { throw new Error((e as Error).message); }
  },
  async paymentByToken(token) {
    await service();
    return (await q(`select order_id, amount, status from payments where provider_token = $1`, [token]))[0] ?? null;
  },
};
const callbackUrl = 'https://proje.supabase.co/functions/v1/payments-callback?return=lezzethub%3A%2F%2Fpayment-result';

// Başarılı ödeme (kargo; alıcı öder)
const o1 = await newApprovedOrder('cargo', 'Kazımdirik Mah. 100. Sok. No:5 Bornova/İzmir');
await throwsWith(() => createCheckout(pdb, iyz, { orderId: o1.id, userId: seller, ip: '1.2.3.4', callbackUrl }), 'yalnızca alıcı', 'seller cannot start payment');
const c1 = await createCheckout(pdb, iyz, { orderId: o1.id, userId: buyer, ip: '1.2.3.4', callbackUrl });
ok(c1.paymentPageUrl.includes(c1.token), 'checkout page url returned');
ok(lastInit.paidPrice === '110.0' && lastInit.price === '110.0' && lastInit.basketItems.length === 2 && lastInit.basketItems[0].price === '100.0' && lastInit.basketItems[1].itemType === 'VIRTUAL', 'basket: food + service fee');
ok(lastInit.buyer.name === 'Mehmet Ali' && lastInit.buyer.surname === 'Kaya' && lastInit.buyer.gsmNumber === '+905321112233' && lastInit.buyer.city === 'İzmir' && lastInit.buyer.email === 'alici@x.com', 'buyer fields');
ok(lastInit.shippingAddress.address.startsWith('Kazımdirik Mah. 100') && lastInit.callbackUrl === callbackUrl && lastInit.basketId === o1.id, 'shipping address + callback');
await service();
ok((await q(`select status from payments where provider_token = $1`, [c1.token]))[0].status === 'pending', 'pending payment recorded');
const r1 = await handleCallback(pdb, iyz, c1.token);
ok(r1.ok && r1.orderId === o1.id, 'callback confirms payment');
await service();
let row = (await q(`select o.status, p.status ps, p.card_last4, p.provider_payment_id, p.provider_transaction_id from orders o join payments p on p.order_id = o.id where p.provider_token = $1`, [c1.token]))[0];
ok(row.status === 'paid' && row.ps === 'succeeded' && row.card_last4 === '0008' && row.provider_transaction_id === 'tx-' + row.provider_payment_id, 'order paid, card last4 stored');
ok((await handleCallback(pdb, iyz, c1.token)).ok, 'callback replay is idempotent');
ok((await q(`select count(*)::int n from notifications where user_id = $1 and title = 'Ödemen alındı 🎉'`, [buyer]))[0].n === 1, 'buyer notified once');

// Reddedilen kart
const o2 = await newApprovedOrder();
nextResult = 'FAILURE';
const c2 = await createCheckout(pdb, iyz, { orderId: o2.id, userId: buyer, ip: '1.2.3.4', callbackUrl });
nextResult = 'SUCCESS';
const r2 = await handleCallback(pdb, iyz, c2.token);
await service();
ok(!r2.ok && r2.message.includes('limit') && (await q(`select status from orders where id = $1`, [o2.id]))[0].status === 'approved', 'declined card keeps order awaiting payment');
ok((await q(`select status, error_message from payments where provider_token = $1`, [c2.token]))[0].status === 'failed', 'declined payment marked failed');
// Tekrar deneme başarılı
const c2b = await createCheckout(pdb, iyz, { orderId: o2.id, userId: buyer, ip: '1.2.3.4', callbackUrl });
ok((await handleCallback(pdb, iyz, c2b.token)).ok, 'retry after decline succeeds');

// Değiştirilmiş yanıt (imza tutmaz) reddedilir
const o3 = await newApprovedOrder();
const c3 = await createCheckout(pdb, iyz, { orderId: o3.id, userId: buyer, ip: '1.2.3.4', callbackUrl });
tamper = true;
const r3 = await handleCallback(pdb, iyz, c3.token);
tamper = false;
await service();
ok(!r3.ok && r3.message.includes('doğrulanamadı') && (await q(`select status from orders where id = $1`, [o3.id]))[0].status === 'approved', 'tampered response rejected');
ok(!(await handleCallback(pdb, iyz, 'yok')).ok && !(await handleCallback(pdb, iyz, '')).ok, 'unknown token rejected');

// Onaylanmamış siparişe ödeme başlatılamaz
await as(buyer);
const o4 = (await q(`select * from create_order($1, 1, $2, 'pickup', '', '', 'x')`, [listing.id, future]))[0];
await throwsWith(() => createCheckout(pdb, iyz, { orderId: o4.id, userId: buyer, ip: '1.2.3.4', callbackUrl }), 'şu anda ödeme', 'cannot pay unapproved order');

// İade (yalnızca admin)
await throwsWith(() => refundOrder(pdb, iyz, { orderId: o1.id, adminId: buyer, note: '', ip: '1.2.3.4' }), 'yönetici', 'non-admin refund rejected');
await refundOrder(pdb, iyz, { orderId: o1.id, adminId: admin, note: 'Ürün hasarlı', ip: '1.2.3.4' });
ok(refunds.length === 1 && refunds[0].price === '110.0' && refunds[0].paymentId === row.provider_payment_id, 'iyzico refund called with payment id + amount');
await service();
row = (await q(`select o.status, p.status ps from orders o join payments p on p.order_id = o.id where o.id = $1 and p.status <> 'failed'`, [o1.id]))[0];
ok(row.status === 'cancelled' && row.ps === 'refunded', 'order cancelled + payment refunded');
await throwsWith(() => refundOrder(pdb, iyz, { orderId: o1.id, adminId: admin, note: '', ip: '1.2.3.4' }), 'Yalnızca ödenmiş', 'double refund blocked');

// Yardımcılar
ok(isAllowedReturnUrl('lezzethub://payment-result', ['lezzethub://']) && !isAllowedReturnUrl('https://kotu.site', ['lezzethub://']) && !isAllowedReturnUrl('lezzethub://x"><script>', ['lezzethub://']), 'return url allowlist');
ok(withParams('lezzethub://payment-result', { status: 'success', order: 'a b' }) === 'lezzethub://payment-result?status=success&order=a+b', 'withParams');
const page = callbackPage('lezzethub://payment-result?status=success', { ok: true, message: '<b>x</b>' });
ok(page.includes('location.replace') && page.includes('&lt;b&gt;') && !page.includes('<b>x</b>'), 'callback page escapes and redirects');
try { buildInitializeBody({ order: { id: 'x', subtotal: 100, buyer_fee: 10, buyer_total: 111 }, buyer: { name: 'A', province: 'İzmir' }, buyerPrivate: null }, { conversationId: 'c', callbackUrl: 'u', ip: 'i', identityNumber: '1' }); ok(false, 'inconsistent totals'); } catch { ok(true, 'inconsistent totals rejected'); }

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
