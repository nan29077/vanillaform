import sanitizeHtmlLib from "sanitize-html";

/**
 * 서버 컴포넌트 전용 HTML 새니타이저.
 *
 * 클라이언트 컴포넌트는 `@/lib/sanitize` (isomorphic-dompurify) 를 쓰고,
 * 서버에서만 렌더되는 곳은 브라우저 번들을 늘리지 않도록 sanitize-html 을 쓴다.
 * 허용 범위는 두 쪽을 최대한 맞췄다 — 서식은 유지하고 실행 가능한 요소만 제거.
 */
const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    ...sanitizeHtmlLib.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "h1",
    "h2",
    "iframe",
    "span",
    "del",
    "ins",
    "mark",
    "small",
    "sub",
    "sup",
    "u",
    "s",
  ],
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    "*": ["style", "class", "id", "title", "align"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "alt", "width", "height", "loading"],
    iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "title"],
  },
  // http/https/mailto/tel + data:image 만 허용 — javascript: 스킴 차단
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** 서버에서 렌더할 HTML 문자열을 안전한 HTML 로 정제한다. */
export function sanitizeHtmlServer(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtmlLib(String(html), OPTIONS);
}
