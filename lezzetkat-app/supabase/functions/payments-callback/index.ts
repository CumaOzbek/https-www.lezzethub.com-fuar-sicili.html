// iyzico ödeme sonrası bu adrese POST (token) eder. JWT doğrulaması KAPALI dağıtılmalıdır:
//   supabase functions deploy payments-callback --no-verify-jwt
// Sonuç iyzico'dan sunucu tarafında tekrar sorgulanıp imzası doğrulanır; kullanıcı uygulamaya yönlendirilir.
import { allowedReturnPrefixes, adminClient, errorMessage, iyzico, paymentDb, paymentOptions } from '../_shared/env.ts';
import { callbackPage, handleCallback, isAllowedReturnUrl, withParams, type CallbackResult } from '../_shared/payment-core.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const ret = url.searchParams.get('return') ?? '';
  let token = url.searchParams.get('token') ?? '';
  if (req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    token = String(form?.get('token') ?? token);
  }
  let result: CallbackResult;
  try {
    result = await handleCallback(paymentDb(adminClient()), iyzico(), token, paymentOptions());
  } catch (e) {
    result = { ok: false, message: errorMessage(e) };
  }
  const target = isAllowedReturnUrl(ret, allowedReturnPrefixes())
    ? withParams(ret, { status: result.ok ? 'success' : 'failure', order: result.orderId ?? '', message: result.message })
    : null;
  return new Response(callbackPage(target, result), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
