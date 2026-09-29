// Online ödeme akışı (Edge Function'lardan bağımsız, test edilebilir çekirdek).
//  1) payments-create : alıcı onaylanmış sipariş için iyzico ödeme sayfası açar.
//  2) payments-callback: iyzico sonucu sunucudan sunucuya doğrular, siparişi "ödendi" yapar.
//  3) payments-refund : admin, ödenmiş siparişi karta iade eder.
// Veritabanı değişiklikleri yalnızca schema.sql'deki payment_* fonksiyonlarıyla yapılır.

import { formatPrice, type IyzicoClient } from './iyzico.ts';

export class PaymentError extends Error {}

export type PaymentDb = {
  /** Supabase RPC; hata durumunda mesajıyla Error fırlatır. */
  rpc(name: string, args: Record<string, unknown>): Promise<any>;
  paymentByToken(token: string): Promise<{ order_id: string; amount: number | string; status: string } | null>;
};

export type PaymentOptions = {
  /** iyzico yanıt imzalarını doğrula (varsayılan açık). */
  verifySignatures?: boolean;
  /** iyzico alıcı TCKN alanı zorunludur; kimlik toplanmıyorsa iyzico'nun kabul ettiği varsayılan değer. */
  defaultIdentityNumber?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const iyziDate = (iso: string | undefined) => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

export type PreparedPayment = {
  order: Record<string, any>;
  buyer: Record<string, any>;
  buyerPrivate: Record<string, any> | null;
};

export function buildInitializeBody(
  prep: PreparedPayment,
  opts: { conversationId: string; callbackUrl: string; ip: string; identityNumber: string },
) {
  const { order: o, buyer: b } = prep;
  const bp = prep.buyerPrivate ?? {};
  const subtotal = Number(o.subtotal);
  const fee = Number(o.buyer_fee);
  const total = Number(o.buyer_total);
  if (round2(subtotal + fee) !== round2(total)) throw new PaymentError('Sipariş tutarı tutarsız.');

  const parts = String(b.name).trim().split(/\s+/);
  const name = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const homeAddress = String(bp.address ?? '').trim() || `${b.neighborhood} Mah., ${b.district}/${b.province}`;
  const deliveryAddress = String(o.address ?? '').trim() || homeAddress;
  const phone = String(bp.phone ?? '');

  const basketItems: Record<string, string>[] = [
    { id: `${o.id}-urun`, name: String(o.listing_title).slice(0, 100), category1: 'Yemek', category2: 'Ev Yemeği', itemType: 'PHYSICAL', price: formatPrice(subtotal) },
  ];
  if (fee > 0) {
    basketItems.push({ id: `${o.id}-hizmet`, name: 'LezzetHub hizmet bedeli', category1: 'Hizmet', category2: 'Platform', itemType: 'VIRTUAL', price: formatPrice(fee) });
  }

  return {
    locale: 'tr',
    conversationId: opts.conversationId,
    price: formatPrice(round2(subtotal + fee)),
    paidPrice: formatPrice(total),
    currency: 'TRY',
    basketId: String(o.id),
    paymentGroup: 'PRODUCT',
    callbackUrl: opts.callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: String(b.id),
      name,
      surname,
      identityNumber: opts.identityNumber,
      email: String(bp.email ?? ''),
      ...(phone ? { gsmNumber: '+90' + phone.slice(1) } : {}),
      registrationDate: iyziDate(b.created_at),
      lastLoginDate: iyziDate(undefined),
      registrationAddress: homeAddress,
      ip: opts.ip,
      city: String(b.province),
      country: 'Turkey',
    },
    shippingAddress: { contactName: String(b.name), city: String(b.province), country: 'Turkey', address: deliveryAddress },
    billingAddress: { contactName: String(b.name), city: String(b.province), country: 'Turkey', address: homeAddress },
    basketItems,
  };
}

export async function createCheckout(
  db: PaymentDb,
  iyzico: IyzicoClient,
  input: { orderId: string; userId: string; ip: string; callbackUrl: string },
  opts: PaymentOptions = {},
) {
  const prep = (await db.rpc('payment_prepare', { p_order_id: input.orderId, p_user: input.userId })) as PreparedPayment;
  const conversationId = crypto.randomUUID();
  const body = buildInitializeBody(prep, {
    conversationId,
    callbackUrl: input.callbackUrl,
    ip: input.ip,
    identityNumber: opts.defaultIdentityNumber ?? '11111111111',
  });
  const res = await iyzico.initialize(body);
  if (res.status !== 'success' || !res.token || !res.paymentPageUrl) {
    throw new PaymentError(res.errorMessage ? `Ödeme başlatılamadı: ${res.errorMessage}` : 'Ödeme başlatılamadı. Lütfen tekrar deneyin.');
  }
  if (opts.verifySignatures !== false && !(await iyzico.verify([res.conversationId, res.token], res.signature))) {
    throw new PaymentError('Ödeme sağlayıcısının yanıtı doğrulanamadı.');
  }
  await db.rpc('payment_record_pending', { p_order_id: input.orderId, p_token: res.token, p_amount: Number(prep.order.buyer_total) });
  return { token: String(res.token), paymentPageUrl: String(res.paymentPageUrl) };
}

export type CallbackResult = { ok: boolean; orderId?: string; message: string };

export async function handleCallback(db: PaymentDb, iyzico: IyzicoClient, token: string, opts: PaymentOptions = {}): Promise<CallbackResult> {
  if (!token) return { ok: false, message: 'Geçersiz ödeme dönüşü.' };
  const payment = await db.paymentByToken(token);
  if (!payment) return { ok: false, message: 'Ödeme kaydı bulunamadı.' };
  if (payment.status === 'succeeded') return { ok: true, orderId: payment.order_id, message: 'Ödemen zaten alındı.' };

  const fail = async (message: string): Promise<CallbackResult> => {
    await db.rpc('payment_fail', { p_token: token, p_error: message });
    return { ok: false, orderId: payment.order_id, message };
  };

  const res = await iyzico.retrieve(token);
  if (res.status !== 'success') return fail(res.errorMessage || 'Ödeme sonucu alınamadı.');
  if (opts.verifySignatures !== false) {
    // Fiyat alanları iyzico tarafında "396.0" ya da "396" biçiminde imzalanabilir; ikisi de kabul edilir.
    const variants = [formatPrice, (n: number) => String(n)].map((f) => [
      res.paymentStatus, res.paymentId, res.currency, res.basketId, res.conversationId,
      f(Number(res.paidPrice)), f(Number(res.price)), res.token,
    ]);
    let verified = false;
    for (const v of variants) if (await iyzico.verify(v, res.signature)) verified = true;
    if (!verified) return fail('Ödeme sağlayıcısının yanıtı doğrulanamadı.');
  }
  if (res.paymentStatus !== 'SUCCESS') return fail(res.errorMessage || 'Ödeme tamamlanmadı.');
  if (String(res.basketId) !== String(payment.order_id)) return fail('Ödeme bu siparişe ait değil.');

  const orderId = await db.rpc('payment_confirm', {
    p_token: token,
    p_payment_id: String(res.paymentId),
    p_transaction_id: res.itemTransactions?.[0]?.paymentTransactionId ? String(res.itemTransactions[0].paymentTransactionId) : null,
    p_paid_price: Number(res.paidPrice),
    p_last4: res.lastFourDigits ?? null,
    p_association: res.cardAssociation ?? null,
  });
  if (!orderId) return { ok: false, orderId: payment.order_id, message: 'Ödeme tutarı sipariş tutarıyla uyuşmuyor; destek ekibimiz iade edecek.' };
  return { ok: true, orderId: String(orderId), message: 'Ödemen alındı. Afiyet olsun!' };
}

export async function refundOrder(
  db: PaymentDb,
  iyzico: IyzicoClient,
  input: { orderId: string; adminId: string; note: string; ip: string },
) {
  const p = await db.rpc('payment_for_refund', { p_order_id: input.orderId, p_admin: input.adminId });
  const payment = Array.isArray(p) ? p[0] : p;
  if (payment.provider === 'iyzico') {
    if (!payment.provider_payment_id) throw new PaymentError('Ödeme numarası bulunamadı.');
    const res = await iyzico.refund({ paymentId: String(payment.provider_payment_id), price: Number(payment.amount), ip: input.ip, conversationId: String(payment.id) });
    if (res.status !== 'success') throw new PaymentError(res.errorMessage ? `İade yapılamadı: ${res.errorMessage}` : 'İade yapılamadı.');
  }
  await db.rpc('payment_mark_refunded', { p_payment_id: payment.id, p_admin: input.adminId, p_note: input.note });
  return { ok: true };
}

/** Açık yönlendirmeyi engellemek için dönüş adresi yalnızca izinli öneklerden biri olabilir. */
export function isAllowedReturnUrl(url: string, allowedPrefixes: string[]) {
  if (!url || /[\s"'<>]/.test(url)) return false;
  return allowedPrefixes.some((p) => p && url.startsWith(p));
}

export function withParams(url: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return url + (url.includes('?') ? '&' : '?') + qs;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ödeme sonrası kullanıcıyı uygulamaya geri gönderen küçük sayfa. */
export function callbackPage(target: string | null, result: CallbackResult) {
  const title = result.ok ? 'Ödeme başarılı' : 'Ödeme tamamlanamadı';
  const redirect = target
    ? `<meta http-equiv="refresh" content="0;url=${esc(target)}"><script>location.replace(${JSON.stringify(target)})</script>`
    : '';
  const link = target ? `<p><a href="${esc(target)}">Uygulamaya dön</a></p>` : '<p>Bu pencereyi kapatıp uygulamaya dönebilirsin.</p>';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${redirect}
<style>body{font-family:system-ui,sans-serif;background:#FBF7F0;color:#2B2A28;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{max-width:420px;padding:24px;text-align:center}h1{color:${result.ok ? '#1F5E57' : '#B3261E'}}a{color:#1F5E57;font-weight:600}</style></head>
<body><main><h1>${title}</h1><p>${esc(result.message)}</p>${link}</main></body></html>`;
}
