// Canlı backend: Supabase (PostgreSQL + Auth + Storage + Realtime).
// Tüm yazma işlemleri supabase/schema.sql'deki sunucu fonksiyonlarıyla yapılır;
// iş kuralları ve yetki kontrolleri sunucuda uygulanır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type AuthError, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import * as api from '../api';
import { DOCUMENT_BUCKET, PHOTO_BUCKET, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { documentContentType, readDocumentBytes } from '../documents';
import { DB_VERSION } from '../seed';
import { needsUpload, readPhotoBytes } from '../photos';
import type { AppNotification, Block, CourierProfile, DB, Listing, Message, Order, Payment, Report, User, Verification, VerificationStatus } from '../types';
import type { Backend, PaymentOutcome, ProfileUpdate, RegisterResult } from './types';

if (Platform.OS !== 'web') {
  // supabase-js'in ihtiyaç duyduğu URL API'sini React Native'de tamamlar.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-url-polyfill/auto');
}

/* ------------------------------ Satır → model dönüşümleri ------------------------------ */

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => Number(v ?? 0);
const opt = (v: unknown) => (v == null || v === '' ? undefined : String(v));
const vstatus = (v: unknown): VerificationStatus => (v === 'pending' || v === 'approved' || v === 'rejected' ? v : 'none');

function toUser(p: Row, priv?: Row): User {
  return {
    id: str(p.id),
    name: str(p.name),
    email: str(priv?.email),
    role: p.role === 'admin' ? 'admin' : 'user',
    active: p.active !== false,
    bio: str(p.bio),
    avatar: opt(p.avatar_url),
    province: str(p.province),
    district: str(p.district),
    neighborhood: str(p.neighborhood),
    address: str(priv?.address),
    phone: str(priv?.phone),
    availability: str(p.availability),
    sellerStatus: vstatus(p.seller_status),
    courierStatus: vstatus(p.courier_status),
    acceptedTermsAt: opt(priv?.accepted_terms_at),
    kvkkConsentAt: opt(priv?.kvkk_consent_at),
    createdAt: str(p.created_at),
  };
}

const toListing = (r: Row): Listing => ({
  id: str(r.id),
  ownerId: str(r.owner_id),
  title: str(r.title),
  description: str(r.description),
  price: num(r.price),
  category: str(r.category) as Listing['category'],
  images: (r.images as string[] | null) ?? [],
  prepTime: str(r.prep_time),
  delivery: (r.delivery as Listing['delivery']) ?? [],
  shippingPayer: r.shipping_payer === 'seller' ? 'seller' : 'buyer',
  status: r.status === 'active' ? 'active' : 'passive',
  removedByAdmin: !!r.removed_by_admin,
  province: str(r.province),
  district: str(r.district),
  neighborhood: str(r.neighborhood),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
});

const toOrder = (r: Row): Order => ({
  id: str(r.id),
  code: str(r.code),
  buyerId: str(r.buyer_id),
  sellerId: str(r.seller_id),
  listingId: str(r.listing_id),
  listingTitle: str(r.listing_title),
  unitPrice: num(r.unit_price),
  quantity: num(r.quantity),
  appointment: str(r.appointment),
  delivery: r.delivery === 'courier' || r.delivery === 'cargo' ? r.delivery : 'pickup',
  shippingPayer: r.shipping_payer === 'seller' ? 'seller' : 'buyer',
  address: str(r.address),
  pickupAddress: opt(r.pickup_address),
  shippingCompany: opt(r.shipping_company),
  trackingCode: opt(r.tracking_code),
  note: str(r.note),
  subtotal: num(r.subtotal),
  buyerFee: num(r.buyer_fee),
  sellerFee: num(r.seller_fee),
  buyerTotal: num(r.buyer_total),
  sellerNet: num(r.seller_net),
  status: str(r.status) as Order['status'],
  statusNote: opt(r.status_note),
  payoutStatus: r.payout_status === 'paid' ? 'paid' : 'pending',
  payoutAt: opt(r.payout_at),
  history: ((r.history as Row[] | null) ?? []).map((h) => ({ status: str(h.status) as Order['status'], at: str(h.at), by: str(h.by), note: opt(h.note) })),
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
});

const toMessage = (r: Row): Message => ({
  id: str(r.id),
  orderId: str(r.order_id),
  senderId: r.is_system ? 'system' : str(r.sender_id) || 'deleted',
  receiverId: str(r.receiver_id),
  text: str(r.text),
  createdAt: str(r.created_at),
  read: !!r.read,
});

const toPayment = (r: Row): Payment => ({
  id: str(r.id),
  orderId: str(r.order_id),
  amount: num(r.amount),
  currency: 'TRY',
  provider: r.provider === 'test' ? 'test' : 'iyzico',
  status: str(r.status) as Payment['status'],
  providerPaymentId: opt(r.provider_payment_id),
  cardLast4: opt(r.card_last4),
  cardAssociation: opt(r.card_association),
  errorMessage: opt(r.error_message),
  refundNote: opt(r.refund_note),
  createdAt: str(r.created_at),
  paidAt: opt(r.paid_at),
  refundedAt: opt(r.refunded_at),
});

const toVerification = (r: Row): Verification => ({
  id: str(r.id),
  userId: str(r.user_id),
  kind: r.kind === 'courier' ? 'courier' : 'seller',
  status: r.status === 'approved' || r.status === 'rejected' ? r.status : 'pending',
  docUri: str(r.doc_path),
  docType: r.doc_type === 'pdf' ? 'pdf' : 'image',
  docNumber: str(r.doc_number),
  licenseClass: r.license_class === 'A2' || r.license_class === 'B' ? r.license_class : undefined,
  iban: opt(r.iban),
  ibanHolder: opt(r.iban_holder),
  declarationAt: opt(r.declaration_at),
  documentConsentAt: str(r.document_consent_at),
  adminNote: opt(r.admin_note),
  submittedAt: str(r.submitted_at),
  reviewedAt: opt(r.reviewed_at),
});

const toCourier = (r: Row): CourierProfile => ({
  userId: str(r.user_id),
  licenseClass: r.license_class === 'A2' ? 'A2' : 'B',
  vehicle: r.vehicle === 'motorcycle' ? 'motorcycle' : 'car',
  phone: str(r.phone),
  serviceProvince: str(r.service_province),
  serviceDistricts: (r.service_districts as string[] | null) ?? [],
  available: r.available !== false,
  updatedAt: str(r.updated_at),
});

const toNotification = (r: Row): AppNotification => ({
  id: str(r.id),
  userId: str(r.user_id),
  title: str(r.title),
  body: str(r.body),
  orderId: opt(r.order_id),
  createdAt: str(r.created_at),
  read: !!r.read,
});

const toReport = (r: Row): Report => ({
  id: str(r.id),
  reporterId: str(r.reporter_id),
  targetType: r.target_type === 'user' ? 'user' : 'listing',
  targetId: str(r.target_id),
  reason: str(r.reason) as Report['reason'],
  note: str(r.note),
  status: r.status === 'resolved' ? 'resolved' : 'open',
  createdAt: str(r.created_at),
});

const toBlock = (r: Row): Block => ({ blockerId: str(r.blocker_id), blockedId: str(r.blocked_id), createdAt: str(r.created_at) });

/* ------------------------------ Hata dönüşümü ------------------------------ */

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-posta veya şifre hatalı.'],
  [/already registered|already been registered|user already exists/i, 'Bu e-posta adresiyle kayıtlı bir hesap var.'],
  [/email not confirmed/i, 'E-posta adresin henüz doğrulanmadı. Gelen kutundaki doğrulama bağlantısına tıkla.'],
  [/password should be at least|weak password/i, 'Şifre yeterince güçlü değil. En az 6 karakter kullan.'],
  [/rate limit|too many requests|security purposes/i, 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.'],
  [/invalid email|unable to validate email/i, 'Geçerli bir e-posta adresi girin.'],
];

function authError(e: AuthError): never {
  const hit = AUTH_ERRORS.find(([re]) => re.test(e.message));
  if (!hit) console.warn('LezzetHub auth hatası:', e.message);
  throw new api.ApiError(hit ? hit[1] : 'Giriş işlemi tamamlanamadı. İnternet bağlantını kontrol edip tekrar dene.');
}

function dbError(e: PostgrestError): never {
  // Sunucu fonksiyonlarındaki iş kuralı hataları (P0001) doğrudan kullanıcıya gösterilir.
  if (e.code === 'P0001') throw new api.ApiError(e.message);
  console.warn('LezzetHub sunucu hatası:', e.code, e.message);
  throw new api.ApiError('Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.');
}

const emptyDb = (): DB => ({
  version: DB_VERSION, users: [], listings: [], orders: [], messages: [], payments: [], notifications: [], reports: [], blocks: [], verifications: [], couriers: [],
});

/** Edge Function hatasındaki kullanıcıya yönelik mesajı çıkarır. */
async function functionError(error: unknown): Promise<never> {
  const ctx = (error as { context?: Response }).context;
  try {
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    if (body?.error) throw new api.ApiError(String(body.error));
  } catch (e) {
    if (e instanceof api.ApiError) throw e;
  }
  console.warn('LezzetHub ödeme servisi hatası:', error);
  throw new api.ApiError('Ödeme servisine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.');
}

/* ------------------------------ Backend ------------------------------ */

export class SupabaseBackend implements Backend {
  readonly mode = 'remote' as const;
  private sb: SupabaseClient;
  private db: DB = emptyDb();
  private userId: string | null = null;
  private listeners = new Set<() => void>();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshing: Promise<void> | null = null;
  private recoveryPending = false;

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  private wired = false;

  async init() {
    if (!this.wired) this.wire();
    const { data } = await this.sb.auth.getSession();
    this.userId = data.session?.user.id ?? null;
    await this.refresh();
  }

  /** Dinleyicileri bir kez kurar (init yeniden denense bile). */
  private wire() {
    this.wired = true;
    // Uygulama ön plandayken oturum jetonunu otomatik yenile (Supabase'in React Native önerisi).
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (state) => {
        if (state === 'active') this.sb.auth.startAutoRefresh();
        else this.sb.auth.stopAutoRefresh();
      });
    }
    this.sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') this.recoveryPending = true;
      const next = session?.user?.id ?? null;
      if (next !== this.userId) {
        this.userId = next;
        this.scheduleRefresh(0);
      }
    });
    // Veritabanındaki değişiklikler anında uygulamaya yansısın (RLS'e uyar).
    const channel = this.sb.channel('lezzethub-db');
    for (const table of ['listings', 'orders', 'messages', 'payments', 'notifications', 'reports', 'profiles', 'verifications', 'courier_profiles']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleRefresh(250));
    }
    channel.subscribe();
  }

  snapshot() {
    return this.db;
  }

  sessionUserId() {
    const me = this.userId ? this.db.users.find((u) => u.id === this.userId) : undefined;
    return me?.active ? me.id : null;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private scheduleRefresh(delay: number) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch((e) => console.warn('LezzetHub yenileme hatası', e));
    }, delay);
  }

  /** Oturumdaki kullanıcının görmeye yetkili olduğu tüm verileri çeker (RLS süzgecinden geçer). */
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const signedIn = !!this.userId;
      const from = (table: string) => this.sb.from(table).select('*');
      const newestFirst = { ascending: false };
      const none = Promise.resolve({ data: [] as Row[], error: null });
      const [profiles, priv, listings, orders, messages, payments, notifications, reports, blocks, verifications, couriers] = await Promise.all([
        from('profiles'),
        signedIn ? from('profile_private') : none,
        from('listings').order('created_at', newestFirst),
        signedIn ? from('orders').order('created_at', newestFirst) : none,
        signedIn ? from('messages').order('created_at', { ascending: true }) : none,
        signedIn ? from('payments').order('created_at', newestFirst) : none,
        signedIn ? from('notifications').order('created_at', newestFirst).limit(200) : none,
        signedIn ? from('reports').order('created_at', newestFirst) : none,
        signedIn ? from('blocks') : none,
        signedIn ? from('verifications').order('submitted_at', newestFirst) : none,
        signedIn ? from('courier_profiles') : none,
      ]);
      for (const r of [profiles, priv, listings, orders, messages, payments, notifications, reports, blocks, verifications, couriers]) {
        if (r.error) dbError(r.error);
      }
      const privById = new Map((priv.data ?? []).map((p) => [str(p.id), p]));
      this.db = {
        version: DB_VERSION,
        users: (profiles.data ?? []).map((p) => toUser(p, privById.get(str(p.id)))),
        listings: (listings.data ?? []).map(toListing),
        orders: (orders.data ?? []).map(toOrder),
        messages: (messages.data ?? []).map(toMessage),
        payments: (payments.data ?? []).map(toPayment),
        notifications: (notifications.data ?? []).map(toNotification),
        reports: (reports.data ?? []).map(toReport),
        blocks: (blocks.data ?? []).map(toBlock),
        verifications: (verifications.data ?? []).map(toVerification),
        couriers: (couriers.data ?? []).map(toCourier),
      };
      this.emit();
    })();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  private async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) dbError(error);
    return data as T;
  }

  /** Bir işlemi çalıştırıp verileri yeniler. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    const result = await fn();
    await this.refresh();
    return result;
  }

  private requireUser(): string {
    if (!this.userId) throw new api.ApiError('Bu işlem için giriş yapmalısın.');
    return this.userId;
  }

  private async uploadPhotos(uris: string[]): Promise<string[]> {
    const owner = this.requireUser();
    const out: string[] = [];
    for (const uri of uris) {
      if (!needsUpload(uri)) {
        out.push(uri);
        continue;
      }
      const path = `${owner}/${Date.now()}-${api.uid()}.jpg`;
      const bytes = await readPhotoBytes(uri);
      const { error } = await this.sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) {
        console.warn('LezzetHub fotoğraf yükleme hatası:', error.message);
        throw new api.ApiError('Fotoğraf yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
      }
      out.push(this.sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    return out;
  }

  /* ---------- Kimlik ---------- */

  async login(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: api.normalizeEmail(email), password });
    if (error) authError(error);
    this.userId = data.user?.id ?? null;
    await this.refresh();
    const me = this.db.users.find((u) => u.id === this.userId);
    if (!me || !me.active) {
      await this.sb.auth.signOut();
      this.userId = null;
      await this.refresh();
      throw new api.ApiError('Hesabın pasif durumda. Lütfen destek ile iletişime geçin.');
    }
    return me;
  }

  async register(input: api.RegisterInput): Promise<RegisterResult> {
    api.validateRegisterFields(input);
    const { data, error } = await this.sb.auth.signUp({
      email: api.normalizeEmail(input.email),
      password: input.password,
      options: {
        emailRedirectTo: Linking.createURL('/'),
        data: {
          name: input.name.trim(),
          province: input.province,
          district: input.district,
          neighborhood: input.neighborhood.trim(),
          accepted_terms: input.acceptedTerms,
          kvkk_consent: input.kvkkConsent,
          intent: input.intent,
        },
      },
    });
    if (error) authError(error);
    // Supabase, kayıtlı e-postayı sızdırmamak için hata yerine kimliği boş kullanıcı dönebilir.
    if (data.user && (data.user.identities?.length ?? 0) === 0) throw new api.ApiError('Bu e-posta adresiyle kayıtlı bir hesap var.');
    if (!data.session) return { user: null, needsEmailConfirmation: true };
    this.userId = data.session.user.id;
    await this.refresh();
    return { user: this.db.users.find((u) => u.id === this.userId) ?? null, needsEmailConfirmation: false };
  }

  async logout() {
    await this.sb.auth.signOut();
    this.userId = null;
    await this.refresh();
  }

  async requestPasswordReset(email: string) {
    const clean = api.normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new api.ApiError('Geçerli bir e-posta adresi girin.');
    const { error } = await this.sb.auth.resetPasswordForEmail(clean, { redirectTo: Linking.createURL('/reset-password') });
    if (error) authError(error);
  }

  async handleAuthRedirect(url: string) {
    // Bağlantıdaki jetonlar #fragment veya ?query içinde gelebilir.
    const [, frag = ''] = url.split('#');
    const query = url.includes('?') ? url.split('?')[1]!.split('#')[0]! : '';
    const params = new URLSearchParams(frag || query);
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (!access || !refresh) return;
    const { error } = await this.sb.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) authError(error);
    if (params.get('type') === 'recovery') this.recoveryPending = true;
    this.emit();
  }

  consumePasswordRecovery() {
    const v = this.recoveryPending;
    this.recoveryPending = false;
    return v;
  }

  async completePasswordReset(newPassword: string) {
    if (newPassword.length < 6) throw new api.ApiError('Yeni şifre en az 6 karakter olmalıdır.');
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) authError(error);
  }

  async changePassword(current: string, next: string) {
    const me = this.db.users.find((u) => u.id === this.requireUser());
    if (next.length < 6) throw new api.ApiError('Yeni şifre en az 6 karakter olmalıdır.');
    // Mevcut şifreyi doğrula.
    const check = await this.sb.auth.signInWithPassword({ email: me?.email ?? '', password: current });
    if (check.error) throw new api.ApiError('Mevcut şifre hatalı.');
    const { error } = await this.sb.auth.updateUser({ password: next });
    if (error) authError(error);
  }

  async deleteAccount() {
    await this.rpc('delete_my_account');
    await this.sb.auth.signOut();
    this.userId = null;
    await this.refresh();
  }

  async updateProfile(input: ProfileUpdate) {
    const [avatar] = input.avatar ? await this.uploadPhotos([input.avatar]) : [undefined];
    await this.run(() =>
      this.rpc('update_profile', {
        p_name: input.name,
        p_bio: input.bio,
        p_province: input.province,
        p_district: input.district,
        p_neighborhood: input.neighborhood,
        p_address: input.address,
        p_phone: input.phone,
        p_availability: input.availability,
        p_avatar_url: avatar ?? null,
      }),
    );
  }

  /* ---------- Satıcı ve kurye başvuruları ---------- */

  /** Belgeyi özel kovaya (kullanıcı-id/...) yükler ve yolunu döner. */
  private async uploadDocument(uri: string, type: Verification['docType'], kind: string): Promise<string> {
    const owner = this.requireUser();
    const path = `${owner}/${kind}-${Date.now()}-${api.uid()}.${type === 'pdf' ? 'pdf' : 'jpg'}`;
    const bytes = await readDocumentBytes(uri);
    const { error } = await this.sb.storage.from(DOCUMENT_BUCKET).upload(path, bytes, { contentType: documentContentType(type), upsert: false });
    if (error) {
      console.warn('LezzetHub belge yükleme hatası:', error.message);
      throw new api.ApiError('Belge yüklenemedi. Dosya 8 MB’tan küçük olmalı; internet bağlantını kontrol edip tekrar dene.');
    }
    return path;
  }

  async submitSellerApplication(input: api.SellerApplicationInput) {
    api.validateSellerApplication(input);
    const path = await this.uploadDocument(input.docUri, input.docType, 'hijyen');
    await this.run(() =>
      this.rpc('submit_seller_application', {
        p_doc_path: path,
        p_doc_type: input.docType,
        p_barcode: input.barcode,
        p_iban: input.iban,
        p_iban_holder: input.ibanHolder,
        p_accept_declaration: input.acceptDeclaration,
        p_accept_consent: input.acceptDocumentConsent,
      }),
    );
  }

  async submitCourierApplication(input: api.CourierApplicationInput) {
    api.validateCourierApplication(input);
    const path = await this.uploadDocument(input.docUri, input.docType, 'ehliyet');
    await this.run(() =>
      this.rpc('submit_courier_application', {
        p_license_class: input.licenseClass,
        p_license_number: input.licenseNumber,
        p_doc_path: path,
        p_doc_type: input.docType,
        p_phone: input.phone,
        p_service_province: input.serviceProvince,
        p_service_districts: input.serviceDistricts,
        p_accept_consent: input.acceptDocumentConsent,
        p_accept_declaration: input.acceptDeclaration,
      }),
    );
  }

  async updateCourierProfile(patch: api.CourierUpdate) {
    await this.run(() =>
      this.rpc('update_courier_profile', {
        p_available: patch.available ?? null,
        p_service_districts: patch.serviceDistricts ?? null,
        p_phone: patch.phone ?? null,
      }),
    );
  }

  async documentUrl(v: Verification) {
    const { data, error } = await this.sb.storage.from(DOCUMENT_BUCKET).createSignedUrl(v.docUri, 300);
    if (error || !data) throw new api.ApiError('Belge açılamadı. Yetkin olmayabilir veya dosya silinmiş olabilir.');
    return data.signedUrl;
  }

  /* ---------- İlanlar ---------- */

  async saveListing(input: api.ListingInput, listingId?: string) {
    api.validateListing(input);
    const images = await this.uploadPhotos(input.images);
    const row = await this.run(() =>
      this.rpc<Row>('save_listing', {
        p_id: listingId ?? null,
        p_title: input.title,
        p_description: input.description,
        p_price: input.price,
        p_category: input.category,
        p_images: images,
        p_prep_time: input.prepTime,
        p_delivery: input.delivery,
        p_shipping_payer: input.shippingPayer,
        p_status: input.status,
      }),
    );
    return toListing(row);
  }

  async setListingStatus(listingId: string, status: Listing['status']) {
    await this.run(() => this.rpc('set_listing_status', { p_id: listingId, p_status: status }));
  }

  async deleteListing(listingId: string) {
    await this.run(() => this.rpc('delete_listing', { p_id: listingId }));
  }

  /* ---------- Siparişler ve mesajlar ---------- */

  async createOrder(input: api.OrderInput) {
    const listing = this.db.listings.find((l) => l.id === input.listingId);
    const row = await this.run(() =>
      this.rpc<Row>('create_order', {
        p_listing_id: input.listingId,
        p_quantity: input.quantity,
        p_appointment: input.appointment,
        p_delivery: input.delivery,
        p_address: input.address,
        p_note: input.note,
        p_first_message: api.firstOrderMessage(listing?.title ?? 'ilan', input),
      }),
    );
    return toOrder(row);
  }

  async orderAction(orderId: string, action: api.OrderAction, note?: string) {
    if (action === 'refund') return this.adminRefundOrder(orderId, note ?? '');
    await this.run(() => this.rpc('order_action', { p_order_id: orderId, p_action: action, p_note: note ?? null }));
  }

  async setShipment(orderId: string, company: string, trackingCode: string) {
    await this.run(() => this.rpc('set_shipment', { p_order_id: orderId, p_company: company, p_tracking: trackingCode }));
  }

  /**
   * iyzico ortak ödeme sayfasını açar. Mobilde uygulama içi tarayıcıda açılır ve ödeme sonrası
   * lezzethub://payment-result adresine dönülür; web'de sayfa ödeme ekranına yönlendirilir.
   */
  async payOnline(orderId: string): Promise<PaymentOutcome> {
    this.requireUser();
    const isWeb = Platform.OS === 'web';
    const returnUrl = isWeb ? `${window.location.origin}/payment-result` : Linking.createURL('payment-result');
    const { data, error } = await this.sb.functions.invoke('payments-create', { body: { orderId, returnUrl } });
    if (error) await functionError(error);
    const pageUrl = String(data?.paymentPageUrl ?? '');
    if (!/^https:\/\//.test(pageUrl)) throw new api.ApiError('Ödeme sayfası açılamadı. Lütfen tekrar dene.');
    if (isWeb) {
      window.location.assign(pageUrl);
      return { status: 'redirected', message: 'Ödeme sayfasına yönlendiriliyorsun…' };
    }
    const result = await WebBrowser.openAuthSessionAsync(pageUrl, returnUrl);
    await this.refresh();
    if (result.type !== 'success') {
      const order = this.db.orders.find((o) => o.id === orderId);
      return order?.status === 'paid'
        ? { status: 'success', message: 'Ödemen alındı. Afiyet olsun!' }
        : { status: 'cancelled', message: 'Ödeme tamamlanmadı. İstediğin zaman tekrar deneyebilirsin.' };
    }
    const params = Linking.parse(result.url).queryParams ?? {};
    const ok = params.status === 'success';
    return { status: ok ? 'success' : 'failure', message: String(params.message ?? (ok ? 'Ödemen alındı.' : 'Ödeme tamamlanamadı.')) };
  }

  async sendMessage(orderId: string, text: string) {
    await this.run(() => this.rpc('send_message', { p_order_id: orderId, p_text: text }));
  }

  async markChatRead(orderId: string) {
    const me = this.userId;
    if (!me) return;
    const unread =
      this.db.messages.some((m) => m.orderId === orderId && m.receiverId === me && !m.read) ||
      this.db.notifications.some((n) => n.orderId === orderId && !n.read && n.title.startsWith(api.MESSAGE_PREFIX));
    if (unread) await this.run(() => this.rpc('mark_chat_read', { p_order_id: orderId }));
  }

  async markNotificationsRead() {
    if (this.db.notifications.some((n) => !n.read)) await this.run(() => this.rpc('mark_notifications_read'));
  }

  /* ---------- Şikayet ve engelleme ---------- */

  async report(input: api.ReportInput) {
    await this.run(() =>
      this.rpc('report_content', { p_target_type: input.targetType, p_target_id: input.targetId, p_reason: input.reason, p_note: input.note }),
    );
  }

  async blockUser(userId: string) {
    await this.run(() => this.rpc('block_user', { p_user_id: userId }));
  }

  async unblockUser(userId: string) {
    await this.run(() => this.rpc('unblock_user', { p_user_id: userId }));
  }

  /* ---------- Admin ---------- */

  async adminSetUserActive(userId: string, active: boolean) {
    await this.run(() => this.rpc('admin_set_user_active', { p_user_id: userId, p_active: active }));
  }

  async adminSetUserRole(userId: string, role: User['role']) {
    await this.run(() => this.rpc('admin_set_user_role', { p_user_id: userId, p_role: role }));
  }

  async adminDeleteUser(userId: string) {
    await this.run(() => this.rpc('admin_delete_user', { p_user_id: userId }));
  }

  async adminResolveReport(reportId: string) {
    await this.run(() => this.rpc('resolve_report', { p_report_id: reportId }));
  }

  async adminReviewVerification(verificationId: string, approve: boolean, note: string) {
    await this.run(() => this.rpc('review_verification', { p_id: verificationId, p_approve: approve, p_note: note }));
  }

  async adminRefundOrder(orderId: string, note: string) {
    const { error } = await this.sb.functions.invoke('payments-refund', { body: { orderId, note } });
    if (error) await functionError(error);
    await this.refresh();
  }

  async adminMarkPayout(orderIds: string[]) {
    await this.run(() => this.rpc('admin_mark_payout', { p_order_ids: orderIds }));
  }
}
