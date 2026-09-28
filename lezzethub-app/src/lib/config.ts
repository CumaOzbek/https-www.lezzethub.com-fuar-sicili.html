// Ortam ayarları. EXPO_PUBLIC_ ile başlayan değişkenler derleme sırasında uygulamaya gömülür
// (.env dosyası veya EAS ortam değişkenleri). Supabase ayarı yoksa uygulama cihaz içi demo modunda çalışır.

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Canlı mod: Supabase yapılandırıldıysa veriler sunucuda tutulur ve tüm kullanıcılar arasında paylaşılır. */
export const IS_REMOTE = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** Paylaşılan ilan bağlantılarının kök adresi (web sürümünün yayınlandığı alan adı). */
export const SHARE_BASE_URL = (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://www.lezzethub.com').replace(/\/$/, '');

/** Destek ve KVKK başvuruları için iletişim adresi. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'destek@lezzethub.com';

/** Supabase Storage'daki fotoğraf kovasının adı. */
export const PHOTO_BUCKET = 'photos';
