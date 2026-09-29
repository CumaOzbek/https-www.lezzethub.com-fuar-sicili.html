// İş kuralı testleri: npm test
import * as api from '../src/lib/api';
import { calcBreakdown } from '../src/lib/commission';
import { districtsOf, findProvince, isValidDistrict, loadNeighbourhoods, suggestNeighborhoods, PROVINCES } from '../src/lib/locations';
import { TEST_CARDS, createSeed } from '../src/lib/seed';
import type { DB } from '../src/lib/types';

let pass = 0;
let failN = 0;
const ok = (c: unknown, m: string) => {
  if (c) pass++;
  else {
    failN++;
    console.log('FAIL:', m);
  }
};
const throws = (fn: () => unknown, m: string, expect?: string) => {
  try {
    fn();
    failN++;
    console.log('FAIL (no throw):', m);
  } catch (e) {
    if (!(e instanceof api.ApiError)) {
      failN++;
      console.log('FAIL (wrong error):', m, e);
    } else if (expect && !e.message.includes(expect)) {
      failN++;
      console.log('FAIL (wrong message):', m, '→', e.message);
    } else pass++;
  }
};
const clone = (d: DB) => JSON.parse(JSON.stringify(d)) as DB;
const fut = (days: number, h = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const card = { holder: 'TEST KULLANICI', number: TEST_CARDS.success, expiry: '12/30', cvc: '123' };
const reg = (over: Partial<api.RegisterInput> = {}): api.RegisterInput => ({
  name: 'Ali Veli', email: 'ali@x.com', password: '123456', province: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı',
  acceptedTerms: true, kvkkConsent: true, intent: 'buyer', ...over,
});

(async () => {
  /* Konum verisi */
  ok(PROVINCES.length === 81, '81 il');
  ok(PROVINCES.reduce((s, p) => s + districtsOf(p.name).length, 0) === 973, '973 ilçe');
  ok(findProvince('istanbul')?.code === '34' && findProvince('İZMİR')?.code === '35', 'il adı büyük/küçük harf duyarsız');
  ok(isValidDistrict('Hatay', 'Antakya') && !isValidDistrict('Hatay', 'Kadıköy'), 'ilçe ile eşleşmeli');
  const nb = await loadNeighbourhoods('İstanbul');
  ok((nb['Kadıköy'] ?? []).includes('Caferağa'), 'mahalleler il bazında yüklenir');
  ok(suggestNeighborhoods(nb['Kadıköy'] ?? [], 'fener')[0]?.startsWith('Fener'), 'mahalle önerisi');

  /* Doğrulama yardımcıları */
  ok(api.normalizePhone('0555 123 45 67') === '05551234567' && api.normalizePhone('+90 555 123 4567') === '05551234567', 'telefon biçimi');
  ok(api.normalizePhone('0212 123 45 67') === null && api.normalizePhone('123') === null, 'geçersiz telefon');
  ok(api.normalizeIban('TR33 0006 1005 1978 6457 8413 26') === 'TR330006100519786457841326', 'geçerli IBAN');
  ok(api.normalizeIban('TR330006100519786457841327') === null && api.normalizeIban('DE89370400440532013000') === null, 'geçersiz IBAN');
  ok(api.luhnValid(TEST_CARDS.success) && !api.luhnValid('4242 4242 4242 4241'), 'Luhn');

  /* Komisyon */
  const b = calcBreakdown(180, 1);
  ok(b.buyerFee === 18 && b.sellerFee === 27 && b.buyerTotal === 198 && b.sellerNet === 153, 'komisyon');

  /* Demo verisi */
  const seed = await createSeed(async (p) => 'h:' + p);
  const U = (db: DB, id: string) => db.users.find((u) => u.id === id)!;
  ok(new Set(seed.users.map((u) => u.province)).size >= 4, 'demo verisi birden çok ilde');
  ok(seed.listings.every((l) => U(seed, l.ownerId).sellerStatus === 'approved'), 'ilanların hepsi onaylı satıcılarda');
  ok(seed.listings.every((l) => l.province === U(seed, l.ownerId).province && l.district === U(seed, l.ownerId).district), 'ilan konumu satıcıdan');
  ok(seed.verifications.some((v) => v.status === 'pending' && v.kind === 'seller') && seed.verifications.some((v) => v.status === 'pending' && v.kind === 'courier'), 'bekleyen başvurular');
  ok(seed.verifications.filter((v) => v.kind === 'seller').every((v) => !!v.iban && api.normalizeIban(v.iban!) === v.iban), 'demo IBAN geçerli');
  ok(seed.orders.some((o) => o.delivery === 'cargo' && o.trackingCode), 'kargo takipli sipariş');
  ok(seed.payments.filter((p) => p.status === 'succeeded').length === 3, '3 başarılı test ödemesi');

  /* Kayıt ve zorunlu onaylar */
  {
    const db = clone(seed);
    throws(() => api.register(db, reg({ acceptedTerms: false }), 'h'), 'koşullar zorunlu', 'Kullanım Koşulları');
    throws(() => api.register(db, reg({ kvkkConsent: false }), 'h'), 'açık rıza zorunlu', 'açık rıza');
    throws(() => api.register(db, reg({ province: 'Atlantis' }), 'h'), 'geçersiz il', 'il');
    throws(() => api.register(db, reg({ district: 'Kadıköy' }), 'h'), 'ilçe ile uyuşmuyor', 'ilçe');
    throws(() => api.register(db, reg({ email: 'AYSE@lezzethub.com' }), 'h'), 'aynı e-posta');
    const u = api.register(db, reg({ intent: 'seller' }), 'h:123456');
    ok(u.province === 'İzmir' && u.sellerStatus === 'none' && u.courierStatus === 'none' && !!u.kvkkConsentAt && !!u.acceptedTermsAt, 'kayıt alanları ve onay zamanları');
    ok(db.notifications.some((n) => n.userId === u.id && n.body.includes('hijyen belgeni')), 'satıcı niyetiyle kayıtta yönlendirme');
  }

  /* Satıcı başvurusu ve onay */
  {
    const db = clone(seed);
    const u = api.register(db, reg(), 'h');
    const base = { title: 'Mantı', description: 'Ev yapımı mantı açıklaması', price: 100, category: 'hamur-isi' as const, images: [], prepTime: '', delivery: ['cargo' as const], shippingPayer: 'buyer' as const, status: 'active' as const };
    throws(() => api.saveListing(db, u.id, base), 'onaysız satıcı ilan veremez', 'hijyen belgesi');
    const app = { docUri: 'file://doc.jpg', docType: 'image' as const, barcode: 'MEB-ABCD-1234', iban: 'TR330006100519786457841326', ibanHolder: 'Ali Veli', acceptDeclaration: true, acceptDocumentConsent: true };
    throws(() => api.submitSellerApplication(db, u.id, { ...app, docUri: '' }), 'belge zorunlu', 'hijyen belgeni');
    throws(() => api.submitSellerApplication(db, u.id, { ...app, barcode: '12' }), 'barkod zorunlu', 'barkod');
    throws(() => api.submitSellerApplication(db, u.id, { ...app, iban: 'TR000' }), 'IBAN geçerli olmalı', 'IBAN');
    throws(() => api.submitSellerApplication(db, u.id, { ...app, acceptDeclaration: false }), 'mevzuat beyanı zorunlu', 'beyan');
    throws(() => api.submitSellerApplication(db, u.id, { ...app, acceptDocumentConsent: false }), 'belge açık rızası zorunlu', 'açık rıza');
    api.submitSellerApplication(db, u.id, app);
    const v = db.verifications.find((x) => x.userId === u.id)!;
    ok(U(db, u.id).sellerStatus === 'pending' && v.status === 'pending' && !!v.declarationAt && v.iban === 'TR330006100519786457841326', 'başvuru kaydı');
    ok(db.notifications.some((n) => n.userId === 'u-admin' && n.title.includes('satıcı başvurusu')), 'admine bildirim');
    throws(() => api.saveListing(db, u.id, base), 'bekleyen satıcı ilan veremez');
    throws(() => api.reviewVerification(db, U(db, 'u-mehmet'), v.id, true), 'admin olmayan onaylayamaz', 'yönetici');
    throws(() => api.reviewVerification(db, U(db, 'u-admin'), v.id, false), 'red gerekçesi zorunlu', 'gerekçe');
    api.reviewVerification(db, U(db, 'u-admin'), v.id, false, 'Belge okunmuyor');
    ok(U(db, u.id).sellerStatus === 'rejected' && db.notifications.some((n) => n.userId === u.id && n.body.includes('Belge okunmuyor')), 'red ve gerekçe bildirimi');
    api.submitSellerApplication(db, u.id, app);
    api.reviewVerification(db, U(db, 'u-admin'), db.verifications.find((x) => x.userId === u.id)!.id, true);
    ok(U(db, u.id).sellerStatus === 'approved' && db.verifications.filter((x) => x.userId === u.id).length === 1, 'yeniden başvuru ve onay');
    const l = api.saveListing(db, u.id, base);
    ok(l.province === 'İzmir' && l.district === 'Karşıyaka' && l.shippingPayer === 'buyer', 'onaylı satıcı ilan verir, il miras');
    throws(() => api.saveListing(db, u.id, { ...base, shippingPayer: 'x' as never }), 'ücret sorumlusu zorunlu');
  }

  /* Kurye başvurusu */
  {
    const db = clone(seed);
    const u = api.register(db, reg({ email: 'kurye@x.com', intent: 'courier' }), 'h');
    const app = { licenseClass: 'A2' as const, licenseNumber: '123456', docUri: 'file://ehliyet.jpg', docType: 'image' as const, phone: '0555 111 22 33', serviceProvince: 'İzmir', serviceDistricts: ['Karşıyaka', 'Bayraklı'], acceptDocumentConsent: true, acceptDeclaration: true };
    throws(() => api.submitCourierApplication(db, u.id, { ...app, licenseClass: 'C' as never }), 'yalnızca A2/B', 'A2 veya B');
    throws(() => api.submitCourierApplication(db, u.id, { ...app, docUri: '' }), 'ehliyet fotoğrafı zorunlu', 'fotoğrafını');
    throws(() => api.submitCourierApplication(db, u.id, { ...app, phone: '123' }), 'telefon zorunlu', 'Telefon');
    throws(() => api.submitCourierApplication(db, u.id, { ...app, serviceDistricts: [] }), 'ilçe zorunlu', 'ilçe');
    throws(() => api.submitCourierApplication(db, u.id, { ...app, serviceDistricts: ['Kadıköy'] }), 'ilçe hizmet iline ait olmalı');
    throws(() => api.submitCourierApplication(db, u.id, { ...app, acceptDocumentConsent: false }), 'açık rıza zorunlu', 'açık rıza');
    api.submitCourierApplication(db, u.id, app);
    ok(U(db, u.id).courierStatus === 'pending' && db.couriers.find((c) => c.userId === u.id)?.vehicle === 'motorcycle', 'kurye başvurusu, A2 → motosiklet');
    ok(api.couriersNear(db, 'İzmir', 'Karşıyaka').length === 0, 'onaysız kurye listede görünmez');
    api.reviewVerification(db, U(db, 'u-admin'), db.verifications.find((v) => v.userId === u.id && v.kind === 'courier')!.id, true);
    ok(api.couriersNear(db, 'İzmir', 'Karşıyaka').some((x) => x.user.id === u.id && x.servesDistrict), 'onaylı kurye yakındakilere görünür');
    ok(api.couriersNear(db, 'İzmir', 'Konak')[0]?.servesDistrict === false, 'aynı ildeki diğer ilçelerde de listelenir ama yakın değil');
    api.updateCourierProfile(db, u.id, { available: false, serviceDistricts: ['Konak'] });
    ok(api.couriersNear(db, 'İzmir', 'Konak')[0]?.servesDistrict === true, 'hizmet ilçeleri güncellenir');
    throws(() => api.updateCourierProfile(db, u.id, { serviceDistricts: ['Çankaya'] }), 'başka ilin ilçesi seçilemez');
    const near = api.couriersNear(seed, 'Hatay', 'Antakya');
    ok(near.length === 1 && near[0]!.user.id === 'u-kemal', 'demo kurye Antakya’da');
    ok(api.couriersNear(seed, 'İstanbul', 'Kadıköy').length === 0, 'bekleyen demo kurye görünmez');
  }

  /* Sipariş, kargo ve online ödeme */
  {
    const db = clone(seed);
    const baklava = db.listings.find((l) => l.title.startsWith('Antep Fıstıklı'))!;
    const oi = { listingId: baklava.id, quantity: 1, appointment: fut(3), delivery: 'cargo' as const, address: '', note: '' };
    throws(() => api.createOrder(db, 'u-mehmet', oi), 'kargo için adres zorunlu', 'Kargo');
    throws(() => api.createOrder(db, 'u-mehmet', { ...oi, delivery: 'pickup', address: '' }), 'desteklenmeyen teslimat');
    const o = api.createOrder(db, 'u-mehmet', { ...oi, address: 'Cumhuriyet Mah. Atatürk Cad. No:88, Antakya/Hatay' });
    ok(o.shippingPayer === 'seller' && o.buyerTotal === 935 && o.payoutStatus === 'pending', 'sipariş: ücret sorumlusu ilandan, tutarlar');
    ok(!api.canPay(o, U(db, 'u-mehmet')), 'onaydan önce ödeme yok');
    throws(() => api.payWithTestCard(db, 'u-mehmet', o.id, card), 'onaysız ödeme', 'ödeme yapılamaz');
    api.orderAction(db, U(db, 'u-serkan'), o.id, 'approve');
    ok(api.canPay(api.getOrder(db, o.id)!, U(db, 'u-mehmet')) && !api.canPay(api.getOrder(db, o.id)!, U(db, 'u-serkan')), 'yalnızca alıcı öder');
    throws(() => api.payWithTestCard(db, 'u-mehmet', o.id, { ...card, number: '4242 4242 4242 4241' }), 'Luhn hatalı kart', 'Kart numarası');
    throws(() => api.payWithTestCard(db, 'u-mehmet', o.id, { ...card, expiry: '01/20' }), 'süresi geçmiş kart', 'geçmiş');
    throws(() => api.payWithTestCard(db, 'u-mehmet', o.id, { ...card, cvc: '1' }), 'CVC', 'CVC');
    throws(() => api.payWithTestCard(db, 'u-mehmet', o.id, { ...card, number: TEST_CARDS.declined }), 'reddedilen kart', 'başarısız');
    ok(api.getOrder(db, o.id)!.status === 'approved' && db.payments.some((p) => p.orderId === o.id && p.status === 'failed'), 'başarısız ödeme kaydı, sipariş ödeme bekler');
    throws(() => api.setShipment(db, U(db, 'u-serkan'), o.id, 'Aras', 'AR123456'), 'ödemeden önce kargo bilgisi yok');
    api.payWithTestCard(db, 'u-mehmet', o.id, card);
    const paid = db.payments.find((p) => p.orderId === o.id && p.status === 'succeeded')!;
    ok(api.getOrder(db, o.id)!.status === 'paid' && paid.amount === 935 && paid.cardLast4 === '4242' && paid.provider === 'test', 'başarılı ödeme');
    ok(!JSON.stringify(db.payments).includes('4242424242424242'), 'kart numarası saklanmaz');
    ok(db.notifications.some((n) => n.userId === 'u-serkan' && n.title.startsWith('Ödeme alındı')), 'satıcıya ödeme bildirimi');
    throws(() => api.setShipment(db, U(db, 'u-mehmet'), o.id, 'Aras', 'AR123456'), 'kargo bilgisini yalnızca satıcı girer');
    api.setShipment(db, U(db, 'u-serkan'), o.id, 'Aras Kargo', 'AR123456');
    ok(api.getOrder(db, o.id)!.trackingCode === 'AR123456', 'kargo takip no');
    ok(api.availableActions(api.getOrder(db, o.id)!, U(db, 'u-admin')).includes('refund'), 'admin iade edebilir');
    throws(() => api.orderAction(db, U(db, 'u-mehmet'), o.id, 'refund'), 'alıcı iade yapamaz');
    throws(() => api.orderAction(db, U(db, 'u-mehmet'), o.id, 'cancel'), 'ödemeden sonra alıcı iptal edemez');
    api.orderAction(db, U(db, 'u-admin'), o.id, 'refund', 'Ürün bozuk geldi');
    ok(api.getOrder(db, o.id)!.status === 'cancelled' && db.payments.find((p) => p.id === paid.id)!.status === 'refunded', 'iade: ödeme iade, sipariş iptal');

    // Elden teslim adresi onayda
    const kunefe = db.listings.find((l) => l.title.startsWith('Antakya Künefesi'))!;
    const o2 = api.createOrder(db, 'u-mehmet', { listingId: kunefe.id, quantity: 1, appointment: fut(2), delivery: 'pickup', address: '', note: '' });
    ok(!api.getOrder(db, o2.id)!.pickupAddress, 'onaydan önce satıcı adresi yok');
    api.orderAction(db, U(db, 'u-ayse'), o2.id, 'approve');
    ok(api.getOrder(db, o2.id)!.pickupAddress === U(db, 'u-ayse').address, 'onaydan sonra satıcı adresi');
    api.orderAction(db, U(db, 'u-mehmet'), o2.id, 'cancel');
    ok(api.getOrder(db, o2.id)!.status === 'cancelled', 'ödemeden önce iptal');
  }

  /* Satıcı ödemeleri */
  {
    const db = clone(seed);
    const summary = api.payoutSummary(db);
    ok(summary.length === 1 && summary[0]!.sellerId === 'u-fatma' && summary[0]!.total === 221 && !!summary[0]!.verification?.iban, 'satıcıya aktarılacak tutar ve IBAN');
    const shipped = db.orders.find((o) => o.delivery === 'cargo')!;
    throws(() => api.markPayout(db, U(db, 'u-admin'), [shipped.id]), 'tamamlanmamış siparişe ödeme yok');
    throws(() => api.markPayout(db, U(db, 'u-mehmet'), [summary[0]!.orders[0]!.id]), 'admin olmayan ödeme işaretleyemez');
    api.markPayout(db, U(db, 'u-admin'), summary[0]!.orders.map((o) => o.id));
    ok(api.payoutSummary(db).length === 0 && api.adminStats(db).payoutDue === 0, 'ödeme işaretlendi');
    const s = api.adminStats(seed);
    ok(s.pendingVerifications === 2 && s.couriers === 1 && s.payoutDueCount === 1, 'admin istatistikleri');
  }

  /* Şikayet, engelleme, hesap silme */
  {
    const db = clone(seed);
    const k = db.listings.find((x) => x.title.startsWith('Antakya Künefesi'))!;
    api.reportContent(db, 'u-mehmet', { targetType: 'listing', targetId: k.id, reason: 'hygiene', note: 'x' });
    throws(() => api.reportContent(db, 'u-mehmet', { targetType: 'listing', targetId: k.id, reason: 'hygiene', note: '' }), 'mükerrer şikayet');
    api.blockUser(db, 'u-mehmet', 'u-ayse');
    throws(() => api.createOrder(db, 'u-mehmet', { listingId: k.id, quantity: 1, appointment: fut(2), delivery: 'pickup', address: '', note: '' }), 'engelliyken sipariş yok');
    api.unblockUser(db, 'u-mehmet', 'u-ayse');
    throws(() => api.deleteAccount(db, 'u-mehmet'), 'açık siparişle hesap silinmez');
    api.deleteAccount(db, 'u-kemal');
    ok(!db.couriers.some((c) => c.userId === 'u-kemal') && !db.verifications.some((v) => v.userId === 'u-kemal'), 'hesap silinince kurye profili ve belgeler silinir');
  }

  console.log(`${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})();
