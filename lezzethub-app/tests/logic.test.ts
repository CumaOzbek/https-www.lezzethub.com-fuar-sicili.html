import * as api from '../src/lib/api';
import { calcBreakdown } from '../src/lib/commission';
import { createSeed } from '../src/lib/seed';
import { suggestNeighborhoods } from '../src/lib/hatay';
import type { DB } from '../src/lib/types';

let pass = 0, failN = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { failN++; console.log('FAIL:', m); } };
const throws = (fn: () => unknown, m: string) => { try { fn(); failN++; console.log('FAIL (no throw):', m); } catch (e) { if (e instanceof api.ApiError) pass++; else { failN++; console.log('FAIL (wrong error):', m, e); } } };
const clone = (d: DB) => JSON.parse(JSON.stringify(d)) as DB;
const fut = (days: number, h = 19) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d.toISOString(); };

(async () => {
  // Komisyon
  const b = calcBreakdown(180, 1);
  ok(b.buyerFee === 18 && b.sellerFee === 27 && b.buyerTotal === 198 && b.sellerNet === 153 && b.platformRevenue === 45, 'commission 180');
  const b2 = calcBreakdown(33.33, 3);
  ok(b2.subtotal === 99.99 && b2.buyerFee === 10 && b2.sellerFee === 15 && b2.buyerTotal === 109.99, 'commission rounding ' + JSON.stringify(b2));

  const seed = await createSeed(async (p) => 'h:' + p);
  const U = (db: DB, id: string) => db.users.find((u) => u.id === id)!;
  ok(seed.users.length === 6 && seed.listings.length === 10 && seed.orders.length === 3, 'seed counts');
  ok(seed.payments.filter((p) => p.status === 'pending').length === 1, 'seed pending payment');
  ok(seed.listings.every((l) => l.district === U(seed, l.ownerId).district), 'listings inherit district');

  // Kayıt / giriş
  let db = clone(seed);
  throws(() => api.register(db, { name: 'Ab', email: 'x@y.com', password: '123456', district: 'Antakya', neighborhood: 'A', acceptedTerms: true }, 'h'), 'short name');
  throws(() => api.register(db, { name: 'Ali Veli', email: 'bad', password: '123456', district: 'Antakya', neighborhood: 'A' , acceptedTerms: true }, 'h'), 'bad email');
  throws(() => api.register(db, { name: 'Ali Veli', email: 'a@b.com', password: '123', district: 'Antakya', neighborhood: 'A' , acceptedTerms: true }, 'h'), 'short pw');
  throws(() => api.register(db, { name: 'Ali Veli', email: 'a@b.com', password: '123456', district: 'Adana', neighborhood: 'A' , acceptedTerms: true }, 'h'), 'non-Hatay district');
  throws(() => api.register(db, { name: 'Ali Veli', email: 'a@b.com', password: '123456', district: 'Antakya', neighborhood: '  ' , acceptedTerms: true }, 'h'), 'empty neighborhood');
  throws(() => api.register(db, { name: 'Ali Veli', email: 'AYSE@lezzethub.com ', password: '123456', district: 'Antakya', neighborhood: 'A' , acceptedTerms: true }, 'h'), 'duplicate email case-insensitive');
  const nu = api.register(db, { name: 'Ali Veli', email: 'Ali@B.com', password: '123456', district: 'Kumlu', neighborhood: 'Yeni' , acceptedTerms: true }, 'h:123456');
  ok(nu.email === 'ali@b.com' && nu.role === 'user', 'register normalizes');
  ok(api.login(db, 'ALI@b.com', 'h:123456').id === nu.id, 'login');
  throws(() => api.login(db, 'ali@b.com', 'wrong'), 'wrong pw');
  api.setUserActive(db, U(db, 'u-admin'), nu.id, false);
  throws(() => api.login(db, 'ali@b.com', 'h:123456'), 'inactive login');

  // İlan
  db = clone(seed);
  const ayse = U(db, 'u-ayse'), mehmet = U(db, 'u-mehmet'), admin = U(db, 'u-admin'), fatma = U(db, 'u-fatma');
  const base = { title: 'Deneme', description: 'Uzun bir açıklama', price: 100, category: 'tatli' as const, images: [] as string[], prepTime: '', delivery: ['pickup' as const], status: 'active' as const };
  throws(() => api.saveListing(db, ayse.id, { ...base, delivery: [] }), 'no delivery');
  throws(() => api.saveListing(db, ayse.id, { ...base, price: 0 }), 'zero price');
  throws(() => api.saveListing(db, ayse.id, { ...base, price: NaN }), 'NaN price');
  const l = api.saveListing(db, ayse.id, base);
  throws(() => api.saveListing(db, mehmet.id, base, l.id), 'edit others listing');
  throws(() => api.setListingStatus(db, mehmet, l.id, 'passive'), 'status others listing');
  api.setListingStatus(db, admin, l.id, 'passive');
  throws(() => api.setListingStatus(db, ayse, l.id, 'active'), 'reactivate admin-removed');
  api.setListingStatus(db, admin, l.id, 'active');
  ok(!api.getListing(db, l.id)!.removedByAdmin, 'admin restore clears flag');
  api.updateProfile(db, ayse.id, { name: ayse.name, bio: '', district: 'Belen', neighborhood: 'Kıcı', address: '', availability: '' });
  ok(db.listings.filter((x) => x.ownerId === ayse.id).every((x) => x.district === 'Belen' && x.neighborhood === 'Kıcı'), 'profile move updates listings');

  // Sipariş akışı
  db = clone(seed);
  const kunefe = db.listings.find((x) => x.title.startsWith('Antakya Künefesi'))!;
  const kebap = db.listings.find((x) => x.title === 'Tepsi Kebabı')!;
  const pasif = db.listings.find((x) => x.status === 'passive')!;
  const oi = { listingId: kunefe.id, quantity: 2, appointment: fut(2), delivery: 'pickup' as const, address: '', note: '' };
  throws(() => api.createOrder(db, ayse.id, oi), 'order own listing');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, quantity: 0 }), 'qty 0');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, quantity: 1.5 }), 'qty fraction');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, appointment: fut(-1) }), 'past appointment');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, listingId: kebap.id, delivery: 'courier', address: 'Bir adres 12' }), 'unsupported delivery');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, delivery: 'courier', address: '' }), 'courier no address');
  throws(() => api.createOrder(db, mehmet.id, { ...oi, listingId: pasif.id }), 'passive listing');
  const msgBefore = db.messages.length;
  const o = api.createOrder(db, mehmet.id, oi);
  ok(o.status === 'seller_pending' && o.buyerTotal === 396 && o.sellerNet === 306, 'order amounts');
  ok(db.messages.length === msgBefore + 1 && db.messages.at(-1)!.senderId === mehmet.id, 'auto first message');
  ok(db.notifications.some((n) => n.userId === ayse.id && n.orderId === o.id), 'seller notified');
  throws(() => api.orderAction(db, mehmet, o.id, 'approve'), 'buyer cannot approve');
  throws(() => api.orderAction(db, mehmet, o.id, 'pay'), 'pay before approve');
  throws(() => api.orderAction(db, admin, o.id, 'paymentApprove'), 'admin approve too early');
  api.orderAction(db, ayse, o.id, 'approve');
  throws(() => api.orderAction(db, ayse, o.id, 'pay'), 'seller cannot pay');
  api.orderAction(db, mehmet, o.id, 'pay');
  ok(db.payments.some((p) => p.orderId === o.id && p.status === 'pending' && p.amount === 396), 'payment created');
  throws(() => api.orderAction(db, mehmet, o.id, 'cancel'), 'no cancel while payment pending');
  throws(() => api.orderAction(db, ayse, o.id, 'complete'), 'no complete before paid');
  throws(() => api.orderAction(db, mehmet, o.id, 'paymentApprove'), 'non-admin approve payment');
  const statsBefore = api.adminStats(db).commission;
  api.orderAction(db, admin, o.id, 'paymentApprove');
  ok(api.adminStats(db).commission === statsBefore + 90, 'commission counted after approval');
  api.orderAction(db, mehmet, o.id, 'complete');
  ok(api.getOrder(db, o.id)!.status === 'completed', 'completed');
  throws(() => api.orderAction(db, ayse, o.id, 'complete'), 'double complete');
  ok(api.getOrder(db, o.id)!.history.map((h) => h.status).join(',') === 'seller_pending,approved,payment_pending,paid,completed', 'history');

  // Red / iptal
  const o2 = api.createOrder(db, mehmet.id, oi);
  api.orderAction(db, ayse, o2.id, 'reject', 'Malzeme yok');
  ok(api.getOrder(db, o2.id)!.status === 'rejected' && api.getOrder(db, o2.id)!.statusNote === 'Malzeme yok', 'seller reject');
  const o3 = api.createOrder(db, mehmet.id, oi);
  api.orderAction(db, ayse, o3.id, 'approve'); api.orderAction(db, mehmet, o3.id, 'pay');
  api.orderAction(db, admin, o3.id, 'paymentReject');
  ok(api.getOrder(db, o3.id)!.status === 'rejected' && db.payments.find((p) => p.orderId === o3.id)!.status === 'rejected', 'payment reject');
  const o4 = api.createOrder(db, mehmet.id, oi);
  api.orderAction(db, mehmet, o4.id, 'cancel');
  ok(api.getOrder(db, o4.id)!.status === 'cancelled', 'buyer cancel');

  // Mesaj
  throws(() => api.sendMessage(db, fatma.id, o.id, 'selam'), 'outsider message');
  api.sendMessage(db, ayse.id, o.id, 'Afiyet olsun');
  ok(db.messages.at(-1)!.receiverId === mehmet.id, 'message receiver');
  ok(db.notifications.some((n) => n.userId === mehmet.id && n.orderId === o.id && n.title.startsWith(api.MESSAGE_PREFIX) && !n.read), 'message notification created');
  ok(api.markChatRead(db, mehmet.id, o.id) === true && api.markChatRead(db, mehmet.id, o.id) === false, 'mark read');
  ok(!db.notifications.some((n) => n.userId === mehmet.id && n.orderId === o.id && n.title.startsWith(api.MESSAGE_PREFIX) && !n.read), 'message notifications cleared');

  // Silme kuralları
  const o5 = api.createOrder(db, mehmet.id, oi);
  throws(() => api.deleteListing(db, ayse, kunefe.id), 'delete listing with open order');
  throws(() => api.deleteUser(db, admin, ayse.id), 'delete user with open order');
  throws(() => api.deleteUser(db, admin, admin.id), 'delete self');
  throws(() => api.setUserRole(db, mehmet, ayse.id, 'admin'), 'non-admin role change');
  api.orderAction(db, mehmet, o5.id, 'cancel');

  // Mahalle önerileri
  ok(suggestNeighborhoods('Antakya', 'arm')[0] === 'Armutlu', 'suggest arm');
  ok(suggestNeighborhoods('İskenderun', 'ÇAY').includes('Güzelçay'), 'suggest Turkish case');
  ok(suggestNeighborhoods(undefined, 'har').length > 0, 'suggest all');


  // Kayıt onayı
  {
    const d = clone(seed);
    throws(() => api.register(d, { name: 'Ali Veli', email: 'yeni@x.com', password: '123456', district: 'Kumlu', neighborhood: 'Yeni', acceptedTerms: false }, 'h'), 'terms required');
    const u = api.register(d, { name: 'Ali Veli', email: 'yeni@x.com', password: '123456', district: 'Kumlu', neighborhood: 'Yeni', acceptedTerms: true }, 'h');
    ok(!!u.acceptedTermsAt, 'terms timestamp saved');
  }
  // Fotoğraf sınırı ve kayıt
  {
    const d = clone(seed);
    const a = U(d, 'u-ayse');
    const b0 = { title: 'Foto', description: 'Uzun bir açıklama', price: 50, category: 'tatli' as const, prepTime: '', delivery: ['pickup' as const], status: 'active' as const };
    throws(() => api.saveListing(d, a.id, { ...b0, images: ['1','2','3','4','5','6','7'] }), 'max 6 photos');
    const l = api.saveListing(d, a.id, { ...b0, images: ['p1', 'p2'] });
    ok(l.images.join() === 'p1,p2', 'images saved in order');
    throws(() => api.saveListing(d, a.id, { ...b0, images: [], price: 100001 }), 'price upper bound');
  }
  // Elden teslim adresi onayda paylaşılır
  {
    const d = clone(seed);
    const k = d.listings.find((x) => x.title.startsWith('Antakya Künefesi'))!;
    const o = api.createOrder(d, 'u-mehmet', { listingId: k.id, quantity: 1, appointment: fut(2), delivery: 'pickup', address: '', note: '' });
    ok(!api.getOrder(d, o.id)!.pickupAddress, 'no pickup address before approval');
    api.orderAction(d, U(d, 'u-ayse'), o.id, 'approve');
    ok(api.getOrder(d, o.id)!.pickupAddress === U(d, 'u-ayse').address, 'pickup address after approval');
    ok(api.firstOrderMessage('Künefe', { appointment: fut(2), quantity: 2, delivery: 'pickup', note: 'Fıstıklı' }).includes('📝 Not: Fıstıklı'), 'first message includes note');
  }
  // Hesap silme
  {
    const d = clone(seed);
    throws(() => api.deleteAccount(d, 'u-mehmet'), 'delete blocked by open order');
    const hatice = 'u-hatice';
    throws(() => api.deleteAccount(d, hatice), 'hatice has pending payment');
    api.deleteAccount(d, 'u-zeynep');
    ok(!api.getUser(d, 'u-zeynep') && !d.listings.some((l) => l.ownerId === 'u-zeynep'), 'account + listings removed');
  }
  // Şikayet, engelleme
  {
    const d = clone(seed);
    const k = d.listings.find((x) => x.title.startsWith('Antakya Künefesi'))!;
    api.reportContent(d, 'u-mehmet', { targetType: 'listing', targetId: k.id, reason: 'hygiene', note: 'x' });
    ok(d.reports.length === 1 && d.notifications.some((n) => n.userId === 'u-admin' && n.title.startsWith('Yeni şikayet')), 'report + admin notified');
    throws(() => api.reportContent(d, 'u-mehmet', { targetType: 'listing', targetId: k.id, reason: 'hygiene', note: '' }), 'duplicate open report');
    throws(() => api.reportContent(d, 'u-mehmet', { targetType: 'user', targetId: 'u-mehmet', reason: 'abuse', note: '' }), 'self report');
    throws(() => api.resolveReport(d, U(d, 'u-mehmet'), d.reports[0]!.id), 'non-admin resolve');
    api.resolveReport(d, U(d, 'u-admin'), d.reports[0]!.id);
    ok(d.reports[0]!.status === 'resolved', 'report resolved');
    api.blockUser(d, 'u-mehmet', 'u-ayse');
    api.blockUser(d, 'u-mehmet', 'u-ayse');
    ok(d.blocks.length === 1, 'block idempotent');
    const open = d.orders.find((o) => o.buyerId === 'u-mehmet' && o.sellerId === 'u-ayse')!;
    throws(() => api.sendMessage(d, 'u-ayse', open.id, 'selam'), 'blocked: seller cannot message');
    throws(() => api.createOrder(d, 'u-mehmet', { listingId: k.id, quantity: 1, appointment: fut(2), delivery: 'pickup', address: '', note: '' }), 'blocked: cannot order');
    api.unblockUser(d, 'u-mehmet', 'u-ayse');
    api.sendMessage(d, 'u-ayse', open.id, 'selam');
    ok(true, 'unblock restores messaging');
    throws(() => api.sendMessage(d, 'u-ayse', open.id, 'x'.repeat(1001)), 'message length');
    api.markNotificationsRead(d, 'u-mehmet');
    ok(!d.notifications.some((n) => n.userId === 'u-mehmet' && !n.read), 'notifications read');
  }

  console.log(`${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})();
