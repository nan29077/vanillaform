/**
 * 배송비 계산 (단일 출처)
 *
 * 상품별 배송 설정을 기준으로 계산한다.
 * - 무료배송(freeShipping)이면 0
 * - 무료배송 기준금액(freeShippingThreshold)이 있고 주문 소계가 그 이상이면 0
 * - 그 외에는 상품 배송료(shippingFee)
 *
 * 도서산간 추가배송비(remoteAreaFee)는 주소가 도서산간일 때만 별도로 더한다(여기서는 포함하지 않음).
 */
export interface ProductShipping {
  shippingFee: number;
  freeShipping: boolean;
  freeShippingThreshold: number | null;
}

// 단일 상품의 배송비
export function computeProductShipping(
  product: ProductShipping,
  subtotal: number
): number {
  if (product.freeShipping) return 0;
  if (
    product.freeShippingThreshold != null &&
    subtotal >= product.freeShippingThreshold
  ) {
    return 0;
  }
  const fee = Number(product.shippingFee);
  return isNaN(fee) || fee < 0 ? 0 : fee;
}

// 여러 상품(묶음배송): 상품별 배송비 중 최댓값을 한 번만 부과
export function computeOrderShipping(
  products: ProductShipping[],
  subtotal: number
): number {
  let fee = 0;
  for (const p of products) {
    fee = Math.max(fee, computeProductShipping(p, subtotal));
  }
  return fee;
}
