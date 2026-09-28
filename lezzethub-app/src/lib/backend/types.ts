import type * as api from '../api';
import type { DB, Listing, Order, User } from '../types';

export type ProfileUpdate = api.ProfileInput;

export interface RegisterResult {
  /** Oturum açıldıysa kullanıcı; e-posta doğrulaması bekleniyorsa null. */
  user: User | null;
  needsEmailConfirmation: boolean;
}

/**
 * Uygulamanın veri kaynağı. İki uygulaması var:
 * - LocalBackend: tüm veri cihazda (demo / geliştirme).
 * - SupabaseBackend: veri sunucuda, kurallar sunucu fonksiyonlarında (canlı).
 * Arayüz her zaman `snapshot()` ile gelen DB görüntüsünü okur; değişiklikler bu metotlarla yapılır.
 */
export interface Backend {
  readonly mode: 'local' | 'remote';
  init(): Promise<void>;
  snapshot(): DB;
  sessionUserId(): string | null;
  /** Veri veya oturum değiştiğinde çağrılır. Aboneliği kaldıran fonksiyon döner. */
  subscribe(listener: () => void): () => void;
  /** Sunucudan verileri yeniden çeker (yerel modda işlem yapmaz). */
  refresh(): Promise<void>;

  login(email: string, password: string): Promise<User>;
  register(input: api.RegisterInput): Promise<RegisterResult>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** E-posta doğrulama / şifre sıfırlama bağlantısıyla uygulama açıldığında oturumu kurar. */
  handleAuthRedirect(url: string): Promise<void>;
  /** Şifre sıfırlama bağlantısıyla gelindiyse bir kez true döner (yeni şifre ekranına yönlendirmek için). */
  consumePasswordRecovery(): boolean;
  /** Şifre sıfırlama bağlantısıyla açılan oturumda yeni şifre belirler. */
  completePasswordReset(newPassword: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(): Promise<void>;
  updateProfile(input: ProfileUpdate): Promise<void>;

  saveListing(input: api.ListingInput, listingId?: string): Promise<Listing>;
  setListingStatus(listingId: string, status: Listing['status']): Promise<void>;
  deleteListing(listingId: string): Promise<void>;

  createOrder(input: api.OrderInput): Promise<Order>;
  orderAction(orderId: string, action: api.OrderAction, note?: string): Promise<void>;
  sendMessage(orderId: string, text: string): Promise<void>;
  markChatRead(orderId: string): Promise<void>;
  markNotificationsRead(): Promise<void>;

  report(input: api.ReportInput): Promise<void>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;

  adminSetUserActive(userId: string, active: boolean): Promise<void>;
  adminSetUserRole(userId: string, role: User['role']): Promise<void>;
  adminDeleteUser(userId: string): Promise<void>;
  adminResolveReport(reportId: string): Promise<void>;

  /** Yalnızca yerel modda: demo verilerini başlangıç haline döndürür. */
  resetDemo?(): Promise<void>;
}
