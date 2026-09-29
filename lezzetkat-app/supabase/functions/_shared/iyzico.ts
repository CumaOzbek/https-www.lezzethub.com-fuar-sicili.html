// iyzico REST istemcisi (Checkout Form / Ortak Ödeme Sayfası).
// Yalnızca Web API'leri (fetch, crypto.subtle) kullanır: Supabase Edge (Deno) ve Node 18+ üzerinde çalışır.
// İmzalama resmi iyzipay-node kütüphanesiyle aynıdır (IYZWSv2); tests/payments.test.ts ile doğrulanır.

export type IyzicoConfig = { apiKey: string; secretKey: string; baseUrl: string };

export const IYZICO_SANDBOX_URL = 'https://sandbox-api.iyzipay.com';

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(s: string) {
  const bytes = enc.encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function hmacSha256Hex(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Sabit zamanlı karşılaştırma. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Date.now().toString() + toHex(bytes.buffer);
}

/** iyzipay utils.formatPrice ile aynı: 396 → "396.0", 12.5 → "12.5". */
export function formatPrice(n: number) {
  const s = parseFloat(String(n)).toString();
  return s.includes('.') ? s : s + '.0';
}

export async function authorizationHeader(cfg: IyzicoConfig, uriPath: string, body: unknown, rnd: string) {
  const signature = await hmacSha256Hex(cfg.secretKey, rnd + uriPath + JSON.stringify(body));
  return 'IYZWSv2 ' + toBase64(`apiKey:${cfg.apiKey}&randomKey:${rnd}&signature:${signature}`);
}

/** iyzico yanıt imzası: HMAC-SHA256(secret, alanlar.join(':')). */
export async function verifyResponseSignature(secret: string, params: (string | number | undefined)[], signature?: string) {
  if (!signature) return false;
  const expected = await hmacSha256Hex(secret, params.map((p) => (p === undefined ? '' : String(p))).join(':'));
  return safeEqual(expected, signature);
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ json(): Promise<any> }>;

export async function iyzicoPost(cfg: IyzicoConfig, uriPath: string, body: Record<string, unknown>, fetchImpl: FetchLike = fetch as unknown as FetchLike) {
  const rnd = randomKey();
  const res = await fetchImpl(cfg.baseUrl.replace(/\/$/, '') + uriPath, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-iyzi-rnd': rnd,
      Authorization: await authorizationHeader(cfg, uriPath, body, rnd),
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, any>;
}

export const PATHS = {
  initialize: '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  retrieve: '/payment/iyzipos/checkoutform/auth/ecom/detail',
  refund: '/v2/payment/refund',
} as const;

export type IyzicoClient = {
  initialize(body: Record<string, unknown>): Promise<Record<string, any>>;
  retrieve(token: string, conversationId?: string): Promise<Record<string, any>>;
  refund(body: { paymentId: string; price: number; ip: string; conversationId: string }): Promise<Record<string, any>>;
  verify(params: (string | number | undefined)[], signature?: string): Promise<boolean>;
};

export function createIyzicoClient(cfg: IyzicoConfig, fetchImpl?: FetchLike): IyzicoClient {
  return {
    initialize: (body) => iyzicoPost(cfg, PATHS.initialize, body, fetchImpl),
    retrieve: (token, conversationId) =>
      iyzicoPost(cfg, PATHS.retrieve, { locale: 'tr', conversationId: conversationId ?? token, token }, fetchImpl),
    refund: ({ paymentId, price, ip, conversationId }) =>
      iyzicoPost(cfg, PATHS.refund, { locale: 'tr', conversationId, paymentId, price: formatPrice(price), currency: 'TRY', ip }, fetchImpl),
    verify: (params, signature) => verifyResponseSignature(cfg.secretKey, params, signature),
  };
}
