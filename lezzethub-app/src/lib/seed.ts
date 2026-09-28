// İlk açılışta yüklenen örnek veriler (demo hesaplar, Hatay lezzetleri ve örnek siparişler).
import { createOrder, orderAction, saveListing, sendMessage } from './api';
import type { ListingInput } from './api';
import type { DB, User } from './types';

export const DB_VERSION = 2;

export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@lezzethub.com', password: 'admin123', hint: 'Yönetici paneli' },
  { label: 'Ayşe (Satıcı)', email: 'ayse@lezzethub.com', password: '123456', hint: 'Antakya · Armutlu' },
  { label: 'Mehmet (Alıcı)', email: 'mehmet@lezzethub.com', password: '123456', hint: 'Antakya · Cumhuriyet' },
];

type SeedUser = Omit<User, 'passwordHash' | 'createdAt' | 'active'> & { password: string };

const USERS: SeedUser[] = [
  {
    id: 'u-admin', name: 'LezzetHub Yönetim', email: 'admin@lezzethub.com', password: 'admin123', role: 'admin',
    bio: 'Platform yönetimi', district: 'Antakya', neighborhood: 'Kışlasaray', address: '', availability: '',
  },
  {
    id: 'u-ayse', name: 'Ayşe Demir', email: 'ayse@lezzethub.com', password: '123456', role: 'user',
    bio: 'Annemden öğrendiğim Antakya tariflerini sevgiyle hazırlıyorum. Künefem mahallede meşhurdur 🧡',
    district: 'Antakya', neighborhood: 'Armutlu', address: 'Armutlu Mah. 12. Sok. No:4 D:2, Antakya',
    availability: 'Hafta içi 10:00–20:00, Cumartesi 12:00–18:00',
  },
  {
    id: 'u-mehmet', name: 'Mehmet Kaya', email: 'mehmet@lezzethub.com', password: '123456', role: 'user',
    bio: 'Ev yemeği tutkunu, yoğun çalışan bir baba.', district: 'Antakya', neighborhood: 'Cumhuriyet',
    address: 'Cumhuriyet Mah. Atatürk Cad. No:88 D:5, Antakya', availability: 'Akşamları 18:00 sonrası',
  },
  {
    id: 'u-fatma', name: 'Fatma Yıldız', email: 'fatma@lezzethub.com', password: '123456', role: 'user',
    bio: 'Harbiye’de bahçemizin ürünleriyle oruk ve kömbe yapıyorum.', district: 'Defne', neighborhood: 'Harbiye',
    address: 'Harbiye Mah. Şelale Yolu No:21, Defne', availability: 'Her gün 09:00–19:00',
  },
  {
    id: 'u-hatice', name: 'Hatice Arslan', email: 'hatice@lezzethub.com', password: '123456', role: 'user',
    bio: 'İskenderun’da meze ve kahvaltılık hazırlıyorum. Siparişe özel taze humus!', district: 'İskenderun', neighborhood: 'Çay',
    address: 'Çay Mah. 5. Cad. No:14, İskenderun', availability: 'Hafta içi 11:00–21:00',
  },
  {
    id: 'u-zeynep', name: 'Zeynep Çelik', email: 'zeynep@lezzethub.com', password: '123456', role: 'user',
    bio: 'Samandağ’ın zahterini ve biberli ekmeğini sizlerle paylaşıyorum.', district: 'Samandağ', neighborhood: 'Mağaracık',
    address: 'Mağaracık Mah. Sahil Yolu No:3, Samandağ', availability: 'Salı–Pazar 08:00–16:00',
  },
];

type SeedListing = Omit<ListingInput, 'images'> & { owner: string };

const LISTINGS: SeedListing[] = [
  {
    owner: 'u-ayse', title: 'Antakya Künefesi (Tepsi)', category: 'tatli', price: 180,
    description: 'Hatay’ın meşhur tuzsuz peyniri ve tel kadayıfla, tereyağında pişen sıcak künefe. Şerbeti ayrı paketlenir, isteğe göre fıstıklı.',
    prepTime: 'Sipariş sonrası 1 saatte hazır', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-ayse', title: 'Tepsi Kebabı', category: 'ana-yemek', price: 320,
    description: 'Taş fırında pişmiş, bol biberli ve domatesli Antakya usulü tepsi kebabı. 2 kişiliktir, yanında pide ile.',
    prepTime: '1 gün önceden sipariş', delivery: ['pickup'], status: 'active',
  },
  {
    owner: 'u-ayse', title: 'Haytalı', category: 'tatli', price: 90,
    description: 'Gül suyu şerbetli, nişasta muhallebili serinleten Antakya tatlısı. Kase başı fiyattır.',
    prepTime: 'Aynı gün, 3 saat içinde', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-mehmet', title: 'Ev Yapımı Nar Ekşisi (500 ml)', category: 'diger', price: 150,
    description: 'Bahçemizin narlarından kazanda kaynatılmış katkısız nar ekşisi. Salata ve mezeler için birebir.',
    prepTime: 'Stokta, hemen teslim', delivery: ['pickup'], status: 'active',
  },
  {
    owner: 'u-fatma', title: 'Oruk (İçli Köfte) — 10’lu', category: 'hamur-isi', price: 260,
    description: 'Cevizli, bol baharatlı iç harçla hazırlanan Hatay usulü fırın oruk. Donuk ya da pişmiş gönderilebilir.',
    prepTime: '4 saat hazırlık', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-fatma', title: 'Kömbe (Hatay Çöreği) — 1 kg', category: 'hamur-isi', price: 220,
    description: 'Mahlepli, çörek otlu, cevizli ve hurmalı karışık kömbe. Özel kalıplarla odun fırınında pişirilir.',
    prepTime: '1 gün önceden sipariş', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-hatice', title: 'Taze Humus & Muhammara Tabağı', category: 'meze', price: 140,
    description: 'Tahinli, bol limonlu taze humus ve cevizli, nar ekşili muhammara. Yanında sıcak lavaş ile.',
    prepTime: '2 saat içinde', delivery: ['courier', 'pickup'], status: 'active',
  },
  {
    owner: 'u-hatice', title: 'Süzme Mercimek Çorbası (1 lt)', category: 'corba', price: 95,
    description: 'Tereyağlı, pul biberli klasik mercimek çorbası. Limon ve kıtır ekmek ile gönderilir.',
    prepTime: 'Aynı gün', delivery: ['courier'], status: 'active',
  },
  {
    owner: 'u-zeynep', title: 'Zahter Salatası & Biberli Ekmek', category: 'meze', price: 120,
    description: 'Taze zahter yaprakları, soğan ve nar ekşisiyle salata; yanında 4 adet taş fırın biberli ekmek.',
    prepTime: 'Sabah siparişleri öğlene hazır', delivery: ['pickup'], status: 'active',
  },
  {
    owner: 'u-zeynep', title: 'Ev Yapımı Limonata (1 lt)', category: 'icecek', price: 70,
    description: 'Samandağ limonlarından, naneli ve az şekerli ferah limonata.', prepTime: 'Aynı gün',
    delivery: ['courier', 'pickup'], status: 'passive',
  },
];

export async function createSeed(hash: (password: string) => Promise<string>): Promise<DB> {
  const db: DB = { version: DB_VERSION, users: [], listings: [], orders: [], messages: [], payments: [], notifications: [], reports: [], blocks: [] };
  const created = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString();
  for (const { password, ...u } of USERS) {
    db.users.push({ ...u, passwordHash: await hash(password), active: true, acceptedTermsAt: created, createdAt: created });
  }
  const ids: string[] = [];
  for (const { owner, ...l } of LISTINGS) ids.push(saveListing(db, owner, { ...l, images: [] }).id);

  const admin = db.users.find((u) => u.id === 'u-admin')!;
  const ayse = db.users.find((u) => u.id === 'u-ayse')!;
  const mehmet = db.users.find((u) => u.id === 'u-mehmet')!;
  const hatice = db.users.find((u) => u.id === 'u-hatice')!;
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // 1) Tamamlanmış örnek sipariş (Mehmet → Fatma, oruk)
  const o1 = createOrder(db, mehmet.id, { listingId: ids[4]!, quantity: 1, appointment: at(1, 19), delivery: 'courier', address: mehmet.address, note: '' });
  orderAction(db, db.users.find((u) => u.id === 'u-fatma')!, o1.id, 'approve');
  orderAction(db, mehmet, o1.id, 'pay');
  orderAction(db, admin, o1.id, 'paymentApprove');
  orderAction(db, mehmet, o1.id, 'complete');
  sendMessage(db, 'u-fatma', o1.id, 'Afiyet olsun Mehmet Bey, tekrar bekleriz 🙏');

  // 2) Admin ödeme onayı bekleyen sipariş (Hatice → Ayşe, haytalı)
  const o2 = createOrder(db, hatice.id, { listingId: ids[2]!, quantity: 4, appointment: at(2, 15), delivery: 'courier', address: hatice.address, note: 'Farklı ilçedeyim, kurye ücretini konuşalım.' });
  orderAction(db, ayse, o2.id, 'approve');
  sendMessage(db, ayse.id, o2.id, 'Merhaba Hatice Hanım, onayladım. Kuryeyi ben ayarlarım 🙂');
  orderAction(db, hatice, o2.id, 'pay');

  // 3) Satıcı onayı bekleyen sipariş (Mehmet → Ayşe, künefe)
  createOrder(db, mehmet.id, { listingId: ids[0]!, quantity: 2, appointment: at(3, 20), delivery: 'pickup', address: '', note: 'Fıstıklı olsun lütfen 🙏' });

  // Geçmiş tarihlere yay: örnek siparişler "gerçek" görünsün.
  const shift = (iso: string, h: number) => new Date(new Date(iso).getTime() - h * 3600000).toISOString();
  db.orders.forEach((o, i) => {
    const h = (db.orders.length - i) * 26;
    o.createdAt = shift(o.createdAt, h);
    o.history.forEach((x, j) => (x.at = shift(x.at, h - j * 2)));
    db.messages.filter((m) => m.orderId === o.id).forEach((m, j) => (m.createdAt = shift(m.createdAt, h - j * 2)));
  });
  o1.appointment = at(-1, 19);
  const o1Msgs = db.messages.filter((m) => m.orderId === o1.id);
  o1Msgs.forEach((m) => (m.read = true));
  return db;
}
