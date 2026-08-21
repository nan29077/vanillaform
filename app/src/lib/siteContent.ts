// 메인페이지 편집 가능한 콘텐츠(숫자/성공스토리/혜택) — 서버 전용.
// Setting 테이블에 JSON 문자열로 저장하고, 값이 없으면 코드 기본값을 사용한다.
// (관리자 "사이트 관리 > 메인페이지 관리"에서 수정)

import { getSettingsMap, setSettings } from "@/lib/settings";

export const HOME_STATS_KEY = "home.stats";
export const HOME_STORIES_KEY = "home.stories";
export const HOME_BENEFITS_KEY = "home.benefits";

export type HomeStat = { value: string; label: string };
export type HomeStory = { name: string; quote: string; metric: string; avatar: string };
export type HomeBenefitStat = { value: string; label: string; sub: string };
export type HomeBenefitItem = { iconType: string; title: string; desc: string };
export type HomeBenefits = { stats: HomeBenefitStat[]; items: HomeBenefitItem[] };

// "숫자로 보는 바닐라폼" 기본값
export const DEFAULT_HOME_STATS: HomeStat[] = [
  { value: "320억+", label: "누적 거래액" },
  { value: "1,200+", label: "활동 라이브 셀러" },
  { value: "48,000+", label: "누적 라이브 방송" },
  { value: "98%", label: "배송 만족도" },
];

// "바닐라폼로 성공한 셀러" 기본값
export const DEFAULT_HOME_STORIES: HomeStory[] = [
  { name: "유나 · 뷰티 라이브 셀러", quote: "취미로 올리던 메이크업이 단골 팬을 만나 매달 안정적인 수입이 됐어요. 라이브로 소통하니 재구매가 확 늘었어요.", metric: "월 매출 1,800만+", avatar: "/avatars/라이브셀러_2.png" },
  { name: "도현 · 리빙 라이브 셀러", quote: "상품 소싱이 제일 막막했는데, 브랜드 상품을 골라 담기만 하면 돼서 시작이 쉬웠어요. 지금은 본업이 됐어요.", metric: "PICK 팬 6.4K", avatar: "/avatars/라이브셀러_5.png" },
  { name: "소연 · 패션 라이브 셀러", quote: "팔로워 1천 명으로 시작했는데, 단골 PICK 구조 덕분에 충성 고객이 빠르게 쌓였어요. 라이브 1회로 완판도 했어요.", metric: "재구매율 71%", avatar: "/avatars/라이브셀러_8.png" },
  { name: "태리 · 스포츠 라이브 셀러", quote: "정산·배송을 신경 안 써도 되니 콘텐츠와 방송에만 집중할 수 있어요. 그게 매출로 바로 이어지더라고요.", metric: "누적 거래 3.2억", avatar: "/avatars/라이브셀러_10.png" },
];

// "바닐라폼로 얻는 것" 기본값
export const DEFAULT_HOME_BENEFITS: HomeBenefits = {
  stats: [
    { value: "68%", label: "단골 재구매율", sub: "PICK 라이브 셀러 기준" },
    { value: "3.2x", label: "라이브 평균 체류", sub: "일반 대비" },
    { value: "1,200+", label: "활동 라이브 셀러", sub: "누적" },
    { value: "4,500+", label: "월 라이브 방송", sub: "플랫폼 합계" },
  ],
  items: [
    { iconType: "heart", title: "단골 PICK으로 충성 고객", desc: "한 번 PICK한 팬이 다시 찾아오는, 관계 기반의 반복 구매." },
    { iconType: "radio", title: "라이브로 실시간 소통", desc: "방송 중 바로 묻고 바로 사는, 몰입도 높은 쇼핑 경험." },
    { iconType: "shield", title: "정산·배송 걱정 없이", desc: "복잡한 운영은 플랫폼이, 라이브 셀러는 판매와 소통에만 집중." },
  ],
};

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v !== null && typeof v === "object" ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(raw: string | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export async function getHomeStats(): Promise<HomeStat[]> {
  const map = await getSettingsMap();
  const stats = parseJsonArray<HomeStat>(map[HOME_STATS_KEY], DEFAULT_HOME_STATS);
  return stats.length ? stats : DEFAULT_HOME_STATS;
}

export async function getHomeStories(): Promise<HomeStory[]> {
  const map = await getSettingsMap();
  return parseJsonArray<HomeStory>(map[HOME_STORIES_KEY], DEFAULT_HOME_STORIES);
}

export async function getHomeBenefits(): Promise<HomeBenefits> {
  const map = await getSettingsMap();
  const raw = parseJson<HomeBenefits>(map[HOME_BENEFITS_KEY], DEFAULT_HOME_BENEFITS);
  return {
    stats: Array.isArray(raw.stats) && raw.stats.length ? raw.stats : DEFAULT_HOME_BENEFITS.stats,
    items: Array.isArray(raw.items) && raw.items.length ? raw.items : DEFAULT_HOME_BENEFITS.items,
  };
}

// 개별 저장
export async function saveHomeStats(stats: HomeStat[]): Promise<void> {
  await setSettings({ [HOME_STATS_KEY]: JSON.stringify(stats) });
}

export async function saveHomeStories(stories: HomeStory[]): Promise<void> {
  await setSettings({ [HOME_STORIES_KEY]: JSON.stringify(stories) });
}

export async function saveHomeBenefits(benefits: HomeBenefits): Promise<void> {
  await setSettings({ [HOME_BENEFITS_KEY]: JSON.stringify(benefits) });
}

// 호환성 유지 (기존 saveHomeContent 호출부 있을 경우)
export async function saveHomeContent(stats: HomeStat[], stories: HomeStory[]): Promise<void> {
  await setSettings({
    [HOME_STATS_KEY]: JSON.stringify(stats),
    [HOME_STORIES_KEY]: JSON.stringify(stories),
  });
}
