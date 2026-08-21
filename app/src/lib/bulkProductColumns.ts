// ─────────────────────────────────────────────
// 상품 대량 등록(엑셀) 공용 컬럼 정의
// 클라이언트(템플릿 생성)와 서버(파싱/검증)가 이 정의를 함께 사용해 컬럼 스키마를 동기화한다.
// 프레임워크(React/Prisma) 비의존 — 순수 데이터/함수만 둔다.
// ─────────────────────────────────────────────

export type BulkMode = "admin" | "brand" | "seller" | "middle";

// 대량 등록 제공 방식: 공급가 제공(기존) / 수수료 제공
export type PriceType = "SUPPLY_PRICE" | "COMMISSION";

export interface BulkColumn {
  /** 내부 식별 키 (파싱 결과 객체의 프로퍼티명) */
  key: string;
  /** 엑셀 제목 행에 표시되는 한글 헤더 (전 컬럼 고유해야 함) */
  header: string;
  /** 필수 여부 */
  required?: boolean;
  /** 제목 행 위 안내 행에 표시할 작성법 설명 */
  guide: string;
  /** 예시 값 */
  example: string;
}

// 배지: 한글 라벨 → 코드 (등록 폼과 동일)
export const BADGE_LABEL_TO_CODE: Record<string, string> = {
  무료배송: "FREE_SHIPPING",
  신상품: "NEW",
  베스트: "BEST",
  특가: "HOT_DEAL",
  한정판: "LIMITED",
  핸드메이드: "HANDMADE",
};
export const BADGE_CODES = Object.values(BADGE_LABEL_TO_CODE);

// 모든 모드에서 등장 가능한 컬럼의 마스터 정의 (헤더는 전역적으로 고유)
const NAME: BulkColumn = {
  key: "name",
  header: "상품명",
  required: true,
  guide: "필수. 상품 이름을 입력하세요.",
  example: "(예시) 프리미엄 코튼 티셔츠",
};
const BASE_PRICE: BulkColumn = {
  key: "basePrice",
  header: "판매가(원)",
  required: true,
  guide: "필수. 숫자만 입력 (콤마·원 제외).",
  example: "19900",
};
const SUPPLY_PRICE: BulkColumn = {
  key: "supplyPrice",
  header: "공급가(원)",
  required: true,
  guide: "필수. 숫자만 입력 (콤마·원 제외).",
  example: "12000",
};
// 수수료 방식 전용: 판매가(소비자가)
const CONSUMER_PRICE: BulkColumn = {
  key: "basePrice",
  header: "판매가(소비자가,원)",
  required: true,
  guide: "필수. 소비자가(판매가). 숫자만 입력 (콤마·원 제외).",
  example: "19900",
};
// 수수료 방식 전용: 셀러 수수료율(%)
const SELLER_COMMISSION_RATE: BulkColumn = {
  key: "sellerCommissionRate",
  header: "셀러수수료율(%)",
  required: true,
  guide: "필수. 판매가 대비 셀러에게 지급할 수수료율(%). 숫자만 입력 (예: 10).",
  example: "10",
};
const BRAND_NAME: BulkColumn = {
  key: "brandName",
  header: "브랜드명",
  guide: "선택. 시스템에 등록된 브랜드명과 정확히 일치해야 함. 비우면 미지정.",
  example: "샘플브랜드",
};
const MIDDLE_MARGIN: BulkColumn = {
  key: "middleAdminMargin",
  header: "중간관리자마진(원)",
  guide: "선택. 숫자만 입력. 비우면 미설정.",
  example: "3000",
};
const CATEGORY: BulkColumn = {
  key: "categoryName",
  header: "카테고리",
  guide: "선택. 등록된 카테고리명과 정확히 일치. 비우면 미지정.",
  example: "패션의류",
};
const THUMBNAIL: BulkColumn = {
  key: "thumbnail",
  header: "대표썸네일URL",
  guide: "대표 이미지 1장의 직접 URL. 비우면 추가이미지 첫 장을 사용.",
  example: "https://example.com/img/main.jpg",
};
const IMAGES: BulkColumn = {
  key: "images",
  header: "추가이미지URL(쉼표로구분)",
  guide: "여러 장은 쉼표(,)로 구분. 각 값은 직접 URL이어야 함.",
  example: "https://example.com/1.jpg, https://example.com/2.jpg",
};
const COMPARE_PRICE: BulkColumn = {
  key: "comparePrice",
  header: "정가(비교가격,원)",
  guide: "선택. 할인 전 정가. 숫자만 입력.",
  example: "29900",
};
const STOCK: BulkColumn = {
  key: "stock",
  header: "재고수량",
  guide: "선택. 옵션이 없을 때의 재고. 옵션이 있으면 옵션 재고 합계로 대체됨.",
  example: "100",
};
const OPTIONS: BulkColumn = {
  key: "options",
  header: "옵션(형식:옵션명:판매가:재고;…)",
  guide: "선택. '옵션명:판매가:재고' 형태, 여러 개는 세미콜론(;). 판매가 비우면 상품가 사용.",
  example: "블랙:19900:50;화이트:19900:50",
};
const SHIPPING_FEE: BulkColumn = {
  key: "shippingFee",
  header: "배송비(원)",
  guide: "선택. 숫자만 입력. 비우면 0.",
  example: "3000",
};
const FREE_SHIPPING: BulkColumn = {
  key: "freeShipping",
  header: "무료배송(Y/N)",
  guide: "선택. Y이면 무료배송(배송비 0). 기본 N.",
  example: "N",
};
const FREE_SHIP_THRESHOLD: BulkColumn = {
  key: "freeShippingThreshold",
  header: "무료배송기준금액(원)",
  guide: "선택. 이 금액 이상 구매 시 무료배송. 숫자만.",
  example: "50000",
};
const REMOTE_FEE: BulkColumn = {
  key: "remoteAreaFee",
  header: "도서산간추가비(원)",
  guide: "선택. 숫자만 입력. 비우면 0.",
  example: "3000",
};
const BADGES: BulkColumn = {
  key: "badges",
  header: "배지(쉼표로구분)",
  guide: "선택. 무료배송/신상품/베스트/특가/한정판/핸드메이드 중 쉼표로 구분해 입력.",
  example: "신상품,베스트",
};
const DESCRIPTION: BulkColumn = {
  key: "description",
  header: "간단설명",
  guide: "선택. 상품 요약 설명.",
  example: "부드러운 촉감의 데일리 코튼 티셔츠",
};
const DETAIL: BulkColumn = {
  key: "detailContent",
  header: "상세설명",
  guide: "선택. 상세 설명(텍스트/HTML).",
  example: "소재: 코튼 100% / 색상: 블랙, 화이트",
};

// 모드별 컬럼 구성 (순서 유지)
export function columnsForMode(mode: BulkMode, priceType: PriceType = "SUPPLY_PRICE"): BulkColumn[] {
  // 수수료 제공 방식: 공급가/중간관리자마진 대신 판매가(소비자가) + 셀러수수료율 사용
  const priceCols: BulkColumn[] =
    priceType === "COMMISSION"
      ? mode === "admin"
        ? [CONSUMER_PRICE, SELLER_COMMISSION_RATE, BRAND_NAME]
        : [CONSUMER_PRICE, SELLER_COMMISSION_RATE]
      : mode === "seller"
        ? [BASE_PRICE]
        : mode === "admin"
          ? [SUPPLY_PRICE, BRAND_NAME, MIDDLE_MARGIN]
          : mode === "middle"
            ? [SUPPLY_PRICE, MIDDLE_MARGIN]
            : /* brand */ [SUPPLY_PRICE];

  return [
    NAME,
    ...priceCols,
    CATEGORY,
    THUMBNAIL,
    IMAGES,
    COMPARE_PRICE,
    STOCK,
    OPTIONS,
    SHIPPING_FEE,
    FREE_SHIPPING,
    FREE_SHIP_THRESHOLD,
    REMOTE_FEE,
    BADGES,
    DESCRIPTION,
    DETAIL,
  ];
}

// 셀러 "일반상품(빠른상품)" 대량 등록 전용 컬럼 (DirectProduct 모델 필드)
// - 카테고리·브랜드·옵션·배지가 없는 단순 상품이므로 재고/배송비/설명 안내를 별도로 둔다.
// - 헤더는 위 마스터 컬럼과 동일하게 맞춰 HEADER_TO_KEY 매핑을 그대로 재사용한다.
const DIRECT_STOCK: BulkColumn = {
  key: "stock",
  header: STOCK.header,
  guide: "선택. 재고 수량. 비우면 0.",
  example: "100",
};
const DIRECT_SHIPPING: BulkColumn = {
  key: "shippingFee",
  header: SHIPPING_FEE.header,
  guide: "선택. 숫자만 입력. 비우거나 0이면 무료배송으로 표시됩니다.",
  example: "0",
};
const DIRECT_IMAGES: BulkColumn = {
  key: "images",
  header: IMAGES.header,
  guide: "선택. 대표 이미지부터 순서대로, 여러 장은 쉼표(,)로 구분. 각 값은 직접 URL이어야 함.",
  example: "https://example.com/1.jpg, https://example.com/2.jpg",
};
export const DIRECT_COLUMNS: BulkColumn[] = [
  NAME,
  BASE_PRICE,
  DIRECT_STOCK,
  DIRECT_SHIPPING,
  DIRECT_IMAGES,
  DESCRIPTION,
];

// 헤더(한글) → 내부 키 매핑 (전 모드 컬럼의 합집합). 서버 파싱 시 사용.
const ALL_COLUMNS: BulkColumn[] = [
  NAME,
  BASE_PRICE,
  CONSUMER_PRICE,
  SELLER_COMMISSION_RATE,
  SUPPLY_PRICE,
  BRAND_NAME,
  MIDDLE_MARGIN,
  CATEGORY,
  THUMBNAIL,
  IMAGES,
  COMPARE_PRICE,
  STOCK,
  OPTIONS,
  SHIPPING_FEE,
  FREE_SHIPPING,
  FREE_SHIP_THRESHOLD,
  REMOTE_FEE,
  BADGES,
  DESCRIPTION,
  DETAIL,
];

/** 헤더 문자열을 정규화 (공백 제거) 후 키를 찾는다. */
export function normalizeHeader(h: string): string {
  return String(h ?? "").replace(/\s+/g, "").trim();
}

export const HEADER_TO_KEY: Record<string, string> = ALL_COLUMNS.reduce(
  (acc, c) => {
    acc[normalizeHeader(c.header)] = c.key;
    return acc;
  },
  {} as Record<string, string>
);

/** 제목 행을 식별하는 기준 셀 (이 값과 정확히 일치하는 셀이 있는 행이 헤더 행) */
export const HEADER_MARKER = NAME.header; // "상품명"

/** 예시 행 판별: 상품명이 이 접두사로 시작하면 등록에서 제외 */
export const EXAMPLE_PREFIX = "(예시)";
