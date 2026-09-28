// Cihaz içi backend: tüm veri AsyncStorage'da (web'de localStorage) tutulur.
// Demo ve geliştirme içindir; kullanıcılar arasında veri paylaşımı yoktur.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import * as api from '../api';
import { persistLocalPhoto } from '../photos';
import { DB_VERSION, createSeed } from '../seed';
import type { DB, User } from '../types';
import type { Backend, ProfileUpdate, RegisterResult } from './types';

const DB_KEY = 'lezzethub.db';
const SESSION_KEY = 'lezzethub.session';

export const hashPassword = (password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `lezzethub:${password}`);

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Eski sürüm verilerini güncel yapıya taşır; taşınamıyorsa null döner. */
function migrate(raw: unknown): DB | null {
  type LegacyListing = Omit<DB['listings'][number], 'images'> & { images?: string[]; image?: string };
  const d = raw as Omit<Partial<DB>, 'listings'> & { version?: number; listings?: LegacyListing[] };
  if (!d || typeof d !== 'object' || !Array.isArray(d.users)) return null;
  if (d.version === DB_VERSION) return d as unknown as DB;
  if (d.version === 1) {
    return {
      ...(d as unknown as DB),
      version: DB_VERSION,
      listings: (d.listings ?? []).map(({ image, ...l }) => ({ ...l, images: l.images ?? (image ? [image] : []) })),
      reports: [],
      blocks: [],
    };
  }
  return null;
}

export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private db: DB = { version: DB_VERSION, users: [], listings: [], orders: [], messages: [], payments: [], notifications: [], reports: [], blocks: [] };
  private session: string | null = null;
  private listeners = new Set<() => void>();

  async init() {
    let loaded: DB | null = null;
    try {
      const raw = await AsyncStorage.getItem(DB_KEY);
      if (raw) loaded = migrate(JSON.parse(raw));
    } catch {}
    this.db = loaded ?? (await createSeed(hashPassword));
    this.persist();
    try {
      const sid = await AsyncStorage.getItem(SESSION_KEY);
      if (sid && this.db.users.some((u) => u.id === sid && u.active)) this.session = sid;
    } catch {}
  }

  snapshot() {
    return this.db;
  }

  sessionUserId() {
    const u = this.session ? api.getUser(this.db, this.session) : undefined;
    return u?.active ? u.id : null;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async refresh() {}

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    AsyncStorage.setItem(DB_KEY, JSON.stringify(this.db)).catch((e) => console.warn('LezzetHub: veriler kaydedilemedi', e));
  }

  /** DB'nin kopyası üzerinde değişiklik yapar; hata olursa hiçbir şey değişmez. */
  private mutate<T>(fn: (draft: DB) => T): T {
    const draft = clone(this.db);
    const result = fn(draft);
    this.db = draft;
    this.persist();
    this.emit();
    return result;
  }

  private setSession(id: string | null) {
    this.session = id;
    if (id) AsyncStorage.setItem(SESSION_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    this.emit();
  }

  private me(): User {
    const id = this.sessionUserId();
    const u = id ? api.getUser(this.db, id) : undefined;
    if (!u) throw new api.ApiError('Bu işlem için giriş yapmalısın.');
    return u;
  }

  /* ---------- Kimlik ---------- */

  async login(email: string, password: string) {
    const user = api.login(this.db, email, await hashPassword(password));
    this.setSession(user.id);
    return user;
  }

  async register(input: api.RegisterInput): Promise<RegisterResult> {
    api.validateRegister(this.db, input);
    const hash = await hashPassword(input.password);
    const user = this.mutate((d) => api.register(d, input, hash));
    this.setSession(user.id);
    return { user, needsEmailConfirmation: false };
  }

  async logout() {
    this.setSession(null);
  }

  async requestPasswordReset() {
    throw new api.ApiError('Demo modunda şifre sıfırlama e-postası gönderilemez. Demo hesapların şifresi giriş ekranında yazıyor.');
  }

  async handleAuthRedirect() {}

  consumePasswordRecovery() {
    return false;
  }

  async completePasswordReset() {
    throw new api.ApiError('Demo modunda şifre sıfırlama kullanılamaz.');
  }

  async changePassword(current: string, next: string) {
    const me = this.me();
    const [c, n] = await Promise.all([hashPassword(current), hashPassword(next)]);
    this.mutate((d) => api.changePassword(d, me.id, c, n, next.length));
  }

  async deleteAccount() {
    const me = this.me();
    this.mutate((d) => api.deleteAccount(d, me.id));
    this.setSession(null);
  }

  async updateProfile(input: ProfileUpdate) {
    const me = this.me();
    const avatar = input.avatar ? await persistLocalPhoto(input.avatar) : undefined;
    this.mutate((d) => api.updateProfile(d, me.id, { ...input, avatar }));
  }

  /* ---------- İlanlar ---------- */

  async saveListing(input: api.ListingInput, listingId?: string) {
    const me = this.me();
    api.validateListing(input);
    const images = await Promise.all(input.images.map(persistLocalPhoto));
    return this.mutate((d) => api.saveListing(d, me.id, { ...input, images }, listingId));
  }

  async setListingStatus(listingId: string, status: 'active' | 'passive') {
    const me = this.me();
    this.mutate((d) => api.setListingStatus(d, me, listingId, status));
  }

  async deleteListing(listingId: string) {
    const me = this.me();
    this.mutate((d) => api.deleteListing(d, me, listingId));
  }

  /* ---------- Siparişler ve mesajlar ---------- */

  async createOrder(input: api.OrderInput) {
    const me = this.me();
    return this.mutate((d) => api.createOrder(d, me.id, input));
  }

  async orderAction(orderId: string, action: api.OrderAction, note?: string) {
    const me = this.me();
    this.mutate((d) => api.orderAction(d, me, orderId, action, note));
  }

  async sendMessage(orderId: string, text: string) {
    const me = this.me();
    this.mutate((d) => api.sendMessage(d, me.id, orderId, text));
  }

  async markChatRead(orderId: string) {
    const id = this.sessionUserId();
    if (!id) return;
    // Değişiklik yoksa yazma ve yeniden çizim yapma.
    if (!api.markChatRead(clone(this.db), id, orderId)) return;
    this.mutate((d) => api.markChatRead(d, id, orderId));
  }

  async markNotificationsRead() {
    const id = this.sessionUserId();
    if (!id || !this.db.notifications.some((n) => n.userId === id && !n.read)) return;
    this.mutate((d) => api.markNotificationsRead(d, id));
  }

  /* ---------- Şikayet ve engelleme ---------- */

  async report(input: api.ReportInput) {
    const me = this.me();
    this.mutate((d) => api.reportContent(d, me.id, input));
  }

  async blockUser(userId: string) {
    const me = this.me();
    this.mutate((d) => api.blockUser(d, me.id, userId));
  }

  async unblockUser(userId: string) {
    const me = this.me();
    this.mutate((d) => api.unblockUser(d, me.id, userId));
  }

  /* ---------- Admin ---------- */

  async adminSetUserActive(userId: string, active: boolean) {
    const me = this.me();
    this.mutate((d) => api.setUserActive(d, me, userId, active));
  }

  async adminSetUserRole(userId: string, role: User['role']) {
    const me = this.me();
    this.mutate((d) => api.setUserRole(d, me, userId, role));
  }

  async adminDeleteUser(userId: string) {
    const me = this.me();
    this.mutate((d) => api.deleteUser(d, me, userId));
  }

  async adminResolveReport(reportId: string) {
    const me = this.me();
    this.mutate((d) => api.resolveReport(d, me, reportId));
  }

  async resetDemo() {
    this.db = await createSeed(hashPassword);
    this.persist();
    this.setSession(null);
  }
}
