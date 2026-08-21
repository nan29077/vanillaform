// 셀러 상품 신청의 "승인 주체"를 판단하는 공용 로직.
//
// 승인 주체 규칙:
//  1) 상품을 중간관리자가 직접 등록(product.middleAdminId 존재) → 중간관리자
//  2) 브랜드사 상품이고 그 브랜드가 중간관리자 소속(brand.middleAdminId 존재) → 중간관리자
//     (중간관리자가 마진을 더해 등록했으므로)
//  3) 브랜드사 상품이지만 독립 브랜드(brand.middleAdminId 없음) → 브랜드사 직접
//  4) 그 외(브랜드/중간관리자 없음 = 최고관리자 등록) → 최고관리자
export type ApproverType = "SUPER_ADMIN" | "MIDDLE_ADMIN" | "BRAND_ADMIN";

export function resolveApprover(input: {
  productMiddleAdminId: string | null;
  productBrandId: string | null;
  brandMiddleAdminId: string | null;
}): { approverType: ApproverType; approverId: string | null } {
  if (input.productMiddleAdminId) {
    return { approverType: "MIDDLE_ADMIN", approverId: input.productMiddleAdminId };
  }
  if (input.productBrandId) {
    if (input.brandMiddleAdminId) {
      return { approverType: "MIDDLE_ADMIN", approverId: input.brandMiddleAdminId };
    }
    return { approverType: "BRAND_ADMIN", approverId: input.productBrandId };
  }
  return { approverType: "SUPER_ADMIN", approverId: null };
}
