import { ALLERGENS, type AllergenKey, type DeliveryMethod, type LicenseClass, type OrderStatus, type ShippingPayer, type VerificationStatus } from './types';

export function tl(n: number) {
  return (
    n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + ' ₺'
  );
}

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const pad = (n: number) => String(n).padStart(2, '0');

export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function dayLabel(d: Date, short = false) {
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(today)) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  return short ? DAYS_SHORT[d.getDay()] : DAYS[d.getDay()];
}

export function dateShort(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function appointmentText(iso: string) {
  const d = new Date(iso);
  return `${dateShort(d)} ${DAYS[d.getDay()]}, ${hhmm(d)}`;
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} gün önce`;
  return dateShort(d);
}

export function chatTime(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? hhmm(d) : `${dateShort(d)} ${hhmm(d)}`;
}

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  pickup: 'Elden Teslim',
  courier: 'Kurye',
  cargo: 'Kargo',
};

export const SHIPPING_PAYER_LABEL: Record<ShippingPayer, string> = {
  buyer: 'Alıcı öder',
  seller: 'Satıcı öder',
};

/** Teslimat ücreti sorumluluğunu açıklayan cümle. */
export function shippingPayerText(method: DeliveryMethod, payer: ShippingPayer) {
  if (method === 'pickup') return 'Alıcı ürünü satıcının adresinden teslim alır.';
  const what = method === 'cargo' ? 'Kargo' : 'Kurye';
  return payer === 'seller'
    ? `${what} ücretini ve gönderimi satıcı üstlenir; alıcı ek ücret ödemez.`
    : `${what} ücretini alıcı öder; ücret online ödemeye dahil değildir ve ${method === 'cargo' ? 'kargo firmasına' : 'kuryeye'} ödenir.`;
}

export const LICENSE_LABEL: Record<LicenseClass, string> = {
  A2: 'A2 sınıfı (motosiklet)',
  B: 'B sınıfı (otomobil)',
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  none: 'Başvuru yok',
  pending: 'İnceleniyor',
  approved: 'Onaylı',
  rejected: 'Reddedildi',
};

export const STATUS_META: Record<OrderStatus, { label: string; tone: 'yellow' | 'blue' | 'green' | 'red' | 'gray' }> = {
  seller_pending: { label: 'Satıcı Onayı Bekliyor', tone: 'yellow' },
  approved: { label: 'Ödeme Bekleniyor', tone: 'blue' },
  paid: { label: 'Ödendi · Hazırlanıyor', tone: 'green' },
  completed: { label: 'Tamamlandı', tone: 'green' },
  rejected: { label: 'Reddedildi', tone: 'red' },
  cancelled: { label: 'İptal Edildi', tone: 'gray' },
};

export const ORDER_FLOW: OrderStatus[] = ['seller_pending', 'approved', 'paid', 'completed'];

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('');
}

/** Alerjenin kısa adı (parantez içindeki örnekler olmadan). */
export const allergenShort = (key: AllergenKey) => (ALLERGENS.find((a) => a.key === key)?.label ?? key).split(' (')[0]!;
