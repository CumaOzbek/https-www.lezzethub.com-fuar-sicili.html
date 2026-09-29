import type { PaymentMethod } from './types';

/** Alıcıdan ürün tutarına eklenen hizmet bedeli oranı. */
export const BUYER_FEE_RATE = 0.1;
/** Satıcının tutarından düşülen hizmet bedeli oranı. */
export const SELLER_FEE_RATE = 0.15;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface Breakdown {
  subtotal: number;
  buyerFee: number;
  sellerFee: number;
  buyerTotal: number;
  sellerNet: number;
  platformRevenue: number;
}

/** Teslimatta ödemede (pilot mod) platform para almadığı için hizmet bedeli yoktur. */
export function calcBreakdown(unitPrice: number, quantity: number, method: PaymentMethod = 'online'): Breakdown {
  const subtotal = round2(unitPrice * quantity);
  const free = method === 'on_delivery';
  const buyerFee = free ? 0 : round2(subtotal * BUYER_FEE_RATE);
  const sellerFee = free ? 0 : round2(subtotal * SELLER_FEE_RATE);
  return {
    subtotal,
    buyerFee,
    sellerFee,
    buyerTotal: round2(subtotal + buyerFee),
    sellerNet: round2(subtotal - sellerFee),
    platformRevenue: round2(buyerFee + sellerFee),
  };
}
