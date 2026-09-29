// POST { orderId, returnUrl } → { paymentPageUrl, token }
// Alıcı, satıcının onayladığı sipariş için iyzico ortak ödeme sayfasını açar.
import { allowedReturnPrefixes, adminClient, clientIp, corsHeaders, env, errorMessage, iyzico, json, paymentDb, paymentOptions, requestUser } from '../_shared/env.ts';
import { createCheckout, isAllowedReturnUrl } from '../_shared/payment-core.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Yalnızca POST.' }, 405);
  const sb = adminClient();
  const user = await requestUser(req, sb);
  if (!user) return json({ error: 'Bu işlem için giriş yapmalısın.' }, 401);
  try {
    const { orderId, returnUrl } = await req.json();
    if (typeof orderId !== 'string' || !orderId) return json({ error: 'Sipariş bulunamadı.' }, 400);
    if (!isAllowedReturnUrl(String(returnUrl ?? ''), allowedReturnPrefixes())) return json({ error: 'Geçersiz dönüş adresi.' }, 400);
    const callbackUrl = `${env('SUPABASE_URL')}/functions/v1/payments-callback?return=${encodeURIComponent(returnUrl)}`;
    const result = await createCheckout(paymentDb(sb), iyzico(), { orderId, userId: user.id, ip: clientIp(req), callbackUrl }, paymentOptions());
    return json(result);
  } catch (e) {
    return json({ error: errorMessage(e) }, 400);
  }
});
