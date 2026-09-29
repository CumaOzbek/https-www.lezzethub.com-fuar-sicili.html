// POST { orderId, note } — yalnızca admin. Ödenmiş siparişin tutarını karta iade eder ve siparişi iptal eder.
import { adminClient, clientIp, corsHeaders, errorMessage, iyzico, json, paymentDb, requestUser } from '../_shared/env.ts';
import { refundOrder } from '../_shared/payment-core.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Yalnızca POST.' }, 405);
  const sb = adminClient();
  const user = await requestUser(req, sb);
  if (!user) return json({ error: 'Bu işlem için giriş yapmalısın.' }, 401);
  try {
    const { orderId, note } = await req.json();
    await refundOrder(paymentDb(sb), iyzico(), { orderId: String(orderId ?? ''), adminId: user.id, note: String(note ?? ''), ip: clientIp(req) });
    return json({ ok: true });
  } catch (e) {
    return json({ error: errorMessage(e) }, 400);
  }
});
