// Edge Function ortak yardımcıları (Deno). Gizli anahtarlar: supabase secrets set ... (bkz. README).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { createIyzicoClient, IYZICO_SANDBOX_URL } from './iyzico.ts';
import { PaymentError, type PaymentDb, type PaymentOptions } from './payment-core.ts';

export const env = (k: string, fallback = '') => Deno.env.get(k) ?? fallback;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

/** İsteği yapan kullanıcının kimliği (Authorization: Bearer <jwt>). */
export async function requestUser(req: Request, sb: SupabaseClient) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await sb.auth.getUser(jwt);
  return error ? null : data.user;
}

export function paymentDb(sb: SupabaseClient): PaymentDb {
  return {
    async rpc(name, args) {
      const { data, error } = await sb.rpc(name, args);
      if (error) throw new PaymentError(error.message);
      return data;
    },
    async paymentByToken(token) {
      const { data, error } = await sb.from('payments').select('order_id, amount, status').eq('provider_token', token).maybeSingle();
      if (error) throw new PaymentError(error.message);
      return data;
    },
  };
}

export function iyzico() {
  const apiKey = env('IYZICO_API_KEY');
  const secretKey = env('IYZICO_SECRET_KEY');
  if (!apiKey || !secretKey) throw new PaymentError('Ödeme altyapısı yapılandırılmamış (IYZICO_API_KEY / IYZICO_SECRET_KEY).');
  return createIyzicoClient({ apiKey, secretKey, baseUrl: env('IYZICO_BASE_URL', IYZICO_SANDBOX_URL) });
}

export const paymentOptions = (): PaymentOptions => ({
  verifySignatures: env('IYZICO_VERIFY_SIGNATURE', 'true') !== 'false',
  defaultIdentityNumber: env('IYZICO_DEFAULT_IDENTITY_NUMBER', '11111111111'),
});

/** Uygulamaya dönüş için izinli adres önekleri. */
export const allowedReturnPrefixes = () =>
  env('APP_RETURN_URLS', 'lezzetkat://,exp://').split(',').map((s) => s.trim()).filter(Boolean);

export const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '85.34.78.112';

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu.');
