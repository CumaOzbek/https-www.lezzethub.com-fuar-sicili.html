// İş kuralları. Tüm fonksiyonlar bir DB taslağı üzerinde çalışır.
// Cihaz içi (demo) modda doğrudan kullanılır; canlı modda aynı kurallar Supabase'deki
// sunucu fonksiyonlarında (supabase/schema.sql) uygulanır. Arayüz availableActions'ı her iki modda da kullanır.
import { calcBreakdown } from './commission';
import { DELIVERY_LABEL, STATUS_META, appointmentText, tl } from './format';
import { isValidDistrict, isValidProvince } from './locations';
import {
  ALLERGENS,
  MAX_LISTING_PHOTOS,
  type AllergenKey,
  type CategoryKey,
  type CourierProfile,
  type DB,
  type DeliveryMethod,
  type DocumentType,
  type LicenseClass,
  type Listing,
  type ListingStatus,
  type Order,
  type OrderStatus,
  type ReportReason,
  type ShippingPayer,
  type User,
  type Verification,
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

/* ------------------------------ Doğrulama yardımcıları ------------------------------ */

/** Türkiye cep telefonu: 05XXXXXXXXX biçimine getirir; geçersizse null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = '0' + d.slice(2);
  if (d.length === 10 && d.startsWith('5')) d = '0' + d;
  return /^05\d{9}$/.test(d) ? d : null;
}

/** TR IBAN (TR + 24 hane) biçim ve mod-97 kontrolü. Boşluksuz büyük harfli IBAN döner; geçersizse null. */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/\s+/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1 ? iban : null;
}

export const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

/** Kart numarası Luhn kontrolü (yalnızca demo ödeme ekranında). */
export function luhnValid(card: string) {
  const d = card.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function assertLocation(province: string, district: string, neighborhood: string) {
  if (!isValidProvince(province)) fail('Lütfen listeden bir il seçin.');
  if (!isValidDistrict(province, district)) fail('Lütfen seçtiğin ile ait bir ilçe seçin.');
  if (!neighborhood.trim()) fail('Mahalle zorunludur.');
}

export const getUser = (db: DB, id: string) => db.users.find((u) => u.id === id);
export const getListing = (db: DB, id: string) => db.listings.find((l) => l.id === id);
export const getOrder = (db: DB, id: string) => db.orders.find((o) => o.id === id);

const OPEN_STATUSES: OrderStatus[] = ['seller_pending', 'approved', 'paid'];

/** İki kullanıcıdan biri diğerini engellediyse true. */
export const isBlockedBetween = (db: DB, a: string, b: string) =>
  db.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));

function notify(db: DB, userId: string, title: string, body: string, orderId?: string) {
  db.notifications.unshift({ id: uid(), userId, title, body, orderId, createdAt: now(), read: false });
}

function notifyAdmins(db: DB, title: string, body: string, orderId?: string) {
  for (const a of db.users.filter((u) => u.role === 'admin' && u.active)) notify(db, a.id, title, body, orderId);
}

function systemMessage(db: DB, order: Order, text: string) {
  db.messages.push({ id: uid(), orderId: order.id, senderId: 'system', receiverId: '', text, createdAt: now(), read: true });
}

/* ------------------------------ Kimlik ------------------------------ */

export type AccountIntent = 'buyer' | 'seller' | 'courier';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  province: string;
  district: string;
  neighborhood: string;
  /** Kullanım koşulları ve KVKK aydınlatma metni. */
  acceptedTerms: boolean;
  /** KVKK açık rıza. */
  kvkkConsent: boolean;
  intent: AccountIntent;
}

/** Sunucuya gitmeden yapılabilen kayıt doğrulamaları (her iki modda da kullanılır). */
export function validateRegisterFields(input: RegisterInput) {
  if (input.name.trim().length < 3) fail('Lütfen ad soyad girin.');
  if (!isEmail(normalizeEmail(input.email))) fail('Geçerli bir e-posta adresi girin.');
  if (input.password.length < 6) fail('Şifre en az 6 karakter olmalıdır.');
  assertLocation(input.province, input.district, input.neighborhood);
  if (!input.acceptedTerms) fail('Devam etmek için Kullanım Koşulları’nı ve KVKK Aydınlatma Metni’ni kabul etmelisin.');
  if (!input.kvkkConsent) fail('Devam etmek için kişisel verilerinin işlenmesine ilişkin açık rıza vermelisin.');
}

export function validateRegister(db: DB, input: RegisterInput) {
  validateRegisterFields(input);
  if (db.users.some((u) => u.email === normalizeEmail(input.email))) fail('Bu e-posta adresiyle kayıtlı bir hesap var.');
}

export function register(db: DB, input: RegisterInput, passwordHash: string): User {
  validateRegister(db, input);
  const t = now();
  const user: User = {
    id: uid(),
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    passwordHash,
    role: 'user',
    active: true,
    bio: '',
    province: input.province,
    district: input.district,
    neighborhood: input.neighborhood.trim(),
    address: '',
    phone: '',
    availability: '',
    sellerStatus: 'none',
    courierStatus: 'none',
    acceptedTermsAt: t,
    kvkkConsentAt: t,
    createdAt: t,
  };
  db.users.push(user);
  const next =
    input.intent === 'seller'
      ? 'Satış yapmak için hijyen belgeni yükleyerek satıcı başvurunu tamamla.'
      : input.intent === 'courier'
        ? 'Kurye olarak görünmek için ehliyet bilgilerini yükleyerek başvurunu tamamla.'
        : 'Profilini tamamla ve komşularının lezzetlerini keşfet.';
  notify(db, user.id, 'LezzetHub’a hoş geldin! 🧡', next);
  return user;
}

export function login(db: DB, email: string, passwordHash: string): User {
  const user = db.users.find((u) => u.email === normalizeEmail(email));
  if (!user || user.passwordHash !== passwordHash) fail('E-posta veya şifre hatalı.');
  if (!user!.active) fail('Hesabınız pasif durumda. Lütfen destek ile iletişime geçin.');
  return user!;
}

export type ProfileInput = Pick<User, 'name' | 'bio' | 'province' | 'district' | 'neighborhood' | 'address' | 'phone' | 'availability'> & {
  avatar?: string;
};

export function validateProfile(input: ProfileInput) {
  if (input.name.trim().length < 3) fail('Lütfen ad soyad girin.');
  assertLocation(input.province, input.district, input.neighborhood);
  if (input.phone.trim() && !normalizePhone(input.phone)) fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.');
}

export function updateProfile(db: DB, userId: string, input: ProfileInput) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  validateProfile(input);
  Object.assign(user, {
    ...input,
    name: input.name.trim(),
    neighborhood: input.neighborhood.trim(),
    bio: input.bio.trim(),
    address: input.address.trim(),
    phone: input.phone.trim() ? normalizePhone(input.phone)! : '',
    availability: input.availability.trim(),
  });
  // İlanlar satıcının konumunu miras alır.
  for (const l of db.listings) {
    if (l.ownerId === userId) Object.assign(l, { province: user.province, district: user.district, neighborhood: user.neighborhood });
  }
}

export function changePassword(db: DB, userId: string, currentHash: string, newHash: string, newLength: number) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  if (user.passwordHash !== currentHash) fail('Mevcut şifre hatalı.');
  if (newLength < 6) fail('Yeni şifre en az 6 karakter olmalıdır.');
  user.passwordHash = newHash;
}

/** Kullanıcının kendi hesabını silmesi (App Store / Google Play zorunluluğu). */
export function deleteAccount(db: DB, userId: string) {
  const open = db.orders.some((o) => (o.buyerId === userId || o.sellerId === userId) && OPEN_STATUSES.includes(o.status));
  if (open) fail('Devam eden siparişlerin var. Hesabını silmeden önce siparişlerini tamamla veya iptal et.');
  removeUserData(db, userId);
}

function removeUserData(db: DB, userId: string) {
  db.users = db.users.filter((u) => u.id !== userId);
  db.listings = db.listings.filter((l) => l.ownerId !== userId);
  db.notifications = db.notifications.filter((n) => n.userId !== userId);
  db.blocks = db.blocks.filter((b) => b.blockerId !== userId && b.blockedId !== userId);
  db.reports = db.reports.filter((r) => r.reporterId !== userId);
  db.verifications = db.verifications.filter((v) => v.userId !== userId);
  db.couriers = db.couriers.filter((c) => c.userId !== userId);
}

/* ------------------------------ Satıcı ve kurye başvuruları ------------------------------ */

/** Gıda işletmesi kayıt numarası: harf, rakam, - / . ve boşluk; 5–40 karakter (ör. TR-34-K-012345). */
export const isFoodRegistrationNo = (v: string) => /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü\-/. ]{5,40}$/.test(v.trim()) && /\d{3,}/.test(v);

export interface SellerApplicationInput {
  docUri: string;
  docType: DocumentType;
  /** e-Devlet belge doğrulama barkod numarası. */
  barcode: string;
  /** Tarım ve Orman Bakanlığı gıda işletmesi kayıt numarası. */
  foodRegistrationNo: string;
  iban: string;
  ibanHolder: string;
  /** Sağlık Bakanlığı ve Tarım ve Orman Bakanlığı mevzuatı, risk ve sorumluluk beyanı. */
  acceptDeclaration: boolean;
  /** Belgelerin işlenmesine açık rıza. */
  acceptDocumentConsent: boolean;
}

export function validateSellerApplication(input: SellerApplicationInput) {
  if (!input.docUri) fail('E-Devlet onaylı hijyen belgeni yüklemelisin.');
  if (input.barcode.replace(/\s/g, '').length < 8) fail('Belgenin e-Devlet doğrulama (barkod) numarasını girin.');
  if (!isFoodRegistrationNo(input.foodRegistrationNo)) fail('Gıda işletmesi kayıt numaranı girin (İl/İlçe Tarım ve Orman Müdürlüğü’nden alınır).');
  if (!normalizeIban(input.iban)) fail('Geçerli bir TR IBAN girin (TR ile başlayan 26 karakter).');
  if (input.ibanHolder.trim().length < 3) fail('IBAN sahibinin adını soyadını girin.');
  if (!input.acceptDeclaration) fail('Satış yapabilmek için mevzuat ve sorumluluk beyanını onaylamalısın.');
  if (!input.acceptDocumentConsent) fail('Belgelerinin işlenmesine ilişkin açık rızayı onaylamalısın.');
}

export function submitSellerApplication(db: DB, userId: string, input: SellerApplicationInput) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  validateSellerApplication(input);
  if (user.sellerStatus === 'approved') fail('Satıcı hesabın zaten onaylı.');
  const t = now();
  db.verifications = db.verifications.filter((v) => !(v.userId === userId && v.kind === 'seller'));
  db.verifications.unshift({
    id: uid(),
    userId,
    kind: 'seller',
    status: 'pending',
    docUri: input.docUri,
    docType: input.docType,
    docNumber: input.barcode.trim(),
    foodRegistrationNo: input.foodRegistrationNo.trim().toLocaleUpperCase('tr-TR'),
    iban: normalizeIban(input.iban)!,
    ibanHolder: input.ibanHolder.trim(),
    declarationAt: t,
    documentConsentAt: t,
    submittedAt: t,
  });
  user.sellerStatus = 'pending';
  notifyAdmins(db, 'Yeni satıcı başvurusu 📄', `${user.name} hijyen belgesini yükledi; onay bekliyor.`);
}

export interface CourierApplicationInput {
  licenseClass: LicenseClass;
  licenseNumber: string;
  docUri: string;
  docType: DocumentType;
  phone: string;
  serviceProvince: string;
  serviceDistricts: string[];
  /** Telefonun kurye arayan kullanıcılarla paylaşılmasına ve belgelerin işlenmesine açık rıza. */
  acceptDocumentConsent: boolean;
  /** Trafik mevzuatına uyum ve teslimat sorumluluğu beyanı. */
  acceptDeclaration: boolean;
}

export function validateCourierApplication(input: CourierApplicationInput) {
  if (input.licenseClass !== 'A2' && input.licenseClass !== 'B') fail('Kurye olabilmek için A2 veya B sınıfı ehliyet gereklidir.');
  if (input.licenseNumber.replace(/\s/g, '').length < 5) fail('Ehliyet belge numaranı girin.');
  if (!input.docUri) fail('Ehliyetinin fotoğrafını yüklemelisin.');
  if (!normalizePhone(input.phone)) fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.');
  if (!isValidProvince(input.serviceProvince)) fail('Hizmet vereceğin ili seçin.');
  if (input.serviceDistricts.length === 0) fail('Hizmet vereceğin en az bir ilçe seçin.');
  if (input.serviceDistricts.some((d) => !isValidDistrict(input.serviceProvince, d))) fail('Seçilen ilçeler hizmet iline ait olmalı.');
  if (!input.acceptDocumentConsent) fail('Belgelerinin işlenmesine ve telefonunun paylaşılmasına ilişkin açık rızayı onaylamalısın.');
  if (!input.acceptDeclaration) fail('Kurye sorumluluk beyanını onaylamalısın.');
}

export function submitCourierApplication(db: DB, userId: string, input: CourierApplicationInput) {
  const user = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  validateCourierApplication(input);
  if (user.courierStatus === 'approved') fail('Kurye hesabın zaten onaylı.');
  const t = now();
  const phone = normalizePhone(input.phone)!;
  db.verifications = db.verifications.filter((v) => !(v.userId === userId && v.kind === 'courier'));
  db.verifications.unshift({
    id: uid(),
    userId,
    kind: 'courier',
    status: 'pending',
    docUri: input.docUri,
    docType: input.docType,
    docNumber: input.licenseNumber.trim(),
    licenseClass: input.licenseClass,
    declarationAt: t,
    documentConsentAt: t,
    submittedAt: t,
  });
  db.couriers = db.couriers.filter((c) => c.userId !== userId);
  db.couriers.push({
    userId,
    licenseClass: input.licenseClass,
    vehicle: input.licenseClass === 'A2' ? 'motorcycle' : 'car',
    phone,
    serviceProvince: input.serviceProvince,
    serviceDistricts: [...new Set(input.serviceDistricts)],
    available: true,
    updatedAt: t,
  });
  user.courierStatus = 'pending';
  if (!user.phone) user.phone = phone;
  notifyAdmins(db, 'Yeni kurye başvurusu 🛵', `${user.name} ${input.licenseClass} sınıfı ehliyetini yükledi; onay bekliyor.`);
}

export type CourierUpdate = Partial<Pick<CourierProfile, 'available' | 'serviceDistricts' | 'phone'>>;

export function updateCourierProfile(db: DB, userId: string, patch: CourierUpdate) {
  const c = db.couriers.find((x) => x.userId === userId) ?? fail('Kurye profilin bulunamadı.');
  if (patch.phone !== undefined) {
    const p = normalizePhone(patch.phone) ?? fail('Telefon numarasını 05XX XXX XX XX biçiminde girin.');
    c.phone = p;
  }
  if (patch.serviceDistricts !== undefined) {
    if (patch.serviceDistricts.length === 0) fail('En az bir ilçe seçin.');
    if (patch.serviceDistricts.some((d) => !isValidDistrict(c.serviceProvince, d))) fail('Seçilen ilçeler hizmet iline ait olmalı.');
    c.serviceDistricts = [...new Set(patch.serviceDistricts)];
  }
  if (patch.available !== undefined) c.available = patch.available;
  c.updatedAt = now();
}

export function reviewVerification(db: DB, actor: User, verificationId: string, approve: boolean, note?: string) {
  assertAdmin(actor);
  const v = db.verifications.find((x) => x.id === verificationId) ?? fail('Başvuru bulunamadı.');
  if (v.status !== 'pending') fail('Bu başvuru zaten sonuçlandırıldı.');
  if (!approve && !note?.trim()) fail('Reddetme gerekçesini yazmalısın; kullanıcıya iletilecek.');
  const user = getUser(db, v.userId) ?? fail('Kullanıcı bulunamadı.');
  v.status = approve ? 'approved' : 'rejected';
  v.adminNote = note?.trim() || undefined;
  v.reviewedAt = now();
  if (v.kind === 'seller') {
    user.sellerStatus = v.status;
    if (approve) user.foodRegistrationNo = v.foodRegistrationNo;
  }
  else user.courierStatus = v.status;
  const what = v.kind === 'seller' ? 'Satıcı' : 'Kurye';
  notify(
    db,
    user.id,
    approve ? `${what} başvurun onaylandı ✅` : `${what} başvurun reddedildi`,
    approve
      ? v.kind === 'seller'
        ? 'Artık ilan verip satış yapabilirsin.'
        : 'Artık yakınındaki satıcı ve alıcılar seni kurye listesinde görebilir.'
      : `Gerekçe: ${v.adminNote}. Belgeni düzeltip yeniden başvurabilirsin.`,
  );
}

/** Kullanıcının ilanda veya siparişte satıcı olarak işlem yapabilmesi için onaylı olması gerekir. */
export const canSell = (u: Pick<User, 'sellerStatus'> | null | undefined) => u?.sellerStatus === 'approved';

/** Bir konumda hizmet veren onaylı kuryeler: aynı ilçeye hizmet verenler önce, müsait olanlar önce. */
export function couriersNear(db: DB, province: string, district: string) {
  const users = new Map(db.users.map((u) => [u.id, u]));
  return db.couriers
    .filter((c) => {
      const u = users.get(c.userId);
      return u?.active && u.courierStatus === 'approved' && c.serviceProvince === province;
    })
    .map((c) => ({ courier: c, user: users.get(c.userId)!, servesDistrict: c.serviceDistricts.includes(district) }))
    .sort((a, b) => Number(b.servesDistrict) - Number(a.servesDistrict) || Number(b.courier.available) - Number(a.courier.available));
}

/* ------------------------------ İlanlar ------------------------------ */

export interface ListingInput {
  title: string;
  description: string;
  price: number;
  category: CategoryKey;
  images: string[];
  prepTime: string;
  delivery: DeliveryMethod[];
  shippingPayer: ShippingPayer;
  allergens: AllergenKey[];
  /** Hiçbir alerjen içermediğinin açık beyanı (allergens boşsa zorunlu). */
  noAllergens: boolean;
  shelfLife: string;
  shelfStable: boolean;
  /** Yasaklı / yüksek riskli ürün içermediğinin onayı (her kayıtta zorunlu). */
  safetyConfirmed: boolean;
  status: ListingStatus;
}

const ALLERGEN_KEYS = new Set<string>(ALLERGENS.map((a) => a.key));

export function validateListing(input: ListingInput) {
  if (input.title.trim().length < 3) fail('Başlık en az 3 karakter olmalıdır.');
  if (input.description.trim().length < 10) fail('Açıklama en az 10 karakter olmalıdır.');
  if (!Number.isFinite(input.price) || input.price <= 0) fail('Geçerli bir fiyat girin.');
  if (input.price > 100000) fail('Fiyat çok yüksek görünüyor, lütfen kontrol et.');
  if (input.delivery.length === 0) fail('En az bir teslimat seçeneği seçmelisiniz.');
  if (input.shippingPayer !== 'buyer' && input.shippingPayer !== 'seller') fail('Kargo/kurye ücretinin kime ait olduğunu seçin.');
  if (input.images.length > MAX_LISTING_PHOTOS) fail(`En fazla ${MAX_LISTING_PHOTOS} fotoğraf ekleyebilirsin.`);
  if (input.allergens.some((a) => !ALLERGEN_KEYS.has(a))) fail('Geçersiz alerjen seçimi.');
  if (input.allergens.length === 0 && !input.noAllergens) fail('Alerjenleri işaretle ya da ürünün alerjen içermediğini beyan et.');
  if (input.allergens.length > 0 && input.noAllergens) fail('Alerjen seçtiysen “alerjen içermez” beyanını kaldır.');
  if (input.shelfLife.trim().length < 3) fail('Son tüketim ve saklama bilgisini yaz (ör. “Buzdolabında 2 gün”).');
  if (input.delivery.includes('cargo') && !input.shelfStable) fail('Kargo yalnızca oda sıcaklığında dayanıklı, soğuk zincir gerektirmeyen ürünlerde seçilebilir.');
  if (!input.safetyConfirmed) fail('Ürünün yasaklı / yüksek riskli gıdalardan olmadığını onaylamalısın.');
}

export function saveListing(db: DB, userId: string, input: ListingInput, listingId?: string): Listing {
  validateListing(input);
  const owner = getUser(db, userId) ?? fail('Kullanıcı bulunamadı.');
  if (!canSell(owner)) fail('İlan verebilmek için satıcı başvurunun (hijyen belgesi) onaylanması gerekir.');
  const { noAllergens: _n, safetyConfirmed: _s, ...rest } = input;
  const clean = {
    ...rest,
    title: input.title.trim(),
    description: input.description.trim(),
    prepTime: input.prepTime.trim(),
    shelfLife: input.shelfLife.trim(),
    allergens: [...new Set(input.allergens)],
    safetyConfirmedAt: now(),
  };
  if (listingId) {
    const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
    if (l.ownerId !== userId) fail('Bu ilanı düzenleme yetkiniz yok.');
    if (l.underReview && input.status === 'active') fail(UNDER_REVIEW_MSG);
    if (l.removedByAdmin && input.status === 'active') fail('Bu ilan yönetici tarafından yayından kaldırıldı.');
    Object.assign(l, { ...clean, updatedAt: now() });
    return l;
  }
  const listing: Listing = {
    id: uid(),
    ownerId: userId,
    ...clean,
    province: owner.province,
    district: owner.district,
    neighborhood: owner.neighborhood,
    createdAt: now(),
    updatedAt: now(),
  };
  db.listings.unshift(listing);
  return listing;
}

const UNDER_REVIEW_MSG = 'Bu ilan hijyen şikayeti nedeniyle incelemede; inceleme bitene kadar yayına alınamaz.';

export function setListingStatus(db: DB, actor: User, listingId: string, status: ListingStatus) {
  const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
  if (actor.role === 'admin') {
    l.status = status;
    l.removedByAdmin = status === 'passive';
    if (status === 'active') l.underReview = false;
    if (status === 'passive' && l.ownerId !== actor.id) notify(db, l.ownerId, 'İlanın yayından kaldırıldı', `“${l.title}” ilanı yönetici tarafından yayından kaldırıldı.`);
  } else {
    if (l.ownerId !== actor.id) fail('Bu ilan üzerinde yetkiniz yok.');
    if (l.underReview && status === 'active') fail(UNDER_REVIEW_MSG);
    if (l.removedByAdmin && status === 'active') fail('Bu ilan yönetici tarafından yayından kaldırıldı.');
    if (status === 'active' && !canSell(actor)) fail('İlanı yayına almak için satıcı başvurunun onaylı olması gerekir.');
    l.status = status;
  }
  l.updatedAt = now();
}

export function deleteListing(db: DB, actor: User, listingId: string) {
  const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
  if (actor.role !== 'admin' && l.ownerId !== actor.id) fail('Bu ilanı silme yetkiniz yok.');
  const open = db.orders.some((o) => o.listingId === listingId && OPEN_STATUSES.includes(o.status));
  if (open) fail('Bu ilana ait devam eden siparişler var. Önce siparişleri sonuçlandırın veya ilanı pasifleştirin.');
  db.listings = db.listings.filter((x) => x.id !== listingId);
  if (actor.role === 'admin' && l.ownerId !== actor.id) notify(db, l.ownerId, 'İlanın silindi', `“${l.title}” ilanı yönetici tarafından silindi.`);
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

/** Sipariş açıldığında alıcı adına gönderilen otomatik ilk mesaj (randevu cihazın yerel saatiyle yazılır). */
export function firstOrderMessage(listingTitle: string, input: Pick<OrderInput, 'appointment' | 'quantity' | 'delivery' | 'note'>) {
  const lines = [
    `Merhaba! “${listingTitle}” için randevulu sipariş oluşturdum 😊`,
    `🗓 ${appointmentText(input.appointment)}`,
    `🔢 Adet: ${input.quantity}`,
    `🚚 Teslimat: ${DELIVERY_LABEL[input.delivery]}`,
  ];
  if (input.note.trim()) lines.push(`📝 Not: ${input.note.trim()}`);
  return lines.join('\n');
}

export function createOrder(db: DB, buyerId: string, input: OrderInput): Order {
  const buyer = getUser(db, buyerId) ?? fail('Kullanıcı bulunamadı.');
  const listing = getListing(db, input.listingId) ?? fail('İlan bulunamadı.');
  const seller = getUser(db, listing.ownerId);
  if (listing.status !== 'active' || !seller?.active || !canSell(seller)) fail('Bu ilan şu anda yayında değil.');
  if (listing.ownerId === buyerId) fail('Kendi ilanınıza sipariş veremezsiniz.');
  if (isBlockedBetween(db, buyerId, listing.ownerId)) fail('Bu satıcıyla işlem yapamazsınız.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) fail('Adet 1 ile 50 arasında olmalıdır.');
  if (!listing.delivery.includes(input.delivery)) fail('Bu ilan seçilen teslimat yöntemini desteklemiyor.');
  if (new Date(input.appointment).getTime() < Date.now()) fail('Randevu zamanı geçmiş bir zaman olamaz.');
  if (input.delivery !== 'pickup' && input.address.trim().length < 10) {
    fail(input.delivery === 'cargo' ? 'Kargo için açık adresini (mahalle, sokak, no, ilçe/il) girin.' : 'Kurye teslimatı için adres girin.');
  }

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
    shippingPayer: listing.shippingPayer,
    address: input.delivery === 'pickup' ? '' : input.address.trim(),
    note: input.note.trim(),
    subtotal: b.subtotal,
    buyerFee: b.buyerFee,
    sellerFee: b.sellerFee,
    buyerTotal: b.buyerTotal,
    sellerNet: b.sellerNet,
    status: 'seller_pending',
    payoutStatus: 'pending',
    history: [{ status: 'seller_pending', at: t, by: buyerId }],
    createdAt: t,
    updatedAt: t,
  };
  db.orders.unshift(order);
  db.messages.push({
    id: uid(),
    orderId: order.id,
    senderId: buyerId,
    receiverId: listing.ownerId,
    text: firstOrderMessage(listing.title, input),
    createdAt: t,
    read: false,
  });
  notify(db, listing.ownerId, 'Yeni sipariş talebi 🛎', `${buyer.name}, “${listing.title}” için ${order.quantity} adet sipariş verdi.`, order.id);
  return order;
}

export type OrderAction = 'approve' | 'reject' | 'cancel' | 'complete' | 'refund';

/**
 * Kullanıcının bu sipariş üzerinde yapabileceği işlemler.
 * Ödeme ayrı bir akıştır (canPay): alıcı "approved" durumunda online öder.
 */
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
      if (isBuyer || isSeller) a.push('cancel');
      break;
    case 'paid':
      if (isBuyer || isSeller) a.push('complete');
      if (isAdmin) a.push('refund');
      break;
  }
  return a;
}

export const canPay = (order: Order, user: User | null | undefined) => !!user && order.status === 'approved' && order.buyerId === user.id;

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
      if (order.delivery === 'pickup') order.pickupAddress = actor.address || `${actor.neighborhood}, ${actor.district}/${actor.province}`;
      transition(db, order, 'approved', actor.id);
      notify(db, order.buyerId, 'Siparişin onaylandı ✅', `${title} satıcı tarafından onaylandı. Online ödemeyi yaparak siparişini kesinleştir.`, order.id);
      break;
    case 'reject':
      transition(db, order, 'rejected', actor.id, note || 'Satıcı siparişi reddetti');
      notify(db, order.buyerId, 'Sipariş reddedildi', `${title} satıcı tarafından reddedildi.`, order.id);
      break;
    case 'cancel': {
      transition(db, order, 'cancelled', actor.id, note || 'Sipariş iptal edildi');
      for (const id of [order.buyerId, order.sellerId].filter((x) => x !== actor.id)) notify(db, id, 'Sipariş iptal edildi', `${title} iptal edildi.`, order.id);
      db.payments.filter((p) => p.orderId === order.id && p.status === 'pending').forEach((p) => (p.status = 'failed'));
      break;
    }
    case 'refund': {
      const p = db.payments.find((x) => x.orderId === order.id && x.status === 'succeeded') ?? fail('İade edilecek başarılı ödeme bulunamadı.');
      p.status = 'refunded';
      p.refundedAt = now();
      p.refundNote = note || 'Yönetici tarafından iade edildi';
      transition(db, order, 'cancelled', actor.id, `İade edildi${note ? ` — ${note}` : ''}`);
      notify(db, order.buyerId, 'Ödemen iade edildi', `${title} iptal edildi ve ${tl(p.amount)} kartına iade edildi.`, order.id);
      notify(db, order.sellerId, 'Sipariş iptal ve iade edildi', `${title} yönetici tarafından iptal edilip iade edildi.`, order.id);
      break;
    }
    case 'complete': {
      transition(db, order, 'completed', actor.id);
      notify(db, actor.id === order.buyerId ? order.sellerId : order.buyerId, 'Sipariş tamamlandı 🧡', `${title} tamamlandı olarak işaretlendi. Afiyet olsun!`, order.id);
      break;
    }
  }
}

/** Satıcı kargo firması ve takip numarasını girer (kargo teslimatında, ödeme sonrası). */
export function setShipment(db: DB, actor: User, orderId: string, company: string, trackingCode: string) {
  const order = getOrder(db, orderId) ?? fail('Sipariş bulunamadı.');
  if (order.sellerId !== actor.id) fail('Kargo bilgisini yalnızca satıcı girebilir.');
  if (order.delivery !== 'cargo') fail('Bu sipariş kargo ile gönderilmiyor.');
  if (order.status !== 'paid') fail('Kargo bilgisi ödeme alındıktan sonra girilebilir.');
  if (company.trim().length < 2 || trackingCode.trim().length < 4) fail('Kargo firmasını ve takip numarasını girin.');
  order.shippingCompany = company.trim();
  order.trackingCode = trackingCode.trim();
  order.updatedAt = now();
  systemMessage(db, order, `Kargoya verildi: ${order.shippingCompany} · Takip no: ${order.trackingCode}`);
  notify(db, order.buyerId, 'Siparişin kargoya verildi 📦', `${order.listingTitle} — ${order.shippingCompany}, takip no: ${order.trackingCode}`, order.id);
}

/* ------------------------------ Online ödeme ------------------------------ */

export interface TestCardInput {
  holder: string;
  number: string;
  expiry: string; // AA/YY
  cvc: string;
}

/** Demo ödeme kartı doğrulaması. Kart numarası saklanmaz; yalnızca son 4 hane kaydedilir. */
export function validateTestCard(card: TestCardInput) {
  if (card.holder.trim().length < 3) fail('Kart üzerindeki ismi girin.');
  if (!luhnValid(card.number)) fail('Kart numarası geçersiz.');
  const m = card.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) fail('Son kullanma tarihini AA/YY biçiminde girin.');
  const month = Number(m![1]);
  const year = 2000 + Number(m![2]);
  if (month < 1 || month > 12) fail('Son kullanma ayı geçersiz.');
  const end = new Date(year, month, 1); // ayın son gününden sonrası
  if (end.getTime() <= Date.now()) fail('Kartın son kullanma tarihi geçmiş.');
  if (!/^\d{3,4}$/.test(card.cvc)) fail('Güvenlik kodu (CVC) 3 veya 4 haneli olmalıdır.');
}

/** Demo modunda online ödemeyi simüle eder. 0002 ile biten kartlar reddedilir. */
export function payWithTestCard(db: DB, buyerId: string, orderId: string, card: TestCardInput) {
  const order = getOrder(db, orderId) ?? fail('Sipariş bulunamadı.');
  const buyer = getUser(db, buyerId) ?? fail('Kullanıcı bulunamadı.');
  if (!canPay(order, buyer)) fail('Bu sipariş için şu anda ödeme yapılamaz.');
  validateTestCard(card);
  const digits = card.number.replace(/\D/g, '');
  const declined = digits.endsWith('0002');
  const t = now();
  db.payments.unshift({
    id: uid(),
    orderId,
    amount: order.buyerTotal,
    currency: 'TRY',
    provider: 'test',
    status: declined ? 'failed' : 'succeeded',
    providerPaymentId: declined ? undefined : 'TEST-' + uid().toUpperCase(),
    cardLast4: digits.slice(-4),
    cardAssociation: digits.startsWith('5') ? 'MASTER_CARD' : digits.startsWith('4') ? 'VISA' : 'TROY',
    errorMessage: declined ? 'Kart bankası ödemeyi onaylamadı.' : undefined,
    createdAt: t,
    paidAt: declined ? undefined : t,
  });
  if (declined) fail('Ödeme başarısız: Kart bankası ödemeyi onaylamadı. Farklı bir kart deneyebilirsin.');
  confirmPaid(db, order);
}

/** Başarılı ödeme sonrası siparişi "ödendi" yapar (demo ve sunucu akışında aynı sonuç). */
function confirmPaid(db: DB, order: Order) {
  transition(db, order, 'paid', order.buyerId);
  const title = `“${order.listingTitle}” (${order.code})`;
  notify(db, order.buyerId, 'Ödemen alındı 🎉', `${title} için ${tl(order.buyerTotal)} ödemen alındı. Satıcı hazırlığa başlıyor.`, order.id);
  notify(db, order.sellerId, 'Ödeme alındı 🎉', `${title} için ödeme alındı. Randevu saatine göre hazırlığa başlayabilirsin.`, order.id);
}

/** Admin: tamamlanan siparişin net tutarının satıcıya aktarıldığını işaretler. */
export function markPayout(db: DB, actor: User, orderIds: string[]) {
  assertAdmin(actor);
  const t = now();
  for (const id of orderIds) {
    const o = getOrder(db, id) ?? fail('Sipariş bulunamadı.');
    if (o.status !== 'completed') fail('Yalnızca tamamlanan siparişler için satıcıya ödeme yapılır.');
    if (o.payoutStatus === 'paid') continue;
    o.payoutStatus = 'paid';
    o.payoutAt = t;
    notify(db, o.sellerId, 'Kazancın hesabına gönderildi 💸', `“${o.listingTitle}” (${o.code}) için ${tl(o.sellerNet)} IBAN’ına aktarıldı.`, o.id);
  }
}

/* ------------------------------ Mesajlar ------------------------------ */

export function sendMessage(db: DB, senderId: string, orderId: string, text: string) {
  const order = getOrder(db, orderId) ?? fail('Sipariş bulunamadı.');
  if (senderId !== order.buyerId && senderId !== order.sellerId) fail('Bu sohbete mesaj gönderemezsiniz.');
  const body = text.trim();
  if (!body) return;
  if (body.length > 1000) fail('Mesaj en fazla 1000 karakter olabilir.');
  const receiverId = senderId === order.buyerId ? order.sellerId : order.buyerId;
  if (isBlockedBetween(db, senderId, receiverId)) fail('Bu kullanıcıyla mesajlaşamazsınız.');
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

export function markNotificationsRead(db: DB, userId: string) {
  db.notifications.forEach((n) => n.userId === userId && (n.read = true));
}

/* ------------------------------ Şikayet ve engelleme ------------------------------ */

export interface ReportInput {
  targetType: 'listing' | 'user';
  targetId: string;
  reason: ReportReason;
  note: string;
}

export function reportContent(db: DB, reporterId: string, input: ReportInput) {
  const exists = input.targetType === 'listing' ? !!getListing(db, input.targetId) : !!getUser(db, input.targetId);
  if (!exists) fail('Şikayet edilen içerik bulunamadı.');
  if (input.targetType === 'user' && input.targetId === reporterId) fail('Kendini şikayet edemezsin.');
  const dup = db.reports.some((r) => r.reporterId === reporterId && r.targetId === input.targetId && r.status === 'open');
  if (dup) fail('Bu içerik için açık bir şikayetin zaten var. İnceleniyor.');
  db.reports.unshift({ id: uid(), reporterId, ...input, note: input.note.trim().slice(0, 500), status: 'open', createdAt: now() });
  if (input.targetType === 'listing' && input.reason === 'hygiene' && hygieneHoldApplies(db, input.targetId, reporterId)) {
    const l = getListing(db, input.targetId)!;
    if (!l.underReview) {
      l.underReview = true;
      l.status = 'passive';
      l.updatedAt = now();
      notify(db, l.ownerId, 'İlanın incelemeye alındı ⚠️', `“${l.title}” hakkında hijyen / gıda güvenliği şikayeti geldi. İlan inceleme bitene kadar yayından kaldırıldı; yönetici seninle iletişime geçebilir.`);
      notifyAdmins(db, 'ACİL: Hijyen şikayeti 🚨', `“${l.title}” ilanı hijyen şikayeti nedeniyle otomatik olarak yayından kaldırıldı. Lütfen 24 saat içinde inceleyin.`);
      return;
    }
  }
  notifyAdmins(db, 'Yeni şikayet 🚩', input.targetType === 'listing' ? 'Bir ilan şikayet edildi.' : 'Bir kullanıcı şikayet edildi.');
}

/** Hijyen şikayetinde otomatik yayından kaldırma: ürünü satın almış bir alıcıdan 1 şikayet veya 2 farklı kişiden şikayet. */
export const HYGIENE_HOLD_REPORTS = 2;

export function hygieneHoldApplies(db: DB, listingId: string, reporterId: string) {
  const verifiedBuyer = db.orders.some(
    (o) => o.listingId === listingId && o.buyerId === reporterId && (o.status === 'paid' || o.status === 'completed'),
  );
  if (verifiedBuyer) return true;
  const reporters = new Set(db.reports.filter((r) => r.targetId === listingId && r.reason === 'hygiene' && r.status === 'open').map((r) => r.reporterId));
  return reporters.size >= HYGIENE_HOLD_REPORTS;
}

/** Admin: incelemedeki ilanı temize çıkarıp yeniden yayına alır ve ilgili açık hijyen şikayetlerini kapatır. */
export function reinstateListing(db: DB, actor: User, listingId: string) {
  assertAdmin(actor);
  const l = getListing(db, listingId) ?? fail('İlan bulunamadı.');
  const owner = getUser(db, l.ownerId);
  l.underReview = false;
  l.removedByAdmin = false;
  if (owner?.active && canSell(owner)) l.status = 'active';
  l.updatedAt = now();
  db.reports.filter((r) => r.targetId === listingId && r.status === 'open').forEach((r) => (r.status = 'resolved'));
  notify(db, l.ownerId, 'İlanın yeniden yayında ✅', `“${l.title}” ilanı incelendi ve yeniden yayına alındı.`);
}

export function blockUser(db: DB, blockerId: string, blockedId: string) {
  if (blockerId === blockedId) fail('Kendini engelleyemezsin.');
  if (!getUser(db, blockedId)) fail('Kullanıcı bulunamadı.');
  if (db.blocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId)) return;
  db.blocks.push({ blockerId, blockedId, createdAt: now() });
}

export function unblockUser(db: DB, blockerId: string, blockedId: string) {
  db.blocks = db.blocks.filter((b) => !(b.blockerId === blockerId && b.blockedId === blockedId));
}

export function resolveReport(db: DB, actor: User, reportId: string) {
  assertAdmin(actor);
  const r = db.reports.find((x) => x.id === reportId) ?? fail('Şikayet bulunamadı.');
  r.status = 'resolved';
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
  if (!active) db.listings.filter((l) => l.ownerId === userId).forEach((l) => (l.status = 'passive'));
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
  const open = db.orders.some((o) => (o.buyerId === userId || o.sellerId === userId) && OPEN_STATUSES.includes(o.status));
  if (open) fail('Kullanıcının devam eden siparişleri var. Önce siparişleri sonuçlandırın veya kullanıcıyı pasifleştirin.');
  removeUserData(db, userId);
}

export function adminStats(db: DB) {
  const counted = db.orders.filter((o) => o.status === 'paid' || o.status === 'completed');
  const sum = (list: Order[], f: (o: Order) => number) => Math.round(list.reduce((s, o) => s + f(o), 0) * 100) / 100;
  const payoutDue = db.orders.filter((o) => o.status === 'completed' && o.payoutStatus === 'pending');
  return {
    users: db.users.length,
    activeUsers: db.users.filter((u) => u.active).length,
    sellers: db.users.filter((u) => u.sellerStatus === 'approved').length,
    couriers: db.users.filter((u) => u.courierStatus === 'approved').length,
    listings: db.listings.length,
    activeListings: db.listings.filter((l) => l.status === 'active').length,
    orders: db.orders.length,
    completedOrders: db.orders.filter((o) => o.status === 'completed').length,
    pendingVerifications: db.verifications.filter((v) => v.status === 'pending').length,
    openReports: db.reports.filter((r) => r.status === 'open').length,
    grossVolume: sum(counted, (o) => o.buyerTotal),
    commission: sum(counted, (o) => o.buyerFee + o.sellerFee),
    buyerFees: sum(counted, (o) => o.buyerFee),
    sellerFees: sum(counted, (o) => o.sellerFee),
    payoutDue: sum(payoutDue, (o) => o.sellerNet),
    payoutDueCount: payoutDue.length,
  };
}

/** Satıcılara aktarılacak tutarlar (tamamlanan ve henüz ödenmemiş siparişler), satıcı bazında. */
export function payoutSummary(db: DB) {
  const bySeller = new Map<string, { sellerId: string; orders: Order[]; total: number }>();
  for (const o of db.orders) {
    if (o.status !== 'completed' || o.payoutStatus !== 'pending') continue;
    const e = bySeller.get(o.sellerId) ?? { sellerId: o.sellerId, orders: [], total: 0 };
    e.orders.push(o);
    e.total = Math.round((e.total + o.sellerNet) * 100) / 100;
    bySeller.set(o.sellerId, e);
  }
  return [...bySeller.values()].map((e) => ({
    ...e,
    seller: getUser(db, e.sellerId),
    verification: db.verifications.find((v) => v.userId === e.sellerId && v.kind === 'seller' && v.status === 'approved') as Verification | undefined,
  }));
}
