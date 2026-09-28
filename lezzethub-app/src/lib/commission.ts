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

export function calcBreakdown(unitPrice: number, quantity: number): Breakdown {
  const subtotal = round2(unitPrice * quantity);
  const buyerFee = round2(subtotal * BUYER_FEE_RATE);
  const sellerFee = round2(subtotal * SELLER_FEE_RATE);
  return {
    subtotal,
    buyerFee,
    sellerFee,
    buyerTotal: round2(subtotal + buyerFee),
    sellerNet: round2(subtotal - sellerFee),
    platformRevenue: round2(buyerFee + sellerFee),
  };
}
