// İlk açılışta yüklenen örnek veriler (demo hesaplar, Türkiye genelinden ilanlar, örnek siparişler).
// Tüm kişiler, telefonlar, IBAN'lar ve belgeler uydurmadır.
import { createOrder, orderAction, reportContent, saveListing, sendMessage, setShipment } from './api';
import type { ListingInput } from './api';
import { SAMPLE_HYGIENE_DOC, SAMPLE_LICENSE_DOC } from './sample-docs';
import type { CourierProfile, DB, User, Verification } from './types';

export const DB_VERSION = 5;

export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@lezzetkat.com', password: 'admin123', hint: 'Yönetici paneli' },
  { label: 'Ayşe (Satıcı)', email: 'ayse@lezzetkat.com', password: '123456', hint: 'Hatay · Antakya' },
  { label: 'Mehmet (Alıcı)', email: 'mehmet@lezzetkat.com', password: '123456', hint: 'Hatay · Antakya' },
  { label: 'Kemal (Kurye)', email: 'kemal@lezzetkat.com', password: '123456', hint: 'Hatay · Antakya/Defne' },
];

/** Demo ödeme ekranında kullanılabilecek test kartları. */
export const TEST_CARDS = {
  success: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
};

/** 16 haneli hesap numarasından geçerli kontrol haneli (uydurma) TR IBAN üretir. */
function demoIban(bank: string, account: string) {
  const bban = `${bank}0${account}`; // 5 banka + 1 rezerv + 16 hesap
  const numeric = (bban + 'TR00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return `TR${String(98 - rem).padStart(2, '0')}${bban}`;
}

type SeedUser = Omit<User, 'passwordHash' | 'createdAt' | 'active' | 'acceptedTermsAt' | 'kvkkConsentAt'> & { password: string };

const base = { role: 'user' as const, sellerStatus: 'none' as const, courierStatus: 'none' as const, phone: '' };

const USERS: SeedUser[] = [
  {
    ...base, id: 'u-admin', name: 'LezzetKAT Yönetim', email: 'admin@lezzetkat.com', password: 'admin123', role: 'admin',
    bio: 'Platform yönetimi', province: 'Hatay', district: 'Antakya', neighborhood: 'Kışlasaray', address: '', availability: '',
  },
  {
    ...base, id: 'u-ayse', name: 'Ayşe Demir', email: 'ayse@lezzetkat.com', password: '123456', sellerStatus: 'approved',
    bio: 'Annemden öğrendiğim Antakya tariflerini sevgiyle hazırlıyorum. Künefem mahallede meşhurdur 🧡',
    province: 'Hatay', district: 'Antakya', neighborhood: 'Armutlu', address: 'Armutlu Mah. 12. Sok. No:4 D:2, Antakya/Hatay',
    phone: '05550000001', availability: 'Hafta içi 10:00–20:00, Cumartesi 12:00–18:00',
  },
  {
    ...base, id: 'u-mehmet', name: 'Mehmet Kaya', email: 'mehmet@lezzetkat.com', password: '123456',
    bio: 'Ev yemeği tutkunu, yoğun çalışan bir baba.', province: 'Hatay', district: 'Antakya', neighborhood: 'Cumhuriyet',
    address: 'Cumhuriyet Mah. Atatürk Cad. No:88 D:5, Antakya/Hatay', phone: '05550000002', availability: 'Akşamları 18:00 sonrası',
  },
  {
    ...base, id: 'u-fatma', name: 'Fatma Yıldız', email: 'fatma@lezzetkat.com', password: '123456', sellerStatus: 'approved',
    bio: 'Harbiye’de bahçemizin ürünleriyle oruk ve kömbe yapıyorum.', province: 'Hatay', district: 'Defne', neighborhood: 'Harbiye',
    address: 'Harbiye Mah. Şelale Yolu No:21, Defne/Hatay', phone: '05550000003', availability: 'Her gün 09:00–19:00',
  },
  {
    ...base, id: 'u-hatice', name: 'Hatice Arslan', email: 'hatice@lezzetkat.com', password: '123456', sellerStatus: 'approved',
    bio: 'İskenderun’da meze ve kahvaltılık hazırlıyorum. Siparişe özel taze humus!', province: 'Hatay', district: 'İskenderun', neighborhood: 'Çay',
    address: 'Çay Mah. 5. Cad. No:14, İskenderun/Hatay', phone: '05550000004', availability: 'Hafta içi 11:00–21:00',
  },
  {
    ...base, id: 'u-zeynep', name: 'Zeynep Çelik', email: 'zeynep@lezzetkat.com', password: '123456', sellerStatus: 'approved',
    bio: 'Samandağ’ın zahterini, nar ekşisini ve biberli ekmeğini sizlerle paylaşıyorum.', province: 'Hatay', district: 'Samandağ', neighborhood: 'Mağaracık',
    address: 'Mağaracık Mah. Sahil Yolu No:3, Samandağ/Hatay', phone: '05550000005', availability: 'Salı–Pazar 08:00–16:00',
  },
  {
    ...base, id: 'u-kemal', name: 'Kemal Aksoy', email: 'kemal@lezzetkat.com', password: '123456', courierStatus: 'approved',
    bio: 'Antakya ve Defne’de motosikletle hızlı teslimat.', province: 'Hatay', district: 'Antakya', neighborhood: 'Kuyulu',
    address: 'Kuyulu Mah., Antakya/Hatay', phone: '05550000006', availability: 'Her gün 10:00–22:00',
  },
  {
    ...base, id: 'u-serkan', name: 'Serkan Öztürk', email: 'serkan@lezzetkat.com', password: '123456', sellerStatus: 'approved',
    bio: 'Gaziantepli annemin tarifiyle ev baklavası ve mantı. Türkiye’nin her yerine kargo.', province: 'Ankara', district: 'Çankaya', neighborhood: 'Kızılay',
    address: 'Kızılay Mah. Sakarya Cad. No:10, Çankaya/Ankara', phone: '05550000007', availability: 'Hafta içi 09:00–18:00',
  },
  {
    ...base, id: 'u-elif', name: 'Elif Şahin', email: 'elif@lezzetkat.com', password: '123456', sellerStatus: 'pending',
    bio: 'Kadıköy’de zeytinyağlılar ve sarmalar.', province: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa',
    address: 'Caferağa Mah. Moda Cad. No:5, Kadıköy/İstanbul', phone: '05550000008', availability: '',
  },
  {
    ...base, id: 'u-burak', name: 'Burak Yılmaz', email: 'burak@lezzetkat.com', password: '123456', courierStatus: 'pending',
    bio: '', province: 'İstanbul', district: 'Kadıköy', neighborhood: 'Fenerbahçe',
    address: '', phone: '05550000009', availability: '',
  },
  {
    ...base, id: 'u-deniz', name: 'Deniz Aydın', email: 'deniz@lezzetkat.com', password: '123456',
    bio: 'İzmir’den Anadolu lezzetleri meraklısı.', province: 'İzmir', district: 'Karşıyaka', neighborhood: 'Bostanlı',
    address: 'Bostanlı Mah. Cemal Gürsel Cad. No:200 D:7, Karşıyaka/İzmir', phone: '05550000010', availability: '',
  },
];

type SeedListing = Omit<ListingInput, 'images' | 'allergens' | 'noAllergens' | 'shelfLife' | 'shelfStable' | 'safetyConfirmed'> & { owner: string };

/** İlanların alerjen, son tüketim ve dayanıklılık bilgileri (başlığa göre). */
const FOOD: Record<string, Pick<ListingInput, 'allergens' | 'shelfLife' | 'shelfStable'>> = {
  'Antakya Künefesi (Tepsi)': { allergens: ['sut', 'gluten', 'kuruyemis'], shelfLife: 'Sıcak tüketilmeli; buzdolabında 1 gün', shelfStable: false },
  'Tepsi Kebabı': { allergens: ['gluten'], shelfLife: 'Aynı gün tüketilmeli; buzdolabında 1 gün', shelfStable: false },
  Haytalı: { allergens: ['sut'], shelfLife: 'Buzdolabında 2 gün', shelfStable: false },
  'Oruk (İçli Köfte) — 10’lu': { allergens: ['gluten', 'kuruyemis'], shelfLife: 'Pişmiş: buzdolabında 2 gün · Donuk: -18°C’de 1 ay', shelfStable: false },
  'Kömbe (Hatay Çöreği) — 1 kg': { allergens: ['gluten', 'kuruyemis', 'susam', 'yumurta'], shelfLife: 'Oda sıcaklığında, kapalı kapta 10 gün', shelfStable: true },
  'Taze Humus & Muhammara Tabağı': { allergens: ['susam', 'kuruyemis', 'gluten'], shelfLife: 'Buzdolabında 2 gün', shelfStable: false },
  'Süzme Mercimek Çorbası (1 lt)': { allergens: ['sut', 'kereviz'], shelfLife: 'Buzdolabında 2 gün', shelfStable: false },
  'Zahter Salatası & Biberli Ekmek': { allergens: ['gluten'], shelfLife: 'Aynı gün tüketilmeli', shelfStable: false },
  'Ev Yapımı Nar Ekşisi (500 ml)': { allergens: [], shelfLife: 'Açılmadan 12 ay; açıldıktan sonra buzdolabında 3 ay', shelfStable: true },
  'Ev Yapımı Limonata (1 lt)': { allergens: [], shelfLife: 'Buzdolabında 2 gün', shelfStable: false },
  'Antep Fıstıklı Ev Baklavası (1 kg)': { allergens: ['gluten', 'sut', 'kuruyemis'], shelfLife: 'Oda sıcaklığında 7 gün, buzdolabına koymayın', shelfStable: true },
  'Kayseri Usulü Ev Mantısı (1 kg, dondurulmuş)': { allergens: ['gluten', 'yumurta', 'sut'], shelfLife: 'Dondurucuda (-18°C) 2 ay; çözdükten sonra tekrar dondurulmaz', shelfStable: false },
};

const LISTINGS: SeedListing[] = [
  {
    owner: 'u-ayse', title: 'Antakya Künefesi (Tepsi)', category: 'tatli', price: 180, shippingPayer: 'buyer',
    description: 'Hatay’ın meşhur tuzsuz peyniri ve tel kadayıfla, tereyağında pişen sıcak künefe. Şerbeti ayrı paketlenir, isteğe göre fıstıklı. İçerik: süt ürünü, gluten.',
    prepTime: 'Sipariş sonrası 1 saatte hazır', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-ayse', title: 'Tepsi Kebabı', category: 'ana-yemek', price: 320, shippingPayer: 'buyer',
    description: 'Taş fırında pişmiş, bol biberli ve domatesli Antakya usulü tepsi kebabı. 2 kişiliktir, yanında pide ile.',
    prepTime: '1 gün önceden sipariş', delivery: ['pickup'], status: 'active',
  },
  {
    owner: 'u-ayse', title: 'Haytalı', category: 'tatli', price: 90, shippingPayer: 'seller',
    description: 'Gül suyu şerbetli, nişasta muhallebili serinleten Antakya tatlısı. Kase başı fiyattır; Antakya içi kurye ücretsiz.',
    prepTime: 'Aynı gün, 3 saat içinde', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-fatma', title: 'Oruk (İçli Köfte) — 10’lu', category: 'hamur-isi', price: 260, shippingPayer: 'buyer',
    description: 'Cevizli, bol baharatlı iç harçla hazırlanan Hatay usulü fırın oruk. Donuk ya da pişmiş gönderilebilir. İçerik: gluten, ceviz.',
    prepTime: '4 saat hazırlık', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-fatma', title: 'Kömbe (Hatay Çöreği) — 1 kg', category: 'hamur-isi', price: 220, shippingPayer: 'buyer',
    description: 'Mahlepli, çörek otlu, cevizli ve hurmalı karışık kömbe. Özel kalıplarla odun fırınında pişirilir; kargoya uygundur.',
    prepTime: '1 gün önceden sipariş', delivery: ['courier', 'pickup', 'cargo'], status: 'active',
  },
  {
    owner: 'u-hatice', title: 'Taze Humus & Muhammara Tabağı', category: 'meze', price: 140, shippingPayer: 'buyer',
    description: 'Tahinli, bol limonlu taze humus ve cevizli, nar ekşili muhammara. Yanında sıcak lavaş ile. İçerik: susam, ceviz.',
    prepTime: '2 saat içinde', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-hatice', title: 'Süzme Mercimek Çorbası (1 lt)', category: 'corba', price: 95, shippingPayer: 'seller',
    description: 'Tereyağlı, pul biberli klasik mercimek çorbası. Limon ve kıtır ekmek ile gönderilir.',
    prepTime: 'Aynı gün', delivery: ['courier'], status: 'active',
  },
  {
    owner: 'u-zeynep', title: 'Zahter Salatası & Biberli Ekmek', category: 'meze', price: 120, shippingPayer: 'buyer',
    description: 'Taze zahter yaprakları, soğan ve nar ekşisiyle salata; yanında 4 adet taş fırın biberli ekmek.',
    prepTime: 'Sabah siparişleri öğlene hazır', delivery: ['pickup'], status: 'active',
  },
  {
    owner: 'u-zeynep', title: 'Ev Yapımı Nar Ekşisi (500 ml)', category: 'diger', price: 150, shippingPayer: 'buyer',
    description: 'Samandağ narlarından kazanda kaynatılmış katkısız nar ekşisi. Cam şişede, kırılmaz paketle kargolanır.',
    prepTime: 'Stokta, 1 iş günü içinde kargoda', delivery: ['pickup', 'cargo'], status: 'active',
  },
  {
    owner: 'u-zeynep', title: 'Ev Yapımı Limonata (1 lt)', category: 'icecek', price: 70, shippingPayer: 'buyer',
    description: 'Samandağ limonlarından, naneli ve az şekerli ferah limonata.', prepTime: 'Aynı gün',
    delivery: ['courier', 'pickup'], status: 'passive',
  },
  {
    owner: 'u-serkan', title: 'Antep Fıstıklı Ev Baklavası (1 kg)', category: 'tatli', price: 850, shippingPayer: 'seller',
    description: 'El açması 40 kat yufka ve bol Antep fıstığı. Özel kutusunda, darbeye dayanıklı paketle Türkiye’nin her yerine ücretsiz kargo.',
    prepTime: '2 iş günü içinde kargoda', delivery: ['cargo'], status: 'active',
  },
  {
    owner: 'u-serkan', title: 'Kayseri Usulü Ev Mantısı (1 kg, dondurulmuş)', category: 'hamur-isi', price: 380, shippingPayer: 'buyer',
    description: 'Minicik bohçalar, dana kıymalı. Dondurulmuş olarak teslim edilir (soğuk zincir gerektiği için kargo yok); yoğurt ve sos tarifiyle birlikte.',
    prepTime: '1 gün önceden sipariş', delivery: ['pickup', 'courier'], status: 'active',
  },
];

const COURIERS: Omit<CourierProfile, 'updatedAt'>[] = [
  { userId: 'u-kemal', licenseClass: 'A2', vehicle: 'motorcycle', phone: '05550000006', serviceProvince: 'Hatay', serviceDistricts: ['Antakya', 'Defne'], available: true },
  { userId: 'u-burak', licenseClass: 'B', vehicle: 'car', phone: '05550000009', serviceProvince: 'İstanbul', serviceDistricts: ['Kadıköy', 'Üsküdar', 'Ataşehir'], available: true },
];

export async function createSeed(hash: (password: string) => Promise<string>): Promise<DB> {
  const db: DB = {
    version: DB_VERSION, settings: { paymentMode: 'offline' }, users: [], listings: [], orders: [], messages: [], payments: [], notifications: [], reports: [], blocks: [], verifications: [], couriers: [],
  };
  const created = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString();
  for (const { password, ...u } of USERS) {
    db.users.push({ ...u, passwordHash: await hash(password), active: true, acceptedTermsAt: created, kvkkConsentAt: created, createdAt: created });
  }

  // Satıcı ve kurye başvuruları (onaylı ve bekleyen örnekler)
  let n = 1;
  const verification = (userId: string, kind: 'seller' | 'courier', status: Verification['status']): Verification => ({
    id: `v-${n++}`,
    userId,
    kind,
    status,
    docUri: kind === 'seller' ? SAMPLE_HYGIENE_DOC : SAMPLE_LICENSE_DOC,
    docType: 'image',
    docNumber: kind === 'seller' ? `MEB-HYG-${1000 + n}-DEMO` : `DEMO${900000 + n}`,
    foodRegistrationNo: kind === 'seller' ? `TR-DEMO-K-${String(10000 + n)}` : undefined,
    licenseClass: kind === 'courier' ? (userId === 'u-burak' ? 'B' : 'A2') : undefined,
    iban: kind === 'seller' ? demoIban('00062', String(1000000000000000 + n)) : undefined,
    ibanHolder: kind === 'seller' ? db.users.find((u) => u.id === userId)!.name : undefined,
    declarationAt: created,
    documentConsentAt: created,
    submittedAt: created,
    reviewedAt: status === 'pending' ? undefined : created,
  });
  for (const u of db.users) {
    if (u.sellerStatus !== 'none') {
      const v = verification(u.id, 'seller', u.sellerStatus as Verification['status']);
      db.verifications.push(v);
      if (u.sellerStatus === 'approved') u.foodRegistrationNo = v.foodRegistrationNo;
    }
    if (u.courierStatus !== 'none') db.verifications.push(verification(u.id, 'courier', u.courierStatus as Verification['status']));
  }
  db.couriers = COURIERS.map((c) => ({ ...c, updatedAt: created }));

  const ids: string[] = [];
  for (const { owner, ...l } of LISTINGS) {
    const food = FOOD[l.title]!;
    ids.push(saveListing(db, owner, { ...l, ...food, noAllergens: food.allergens.length === 0, safetyConfirmed: true, images: [] }).id);
  }

  const U = (id: string) => db.users.find((u) => u.id === id)!;
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  // Demo verisi pilot moddadır: ödemeler teslimatta doğrudan satıcıya yapılır, komisyon alınmaz.

  // 1) Tamamlanmış sipariş (Mehmet → Fatma, oruk, kurye)
  const o1 = createOrder(db, 'u-mehmet', { listingId: ids[3]!, quantity: 1, appointment: at(1, 19), delivery: 'courier', address: U('u-mehmet').address, note: '' });
  orderAction(db, U('u-fatma'), o1.id, 'approve');
  orderAction(db, U('u-mehmet'), o1.id, 'complete');
  sendMessage(db, 'u-fatma', o1.id, 'Afiyet olsun Mehmet Bey, tekrar bekleriz 🙏');

  // 2) Tamamlanmış sipariş (Mehmet → Hatice, mercimek çorbası)
  const o2 = createOrder(db, 'u-mehmet', { listingId: ids[6]!, quantity: 2, appointment: at(1, 13), delivery: 'courier', address: U('u-mehmet').address, note: '' });
  orderAction(db, U('u-hatice'), o2.id, 'approve');
  orderAction(db, U('u-hatice'), o2.id, 'complete');

  // 3) Kargoya verilmiş sipariş (Deniz/İzmir → Serkan/Ankara, baklava, kargo satıcıdan)
  const o3 = createOrder(db, 'u-deniz', { listingId: ids[10]!, quantity: 1, appointment: at(3, 12), delivery: 'cargo', address: U('u-deniz').address, note: 'Hediye paketi olursa sevinirim.' });
  orderAction(db, U('u-serkan'), o3.id, 'approve');
  sendMessage(db, 'u-serkan', o3.id, 'Merhaba Deniz Hanım, ödemeyi IBAN’a havale ile yapabilirsiniz; bilgileri buradan iletiyorum.');
  setShipment(db, U('u-serkan'), o3.id, 'Yurtiçi Kargo', 'YK1234567890');

  // 4) Onaylanmış, teslim bekleyen sipariş (Hatice → Ayşe, haytalı, kurye satıcıdan)
  const o4 = createOrder(db, 'u-hatice', { listingId: ids[2]!, quantity: 4, appointment: at(2, 15), delivery: 'courier', address: U('u-hatice').address, note: 'Farklı ilçedeyim, kurye için yazışalım.' });
  orderAction(db, U('u-ayse'), o4.id, 'approve');
  sendMessage(db, 'u-ayse', o4.id, 'Merhaba Hatice Hanım, onayladım. Kurye ücreti bizden, ödemeyi teslimatta yaparsınız 🙂');

  // 5) Satıcı onayı bekleyen sipariş (Mehmet → Ayşe, künefe)
  createOrder(db, 'u-mehmet', { listingId: ids[0]!, quantity: 2, appointment: at(3, 20), delivery: 'pickup', address: '', note: 'Fıstıklı olsun lütfen 🙏' });

  // 6) Hijyen şikayeti örneği: iki farklı kişiden şikayet → ilan otomatik incelemeye alınır.
  reportContent(db, 'u-mehmet', { targetType: 'listing', targetId: ids[7]!, reason: 'hygiene', note: 'Salatada yabancı madde vardı.' });
  reportContent(db, 'u-deniz', { targetType: 'listing', targetId: ids[7]!, reason: 'hygiene', note: 'Ürün bayat geldi.' });

  // Geçmiş tarihlere yay: örnek siparişler "gerçek" görünsün.
  const shift = (iso: string, h: number) => new Date(new Date(iso).getTime() - h * 3600000).toISOString();
  db.orders.forEach((o, i) => {
    const h = (db.orders.length - i) * 26;
    o.createdAt = shift(o.createdAt, h);
    o.history.forEach((x, j) => (x.at = shift(x.at, h - j * 2)));
    db.messages.filter((m) => m.orderId === o.id).forEach((m, j) => (m.createdAt = shift(m.createdAt, h - j * 2)));
    db.payments.filter((p) => p.orderId === o.id).forEach((p) => (p.createdAt = p.paidAt = shift(p.createdAt, h - 3)));
  });
  for (const o of [o1, o2]) o.appointment = at(-2, 19);
  db.messages.filter((m) => m.orderId === o1.id || m.orderId === o2.id).forEach((m) => (m.read = true));
  return db;
}
