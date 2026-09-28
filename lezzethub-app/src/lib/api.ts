// İş kuralları. Tüm fonksiyonlar bir DB taslağı üzerinde çalışır (store.tsx kopyalayıp kalıcılaştırır).
// Gerçek bir backend'e (Supabase, Firebase, REST) geçişte bu dosya servis çağrılarıyla değiştirilebilir.
import { calcBreakdown } from './commission';
import { DELIVERY_LABEL, STATUS_META, appointmentText, tl } from './format';
import { DISTRICTS } from './hatay';
import type {
  CategoryKey,
  DB,
  DeliveryMethod,
  Listing,
  ListingStatus,
  Order,
  OrderStatus,
  User,
} from './types';

export class ApiError extends Error {}

/** Mesaj bildirimlerinin başlık öneki. */
export const MESSAGE_PREFIX = '💬';

const fail = (msg: string): never => {
  throw new ApiError(msg);
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => new Date().toISOString();

export const normalizeEmail = (e: string) => e.trim().toLocaleLowerCase('en-US');
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function assertLocation(district: string, neighborhood: string) {
  if (!DISTRICTS.includes(district as (typeof DISTRICTS)[number])) fail('Lütfen Hatay ilçelerinden birini seçin.');
  if (!neighborhood.trim()) fail('Mahalle zorunludur.');
}

export const getUser = (db: DB, id: string) => db.users.find((u) => u.id === id);
export const getListing = (db: DB, id: string) => db.listings.find((l) => l.id === id);
export const getOrder = (db: DB, id: string) => db.orders.find((o) => o.id === id);

function notify(db: DB, userId: string, title: string, body: string, orderId?: string) {
  db.notifications.unshift({ id: uid(), userId, title, body, orderId, createdAt: now(), read: false });
}

function systemMessage(db: DB, order: Order, text: string) {
  db.messages.push({
    id: uid(),
    orderId: order.id,
    senderId: 'system',
    receiverId: '',
    text,
    createdAt: now(),
    read: true,
  });
}

/* ------------------------------ Kimlik ------------------------------ */

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  district: string;
  neighborhood: string;
}

export function validateRegister(db: DB, input: RegisterInput) {
  if (input.name.trim().length < 3) fail('Lütfen ad soyad girin.');
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) fail('Geçerli bir e-posta adresi girin.');
  if (input.password.length < 6) fail('Şifre en az 6 karakter olmalıdır.');
  assertLocation(input.district, input.neighborhood);
  if (db.users.some((u) => u.email === email)) fail('Bu e-posta adresiyle kayıtlı bir hesap var.');
}

export function register(db: DB, input: RegisterInput, passwordHash: string): User {
  validateRegister(db, input);
  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    passwordHash,
    role: 'user',
    active: true,
    bio: '',
    district: input.district,
    neighborhood: input.neighborhood.trim(),
    address: '',
    availability: '',
    createdAt: now(),
  };
  db.users.push(user);
  notify(db, user.id, 'LezzetHub’a hoş geldin! 🧡', 'Profilini tamamla, ilk ilanını ver ya da komşularının lezzetlerini keşfet.');
  return user;
}

export function login(db: DB, email: string, passwordHash: string): User {
  const user = db.users.find((u) => u.email === normalizeEmail(email));
  if (!user || user.passwordHash !== passwordHash) fail('E-posta veya şifre hatalı.');
  if (!user!.active) fail('Hesabınız pasif durumda. Lütfen destek ile iletişime geçin.');
  return user!;
}

export type ProfileInput = Pick<User, 'name' | 'bio' | 'district' | 'neighborhood' | 'address' | 'availability'> & {
  avatar?: string;
};

export function updateProfile(db: DB, userId: string, input: ProfileInput) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  if (input.name.trim().length < 3) fail('Lütfen ad soyad girin.');
  assertLocation(input.district, input.neighborhood);
  Object.assign(user, {
    ...input,
    name: input.name.trim(),
    neighborhood: input.neighborhood.trim(),
    bio: input.bio.trim(),
    address: input.address.trim(),
    availability: input.availability.trim(),
  });
  // İlanlar satıcının konumunu miras alır.
  for (const l of db.listings) {
    if (l.ownerId === userId) {
      l.district = user.district;
      l.neighborhood = user.neighborhood;
    }
  }
}

export function changePassword(db: DB, userId: string, currentHash: string, newHash: string, newLength: number) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  if (user.passwordHash !== currentHash) fail('Mevcut şifre hatalı.');
  if (newLength < 6) fail('Yeni şifre en az 6 karakter olmalıdır.');
  user.passwordHash = newHash;
}

/* ------------------------------ İlanlar ------------------------------ */

export interface ListingInput {
  title: string;
  description: string;
  price: number;
  category: CategoryKey;
  image?: string;
  prepTime: string;
  delivery: DeliveryMethod[];
  status: ListingStatus;
}

function validateListing(input: ListingInput) {
  if (input.title.trim().length < 3) fail('Başlık en az 3 karakter olmalıdır.');
  if (input.description.trim().length < 10) fail('Açıklama en az 10 karakter olmalıdır.');
  if (!Number.isFinite(input.price) || input.price <= 0) fail('Geçerli bir fiyat girin.');
  if (input.delivery.length === 0) fail('En az bir teslimat seçeneği seçmelisiniz.');
}

export function saveListing(db: DB, userId: string, input: ListingInput, listingId?: string): Listing {
  validateListing(input);
  const owner = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  if (listingId) {
    const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
    if (l.ownerId !== userId) fail('Bu ilanı düzenleme yetkiniz yok.');
    if (l.removedByAdmin && input.status === 'active') fail('Bu ilan yönetici tarafından yayından kaldırıldı.');
    Object.assign(l, { ...input, title: input.title.trim(), description: input.description.trim(), updatedAt: now() });
    return l;
  }
  const listing: Listing = {
    id: uid(),
    ownerId: userId,
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    prepTime: input.prepTime.trim(),
    district: owner.district,
    neighborhood: owner.neighborhood,
    createdAt: now(),
    updatedAt: now(),
  };
  db.listings.unshift(listing);
  return listing;
}

export function setListingStatus(db: DB, actor: User, listingId: string, status: ListingStatus) {
  const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
  if (actor.role === 'admin') {
    l.status = status;
    l.removedByAdmin = status === 'passive';
    if (status === 'passive') notify(db, l.ownerId, 'İlanın yayından kaldırıldı', `“${l.title}” ilanı yönetici tarafından yayından kaldırıldı.`);
  } else {
    if (l.ownerId !== actor.id) fail('Bu ilan üzerinde yetkiniz yok.');
    if (l.removedByAdmin && status === 'active') fail('Bu ilan yönetici tarafından yayından kaldırıldı.');
    l.status = status;
  }
  l.updatedAt = now();
}

export function deleteListing(db: DB, actor: User, listingId: string) {
  const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
  if (actor.role !== 'admin' && l.ownerId !== actor.id) fail('Bu ilanı silme yetkiniz yok.');
  const open = db.orders.some(
    (o) => o.listingId === listingId && ['seller_pending', 'approved', 'payment_pending', 'paid'].includes(o.status),
  );
  if (open) fail('Bu ilana ait devam eden siparişler var. Önce siparişleri sonuçlandırın veya ilanı pasifleştirin.');
  db.listings = db.listings.filter((x) => x.id !== listingId);
  if (actor.role === 'admin' && l.ownerId !== actor.id) {
    notify(db, l.ownerId, 'İlanın silindi', `“${l.title}” ilanı yönetici tarafından silindi.`);
  }
}

/* ------------------------------ Siparişler ------------------------------ */

export interface OrderInput {
  listingId: string;
  quantity: number;
  appointment: string;
  delivery: DeliveryMethod;
  address: string;
  note: string;
}

export function createOrder(db: DB, buyerId: string, input: OrderInput): Order {
  const buyer = getUser(db, buyerId) ?? fail('Kullanıcı bulunamadı.');
  const listing = getListing(db, input.listingId) ?? fail('İlan bulunamadı.');
  if (listing.status !== 'active') fail('Bu ilan şu anda yayında değil.');
  if (listing.ownerId === buyerId) fail('Kendi ilanınıza sipariş veremezsiniz.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) fail('Adet 1 ile 50 arasında olmalıdır.');
  if (!listing.delivery.includes(input.delivery)) fail('Bu ilan seçilen teslimat yöntemini desteklemiyor.');
  if (new Date(input.appointment).getTime() < Date.now()) fail('Randevu zamanı geçmiş bir zaman olamaz.');
  if (input.delivery === 'courier' && input.address.trim().length < 5) fail('Kurye teslimatı için adres girin.');

  const b = calcBreakdown(listing.price, input.quantity);
  const t = now();
  const order: Order = {
    id: uid(),
    code: 'LH-' + Math.floor(100000 + Math.random() * 900000),
    buyerId,
    sellerId: listing.ownerId,
    listingId: listing.id,
    listingTitle: listing.title,
    unitPrice: listing.price,
    quantity: input.quantity,
    appointment: input.appointment,
    delivery: input.delivery,
    address: input.delivery === 'courier' ? input.address.trim() : '',
    note: input.note.trim(),
    subtotal: b.subtotal,
    buyerFee: b.buyerFee,
    sellerFee: b.sellerFee,
    buyerTotal: b.buyerTotal,
    sellerNet: b.sellerNet,
    status: 'seller_pending',
    history: [{ status: 'seller_pending', at: t, by: buyerId }],
    createdAt: t,
    updatedAt: t,
  };
  db.orders.unshift(order);

  // Sipariş açılınca otomatik ilk mesaj.
  const lines = [
    `Merhaba! “${listing.title}” için randevulu sipariş oluşturdum 😊`,
    `🗓 ${appointmentText(order.appointment)}`,
    `🔢 Adet: ${order.quantity}`,
    `🚚 Teslimat: ${DELIVERY_LABEL[order.delivery]}`,
  ];
  if (order.note) lines.push(`📝 Not: ${order.note}`);
  db.messages.push({
    id: uid(),
    orderId: order.id,
    senderId: buyerId,
    receiverId: listing.ownerId,
    text: lines.join('\n'),
    createdAt: t,
    read: false,
  });
  notify(db, listing.ownerId, 'Yeni sipariş talebi 🛎', `${buyer.name}, “${listing.title}” için ${order.quantity} adet sipariş verdi.`, order.id);
  return order;
}

type OrderAction = 'approve' | 'reject' | 'pay' | 'cancel' | 'complete' | 'paymentApprove' | 'paymentReject';

/** Kullanıcının bu sipariş üzerinde yapabileceği işlemler. */
export function availableActions(order: Order, user: User): OrderAction[] {
  const isBuyer = order.buyerId === user.id;
  const isSeller = order.sellerId === user.id;
  const isAdmin = user.role === 'admin';
  const a: OrderAction[] = [];
  switch (order.status) {
    case 'seller_pending':
      if (isSeller) a.push('approve', 'reject');
      if (isBuyer) a.push('cancel');
      break;
    case 'approved':
      if (isBuyer) a.push('pay', 'cancel');
      if (isSeller) a.push('cancel');
      break;
    case 'payment_pending':
      if (isAdmin) a.push('paymentApprove', 'paymentReject');
      break;
    case 'paid':
      if (isBuyer || isSeller) a.push('complete');
      if (isAdmin) a.push('cancel');
      break;
  }
  return a;
}

function transition(db: DB, order: Order, to: OrderStatus, by: string, note?: string) {
  order.status = to;
  order.statusNote = note;
  order.updatedAt = now();
  order.history.push({ status: to, at: order.updatedAt, by, note });
  systemMessage(db, order, `Sipariş durumu: ${STATUS_META[to].label}${note ? ` — ${note}` : ''}`);
}

export function orderAction(db: DB, actor: User, orderId: string, action: OrderAction, note?: string) {
  const order = getOrder(db, orderId) ?? fail('Sipariş bulunamadı.');
  if (!availableActions(order, actor).includes(action)) fail('Bu işlem şu anda yapılamaz.');
  const title = `“${order.listingTitle}” (${order.code})`;

  switch (action) {
    case 'approve':
      transition(db, order, 'approved', actor.id);
      notify(db, order.buyerId, 'Siparişin onaylandı ✅', `${title} satıcı tarafından onaylandı. Ödeme adımına geçebilirsin.`, order.id);
      break;
    case 'reject':
      transition(db, order, 'rejected', actor.id, note || 'Satıcı siparişi reddetti');
      notify(db, order.buyerId, 'Sipariş reddedildi', `${title} satıcı tarafından reddedildi.`, order.id);
      break;
    case 'cancel': {
      transition(db, order, 'cancelled', actor.id, note || 'Sipariş iptal edildi');
      const others = [order.buyerId, order.sellerId].filter((id) => id !== actor.id);
      for (const id of others) notify(db, id, 'Sipariş iptal edildi', `${title} iptal edildi.`, order.id);
      db.payments.filter((p) => p.orderId === order.id && p.status === 'pending').forEach((p) => (p.status = 'rejected'));
      break;
    }
    case 'pay':
      transition(db, order, 'payment_pending', actor.id);
      db.payments.unshift({ id: uid(), orderId: order.id, amount: order.buyerTotal, status: 'pending', createdAt: now() });
      notify(db, order.sellerId, 'Ödeme başlatıldı 💳', `${title} için alıcı ödemeyi başlattı, admin onayı bekleniyor.`, order.id);
      for (const admin of db.users.filter((u) => u.role === 'admin')) {
        notify(db, admin.id, 'Onay bekleyen ödeme', `${title} — ${tl(order.buyerTotal)}`, order.id);
      }
      break;
    case 'paymentApprove':
    case 'paymentReject': {
      const approved = action === 'paymentApprove';
      const payment = db.payments.find((p) => p.orderId === order.id && p.status === 'pending');
      if (payment) {
        payment.status = approved ? 'approved' : 'rejected';
        payment.adminId = actor.id;
        payment.adminNote = note;
        payment.decidedAt = now();
      }
      if (approved) {
        transition(db, order, 'paid', actor.id);
        notify(db, order.buyerId, 'Ödemen onaylandı 🎉', `${title} için ödemen onaylandı. Randevu zamanında teslimat yapılacak.`, order.id);
        notify(db, order.sellerId, 'Ödeme onaylandı 🎉', `${title} için ödeme onaylandı. Hazırlığa başlayabilirsin.`, order.id);
      } else {
        transition(db, order, 'rejected', actor.id, note || 'Ödeme admin tarafından reddedildi');
        notify(db, order.buyerId, 'Ödeme reddedildi', `${title} için ödeme reddedildi.`, order.id);
        notify(db, order.sellerId, 'Ödeme reddedildi', `${title} için ödeme reddedildi.`, order.id);
      }
      break;
    }
    case 'complete': {
      transition(db, order, 'completed', actor.id);
      const other = actor.id === order.buyerId ? order.sellerId : order.buyerId;
      notify(db, other, 'Sipariş tamamlandı 🧡', `${title} tamamlandı olarak işaretlendi. Afiyet olsun!`, order.id);
      break;
    }
  }
}

/* ------------------------------ Mesajlar ------------------------------ */

export function sendMessage(db: DB, senderId: string, orderId: string, text: string) {
  const order = getOrder(db, orderId) ?? fail('Sipariş bulunamadı.');
  if (senderId !== order.buyerId && senderId !== order.sellerId) fail('Bu sohbete mesaj gönderemezsiniz.');
  const body = text.trim();
  if (!body) return;
  const receiverId = senderId === order.buyerId ? order.sellerId : order.buyerId;
  db.messages.push({ id: uid(), orderId, senderId, receiverId, text: body, createdAt: now(), read: false });
  const sender = getUser(db, senderId);
  notify(db, receiverId, `${MESSAGE_PREFIX} ${sender?.name ?? 'Yeni mesaj'}`, body.length > 80 ? body.slice(0, 80) + '…' : body, orderId);
}

export function markChatRead(db: DB, userId: string, orderId: string) {
  let changed = false;
  for (const m of db.messages) {
    if (m.orderId === orderId && m.receiverId === userId && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  // Aynı sohbetin mesaj bildirimleri de okunmuş sayılır.
  for (const n of db.notifications) {
    if (n.userId === userId && n.orderId === orderId && n.title.startsWith(MESSAGE_PREFIX) && !n.read) {
      n.read = true;
      changed = true;
    }
  }
  return changed;
}

/* ------------------------------ Admin ------------------------------ */

function assertAdmin(actor: User) {
  if (actor.role !== 'admin') fail('Bu işlem için yönetici yetkisi gerekiyor.');
}

export function setUserActive(db: DB, actor: User, userId: string, active: boolean) {
  assertAdmin(actor);
  if (actor.id === userId) fail('Kendi hesabınızı pasifleştiremezsiniz.');
  const u = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  u.active = active;
  if (!active) {
    db.listings.filter((l) => l.ownerId === userId).forEach((l) => (l.status = 'passive'));
  }
}

export function setUserRole(db: DB, actor: User, userId: string, role: User['role']) {
  assertAdmin(actor);
  if (actor.id === userId) fail('Kendi yetkinizi değiştiremezsiniz.');
  const u = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  u.role = role;
}

export function deleteUser(db: DB, actor: User, userId: string) {
  assertAdmin(actor);
  if (actor.id === userId) fail('Kendi hesabınızı silemezsiniz.');
  const open = db.orders.some(
    (o) => (o.buyerId === userId || o.sellerId === userId) && ['seller_pending', 'approved', 'payment_pending', 'paid'].includes(o.status),
  );
  if (open) fail('Kullanıcının devam eden siparişleri var. Önce siparişleri sonuçlandırın veya kullanıcıyı pasifleştirin.');
  db.users = db.users.filter((u) => u.id !== userId);
  db.listings = db.listings.filter((l) => l.ownerId !== userId);
  db.notifications = db.notifications.filter((n) => n.userId !== userId);
}

export function adminStats(db: DB) {
  const counted = db.orders.filter((o) => o.status === 'paid' || o.status === 'completed');
  return {
    users: db.users.length,
    activeUsers: db.users.filter((u) => u.active).length,
    listings: db.listings.length,
    activeListings: db.listings.filter((l) => l.status === 'active').length,
    orders: db.orders.length,
    pendingPayments: db.payments.filter((p) => p.status === 'pending').length,
    completedOrders: db.orders.filter((o) => o.status === 'completed').length,
    grossVolume: counted.reduce((s, o) => s + o.buyerTotal, 0),
    commission: counted.reduce((s, o) => s + o.buyerFee + o.sellerFee, 0),
    buyerFees: counted.reduce((s, o) => s + o.buyerFee, 0),
    sellerFees: counted.reduce((s, o) => s + o.sellerFee, 0),
  };
}
