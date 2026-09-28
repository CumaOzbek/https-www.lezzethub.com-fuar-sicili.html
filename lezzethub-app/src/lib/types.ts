export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  bio: string;
  avatar?: string;
  district: string;
  neighborhood: string;
  address: string;
  availability: string;
  createdAt: string;
}

export type DeliveryMethod = 'courier' | 'pickup';
export type ListingStatus = 'active' | 'passive';

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

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  category: CategoryKey;
  image?: string;
  prepTime: string;
  delivery: DeliveryMethod[];
  status: ListingStatus;
  /** Admin tarafından yayından kaldırıldıysa satıcı tekrar yayına alamaz. */
  removedByAdmin?: boolean;
  district: string;
  neighborhood: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'seller_pending'
  | 'approved'
  | 'payment_pending'
  | 'paid'
  | 'completed'
  | 'rejected'
  | 'cancelled';

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
  address: string;
  note: string;
  subtotal: number;
  buyerFee: number;
  sellerFee: number;
  buyerTotal: number;
  sellerNet: number;
  status: OrderStatus;
  statusNote?: string;
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

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  adminId?: string;
  adminNote?: string;
  createdAt: string;
  decidedAt?: string;
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

export interface DB {
  version: number;
  users: User[];
  listings: Listing[];
  orders: Order[];
  messages: Message[];
  payments: Payment[];
  notifications: AppNotification[];
}
