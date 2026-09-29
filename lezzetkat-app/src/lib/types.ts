export type Role = 'user' | 'admin';

/** Satıcı ve kurye başvurularının durumu. */
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  /** Yalnızca kullanıcının kendisine ve adminlere görünür (canlı modda diğerleri için boştur). */
  email: string;
  /** Yalnızca cihaz içi (demo) modda kullanılır. */
  passwordHash?: string;
  role: Role;
  active: boolean;
  bio: string;
  avatar?: string;
  province: string;
  district: string;
  neighborhood: string;
  /** Açık adres: yalnızca kullanıcının kendisine ve adminlere görünür. */
  address: string;
  /** Telefon: yalnızca kullanıcının kendisine ve adminlere görünür (kuryeler için kurye profilinde paylaşılır). */
  phone: string;
  availability: string;
  /** Satış yapabilmek için hijyen belgesi admin tarafından onaylanmış olmalı. */
  sellerStatus: VerificationStatus;
  /** Kurye olarak görünmek için ehliyet admin tarafından onaylanmış olmalı. */
  courierStatus: VerificationStatus;
  /** Tarım ve Orman Bakanlığı gıda işletmesi kayıt numarası (satıcı onaylanınca herkese açık gösterilir). */
  foodRegistrationNo?: string;
  /** Kullanım koşulları ve KVKK aydınlatma metni kabulü. */
  acceptedTermsAt?: string;
  /** KVKK açık rıza onayı. */
  kvkkConsentAt?: string;
  createdAt: string;
}

export type DeliveryMethod = 'pickup' | 'courier' | 'cargo';
export type ListingStatus = 'active' | 'passive';
/** Kurye / kargo ücretini ve organizasyonunu üstlenen taraf. */
export type ShippingPayer = 'buyer' | 'seller';

export const CATEGORIES = [
  { key: 'ana-yemek', label: 'Ana Yemek', emoji: '🍲' },
  { key: 'tatli', label: 'Tatlı', emoji: '🍯' },
  { key: 'hamur-isi', label: 'Hamur İşi', emoji: '🥟' },
  { key: 'meze', label: 'Meze & Kahvaltılık', emoji: '🫒' },
  { key: 'corba', label: 'Çorba', emoji: '🥣' },
  { key: 'salata', label: 'Salata', emoji: '🥗' },
  { key: 'icecek', label: 'İçecek', emoji: '🥤' },
  { key: 'diger', label: 'Diğer', emoji: '🧺' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

/** Türk Gıda Kodeksi Etiketleme Yönetmeliği'ndeki 14 alerjen grubu. */
export const ALLERGENS = [
  { key: 'gluten', label: 'Gluten (buğday, arpa, çavdar, yulaf)' },
  { key: 'sut', label: 'Süt ve süt ürünleri (laktoz dahil)' },
  { key: 'yumurta', label: 'Yumurta' },
  { key: 'kuruyemis', label: 'Sert kabuklu yemişler (fındık, ceviz, antep fıstığı, badem vb.)' },
  { key: 'yerfistigi', label: 'Yer fıstığı' },
  { key: 'susam', label: 'Susam (tahin dahil)' },
  { key: 'soya', label: 'Soya' },
  { key: 'balik', label: 'Balık' },
  { key: 'kabuklu', label: 'Kabuklu deniz ürünleri (karides, yengeç vb.)' },
  { key: 'yumusakca', label: 'Yumuşakçalar (midye, kalamar vb.)' },
  { key: 'kereviz', label: 'Kereviz' },
  { key: 'hardal', label: 'Hardal' },
  { key: 'acibakla', label: 'Acı bakla (lupin)' },
  { key: 'sulfit', label: 'Kükürt dioksit ve sülfitler' },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]['key'];

/** Platformda satışı yasak olan yüksek riskli ürünler (satıcı her ilanda içermediğini onaylar). */
export const PROHIBITED_FOODS = [
  'Çiğ veya az pişmiş et, tavuk, balık ve deniz ürünleri (çiğ köfte dahil)',
  'Pastörize edilmemiş (çiğ) süt ve çiğ sütten yapılan ürünler',
  'Çiğ yumurta içeren ürünler (ev yapımı mayonez, tiramisu, çiğ yumurtalı soslar)',
  'Ev tipi konserve ve yağda saklanan sebzeler (botulizm riski)',
  'Yabani / toplanmış mantar ve otlar',
  'Alkollü içecekler',
  'Bebek maması, takviye edici gıda, “şifalı” veya ilaç iddialı ürünler',
] as const;

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  category: CategoryKey;
  /** İlk fotoğraf kapak fotoğrafıdır. En fazla MAX_LISTING_PHOTOS adet. */
  images: string[];
  prepTime: string;
  delivery: DeliveryMethod[];
  /** Kurye veya kargo ile teslimde ücreti kim öder / kim ayarlar. */
  shippingPayer: ShippingPayer;
  /** Beyan edilen alerjenler; boş dizi = satıcı alerjen içermediğini beyan etti. */
  allergens: AllergenKey[];
  /** Son tüketim ve saklama bilgisi (ör. “Buzdolabında 2 gün”). */
  shelfLife: string;
  /** Oda sıcaklığında dayanıklı, soğuk zincir gerektirmez (kargo yalnızca bu ürünlerde). */
  shelfStable: boolean;
  /** Satıcının yasaklı ürün içermediğini son onayladığı an. */
  safetyConfirmedAt: string;
  status: ListingStatus;
  /** Admin tarafından yayından kaldırıldıysa satıcı tekrar yayına alamaz. */
  removedByAdmin?: boolean;
  /** Hijyen şikayeti nedeniyle otomatik yayından kaldırıldı; yalnızca admin geri açabilir. */
  underReview?: boolean;
  province: string;
  district: string;
  neighborhood: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Platform ödeme modu. 'offline' (pilot): alıcı teslimatta doğrudan satıcıya öder, komisyon alınmaz,
 * para platformdan geçmez. 'online': iyzico ile online ödeme ve komisyon (şirket + iyzico hesabı gerekir).
 */
export type PaymentMode = 'offline' | 'online';
/** Siparişin ödeme yöntemi (sipariş oluşturulurken platform moduna göre belirlenir, sonradan değişmez). */
export type PaymentMethod = 'online' | 'on_delivery';

export interface AppSettings {
  paymentMode: PaymentMode;
}

export type OrderStatus = 'seller_pending' | 'approved' | 'paid' | 'completed' | 'rejected' | 'cancelled';

export interface Order {
  id: string;
  code: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  listingTitle: string;
  unitPrice: number;
  quantity: number;
  appointment: string;
  delivery: DeliveryMethod;
  shippingPayer: ShippingPayer;
  /** 'on_delivery': ödeme teslimatta doğrudan satıcıya (komisyonsuz); 'online': iyzico ile. */
  paymentMethod: PaymentMethod;
  /** Kurye/kargo teslimatında alıcının adresi. */
  address: string;
  /** Elden teslimde satıcının adresi; satıcı onayladığında doldurulur. */
  pickupAddress?: string;
  /** Kargo teslimatında satıcının girdiği bilgiler. */
  shippingCompany?: string;
  trackingCode?: string;
  note: string;
  subtotal: number;
  buyerFee: number;
  sellerFee: number;
  buyerTotal: number;
  sellerNet: number;
  status: OrderStatus;
  statusNote?: string;
  /** Satıcıya net tutarın aktarılma durumu (tamamlanan siparişlerde). */
  payoutStatus: 'pending' | 'paid';
  payoutAt?: string;
  history: { status: OrderStatus; at: string; by: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  orderId: string;
  senderId: string; // 'system' → sistem mesajı
  receiverId: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: 'TRY';
  /** 'iyzico' canlı ödeme; 'test' demo modunda simüle edilen ödeme. */
  provider: 'iyzico' | 'test';
  status: PaymentStatus;
  providerPaymentId?: string;
  cardLast4?: string;
  cardAssociation?: string;
  errorMessage?: string;
  refundNote?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  orderId?: string;
  createdAt: string;
  read: boolean;
}

export const MAX_LISTING_PHOTOS = 6;

export const REPORT_REASONS = [
  { key: 'misleading', label: 'Yanıltıcı ilan veya fotoğraf' },
  { key: 'hygiene', label: 'Hijyen / gıda güvenliği endişesi' },
  { key: 'abuse', label: 'Hakaret, taciz veya uygunsuz içerik' },
  { key: 'fraud', label: 'Dolandırıcılık şüphesi' },
  { key: 'other', label: 'Diğer' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'listing' | 'user';
  targetId: string;
  reason: ReportReason;
  note: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface Block {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type DocumentType = 'image' | 'pdf';
export type LicenseClass = 'A2' | 'B';

/** Satıcı (hijyen belgesi) veya kurye (ehliyet) başvurusu. Yalnızca sahibi ve adminler görür. */
export interface Verification {
  id: string;
  userId: string;
  kind: 'seller' | 'courier';
  status: Exclude<VerificationStatus, 'none'>;
  /** Belge dosyası (fotoğraf veya PDF). Canlı modda özel depodaki yol. */
  docUri: string;
  docType: DocumentType;
  /** Satıcı: e-Devlet belge barkod numarası. Kurye: ehliyet belge numarası. */
  docNumber: string;
  licenseClass?: LicenseClass;
  /** Satıcı: gıda işletmesi kayıt numarası. */
  foodRegistrationNo?: string;
  iban?: string;
  ibanHolder?: string;
  /** Satıcının mevzuat ve sorumluluk beyanını onayladığı an. */
  declarationAt?: string;
  /** Belgelerin işlenmesine ilişkin açık rıza. */
  documentConsentAt: string;
  adminNote?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface CourierProfile {
  userId: string;
  licenseClass: LicenseClass;
  vehicle: 'motorcycle' | 'car';
  /** Onaylı kuryenin iletişim numarası; kurye paylaşılmasına onay verir. */
  phone: string;
  serviceProvince: string;
  serviceDistricts: string[];
  available: boolean;
  updatedAt: string;
}

export interface DB {
  version: number;
  settings: AppSettings;
  users: User[];
  listings: Listing[];
  orders: Order[];
  messages: Message[];
  payments: Payment[];
  notifications: AppNotification[];
  reports: Report[];
  blocks: Block[];
  verifications: Verification[];
  couriers: CourierProfile[];
}
