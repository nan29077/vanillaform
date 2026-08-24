import DOMPurify from "isomorphic-dompurify";

/**
 * 저장된 HTML(상품 상세, 리뷰, 고객센터 문서 등)을 `dangerouslySetInnerHTML` 로
 * 렌더하기 전에 반드시 통과시키는 새니타이저.
 *
 * 왜 필요한가 —
 *   상품 상세(detailContent)는 브랜드/셀러/중간관리자가 textarea 에 **HTML 원문을 그대로**
 *   입력하는 구조다. 검사 없이 innerHTML 로 넣으면 `<script>`·`onerror=`·`javascript:` 가
 *   그대로 실행되어, 상품 페이지를 보는 모든 구매자의 세션에서 임의 코드가 돌아간다(저장형 XSS).
 *
 * 정책 —
 *   DOMPurify 기본 허용 목록을 유지해 기존 서식(굵게/제목/목록/이미지/표/인라인 style)이
 *   깨지지 않게 하고, 실행 가능한 요소만 걷어낸다.
 *   - iframe 은 유튜브 등 영상 삽입에 쓰이므로 태그는 허용하되 srcdoc 은 차단한다.
 *     (cross-origin iframe 은 부모 문서를 스크립팅할 수 없다)
 *   - `<script>`, `<style>`, `<form>`/입력 요소, `<object>`/`<embed>` 는 제거한다.
 *   - `on*` 이벤트 핸들러와 `javascript:` URI 는 DOMPurify 가 기본으로 제거한다.
 *
 * isomorphic-dompurify 를 쓰는 이유: 클라이언트 컴포넌트도 Next.js 가 서버에서 한 번
 * 렌더하므로(SSR), 브라우저 DOM 이 없는 환경에서도 동작해야 한다.
 */
const CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target", "loading"],
  FORBID_TAGS: [
    "script",
    "style",
    "form",
    "input",
    "textarea",
    "button",
    "select",
    "option",
    "object",
    "embed",
    "link",
    "meta",
    "base",
  ],
  FORBID_ATTR: ["srcdoc", "formaction", "xlink:href", "ping"],
} as const;

/** 신뢰할 수 없는 HTML 문자열을 안전한 HTML 로 정제한다. null/undefined 는 빈 문자열. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(String(html), CONFIG as any) as unknown as string;
}
