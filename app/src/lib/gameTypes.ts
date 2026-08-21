// 게임 타입 정의 (클라이언트/서버 공용) — 서버 전용 모듈 import 금지
//
// Game.type 은 enum 이 아닌 String 컬럼이므로 여기의 문자열 상수로 검증/분류한다.
// 기존 타입(ROULETTE, LADDER, DRAW)은 그대로 두고 신규 타입을 추가한다.

export const GAME_TYPES = [
  "ROULETTE",
  "LADDER",
  "DRAW",
  "KEYWORD",
  "NUMBER_GUESS",
  "QUIZ",
  "VOTE",
  "GOAL_GAUGE",
  "BOX_OPEN",
  "SEQUENTIAL",
] as const;

export type GameTypeId = (typeof GAME_TYPES)[number];

export function isGameType(v: unknown): v is GameTypeId {
  return typeof v === "string" && (GAME_TYPES as readonly string[]).includes(v);
}

// 항목(items) 배열을 셀러가 직접 입력해두는 게임 (참여자 불필요) — 타입 A
export const ITEM_BASED: GameTypeId[] = ["ROULETTE", "LADDER", "DRAW"];
// 시청자가 QR/오버레이로 직접 참여하는 게임 (GameParticipant 사용) — 타입 B
// SEQUENTIAL: 시청자가 이름으로 참여 → 순위 추첨 (items 있으면 하위 호환 폴백)
// BOX_OPEN: 시청자가 각자 박스를 열어 즉시 결과 확인
export const PARTICIPATION_BASED: GameTypeId[] = [
  "KEYWORD",
  "NUMBER_GUESS",
  "QUIZ",
  "VOTE",
  "SEQUENTIAL",
  "BOX_OPEN",
];
// 주문 수량으로 실시간 진행되는 게임 (시청자 참여 불필요)
export const ORDER_BASED: GameTypeId[] = ["GOAL_GAUGE"];
// (하위 호환) 셀러가 직접 확률 뽑기를 실행하던 게임 — 현재 BOX_OPEN 은 참여형으로 이동
export const DRAW_BASED: GameTypeId[] = [];

export function usesParticipants(type: string): boolean {
  return (PARTICIPATION_BASED as string[]).includes(type);
}
export function usesItems(type: string): boolean {
  return (ITEM_BASED as string[]).includes(type);
}

export interface GameTypeMeta {
  id: GameTypeId;
  label: string;
  desc: string;
  icon: string; // lucide-react 컴포넌트 이름 (클라이언트에서 매핑)
  category: "item" | "participation" | "order" | "draw";
}

export const GAME_TYPE_META: Record<GameTypeId, GameTypeMeta> = {
  ROULETTE: { id: "ROULETTE", label: "룰렛", desc: "돌림판을 돌려 당첨 항목 1개 선정", icon: "Disc3", category: "item" },
  LADDER: { id: "LADDER", label: "사다리타기", desc: "출발지별로 도착 항목을 연결", icon: "Network", category: "item" },
  DRAW: { id: "DRAW", label: "제비뽑기", desc: "여러 제비 중 하나를 무작위 선정", icon: "Ticket", category: "item" },
  KEYWORD: { id: "KEYWORD", label: "선착순 키워드", desc: "정해진 키워드를 먼저 입력한 순으로 당첨", icon: "Zap", category: "participation" },
  NUMBER_GUESS: { id: "NUMBER_GUESS", label: "숫자 맞히기", desc: "정답 숫자를 맞히거나 가장 가까운 참여자 당첨", icon: "Hash", category: "participation" },
  QUIZ: { id: "QUIZ", label: "라이브 퀴즈", desc: "문제를 내고 정답자를 가려내기", icon: "HelpCircle", category: "participation" },
  VOTE: { id: "VOTE", label: "실시간 투표", desc: "선택지에 실시간 투표 · 결과 바 차트", icon: "BarChart3", category: "participation" },
  GOAL_GAUGE: { id: "GOAL_GAUGE", label: "공동 목표 게이지", desc: "주문 수량 목표 달성 시 보상", icon: "Target", category: "order" },
  BOX_OPEN: { id: "BOX_OPEN", label: "박스깡", desc: "시청자가 각자 박스를 열어 확률 보상 뽑기", icon: "Package", category: "participation" },
  SEQUENTIAL: { id: "SEQUENTIAL", label: "연속 룰렛", desc: "참여한 시청자 중 1등~N등 순위 추첨", icon: "ListOrdered", category: "participation" },
};

// ─── 타입별 상세 안내 문구 (생성/수정 폼에서 노출) ───
export const GAME_TYPE_GUIDE: Record<GameTypeId, string> = {
  ROULETTE: "참여자 명단을 입력하고 룰렛을 돌려 무작위로 당첨자를 선정합니다. 라이브 방송 중 시청자 이름을 직접 입력해 추첨하세요.",
  LADDER: "사다리타기로 당첨자를 결정합니다. 참여자 수만큼 사다리가 자동 생성됩니다.",
  DRAW: "항목들 중 하나를 무작위로 뽑습니다. 선물, 쿠폰, 상품 등을 넣어 추첨하세요.",
  SEQUENTIAL:
    "시청자들이 빠르게 채팅에 답변을 입력하는 선착순 게임입니다. 진행자가 질문을 내면 가장 먼저 정답을 입력한 시청자가 당첨됩니다. 참여 방법: QR코드 또는 링크로 참여 페이지 접속 → 이름 입력 후 제출. 운영 팁: 쉬운 질문으로 시작해 분위기를 UP시키세요.",
  QUIZ:
    "객관식 퀴즈 게임입니다. 진행자가 문제를 내면 시청자들이 1~4번 중 정답을 선택합니다. 모든 답변이 집계된 후 정답률과 당첨자를 확인할 수 있습니다. 참여 방법: QR코드로 접속 → 선택지 터치. 운영 팁: 상품 관련 퀴즈로 구매 욕구를 자극하세요.",
  VOTE:
    "시청자 의견을 실시간으로 수집하는 투표 게임입니다. 이름 없이 익명으로 참여하며, 투표 결과를 오버레이로 실시간 표시합니다. 활용 예: '어떤 색상이 더 좋으세요?', '다음 상품은 무엇을 원하시나요?' 등 시청자 참여도를 높이는 데 효과적입니다.",
  NUMBER_GUESS:
    "정해진 범위 내에서 숫자를 맞추는 게임입니다. 시청자들이 각자 예상 숫자를 입력하고, 정답에 가장 가까운 시청자가 당첨됩니다. 참여 방법: QR코드로 접속 → 숫자 직접 입력. 활용 예: '이 상품의 가격은?', '오늘 라이브 시청자 수는?' 등 긴장감 있는 게임 진행이 가능합니다.",
  KEYWORD:
    "진행자가 힌트를 주면 시청자가 키워드를 직접 입력하는 게임입니다. 정확히 일치하는 키워드를 입력한 시청자 중 추첨으로 당첨자를 선정합니다. 참여 방법: QR코드로 접속 → 키워드 직접 입력. 활용 예: 상품명, 브랜드명, 이벤트 해시태그 등을 맞추는 방식으로 브랜드 인지도를 높일 수 있습니다.",
  BOX_OPEN:
    "시청자들이 박스를 열어 당첨 여부를 확인하는 랜덤 게임입니다. 박스 구성(상품/쿠폰/꽝)과 확률을 직접 설정하고, 시청자가 버튼 클릭 시 즉시 결과가 결정됩니다. 참여 방법: QR코드로 접속 → '박스 열기' 버튼 클릭. 운영 팁: 당첨 확률을 낮게 설정하면 희소성이 높아집니다.",
  GOAL_GAUGE:
    "시청자 구매 수량이 목표에 도달하면 특별 혜택이 제공되는 게임입니다. 오버레이 화면에 실시간으로 달성률이 표시되어 시청자들의 구매 참여를 유도합니다. 참여 방법: 별도 참여 없이 구매 자체가 게임 참여입니다. 활용 예: '100개 팔리면 전원 쿠폰 증정!', '목표 달성 시 추가 할인' 등.",
};

// 시청자가 이름만 입력해 참여 → 순위 추첨 (참여자 없으면 items 폴백)
export function isSequential(type: string): boolean {
  return type === "SEQUENTIAL";
}
// 시청자가 각자 박스를 열어 즉시 결과를 받는 게임
export function isBoxOpen(type: string): boolean {
  return type === "BOX_OPEN";
}
// 셀러가 '결과 발표'로 당첨자를 집계하는 게임 (선착순/정답/투표 등)
export const ANNOUNCE_BASED: GameTypeId[] = [
  "KEYWORD",
  "NUMBER_GUESS",
  "QUIZ",
  "VOTE",
  "SEQUENTIAL",
];
export function usesAnnounce(type: string): boolean {
  return (ANNOUNCE_BASED as string[]).includes(type);
}

// ─── 생성/수정 공용 입력 검증 ───
export function validateGameInput(
  type: string,
  title: string,
  items: string[],
  config: Record<string, any>,
): string | null {
  if (!title.trim()) return "제목을 입력해주세요";
  if (usesItems(type)) {
    const clean = items.map((i) => i.trim()).filter(Boolean);
    if (clean.length < 2) return "항목을 2개 이상 입력해주세요";
  }
  const choices: string[] = Array.isArray(config.choices) ? config.choices : [];
  const boxes: any[] = Array.isArray(config.boxes) ? config.boxes : [];
  if (type === "KEYWORD" && !String(config.keyword ?? "").trim()) return "키워드를 입력해주세요";
  if (type === "QUIZ") {
    if (!String(config.question ?? "").trim()) return "문제를 입력해주세요";
    if (choices.filter((c) => c.trim()).length < 2) return "선택지를 2개 이상 입력해주세요";
  }
  if (type === "VOTE") {
    if (!String(config.topic ?? "").trim()) return "투표 주제를 입력해주세요";
    if (choices.filter((c) => c.trim()).length < 2) return "선택지를 2개 이상 입력해주세요";
  }
  if (type === "BOX_OPEN" && boxes.filter((b) => String(b.label).trim()).length < 1)
    return "박스 항목을 1개 이상 입력해주세요";
  return null;
}

// ─── 타입별 config 기본값 ───
export function defaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case "KEYWORD":
      return { keyword: "", winnerCount: 1, reward: "" };
    case "NUMBER_GUESS":
      return { answer: 50, min: 1, max: 100, mode: "closest", winnerCount: 1 };
    case "QUIZ":
      return { question: "", choices: ["", ""], answerIndex: 0, timeLimit: 30 };
    case "VOTE":
      return { topic: "", choices: ["", ""], timeLimit: 30 };
    case "GOAL_GAUGE":
      return { target: 100, reward: "" };
    case "BOX_OPEN":
      return {
        boxes: [
          { label: "1등 상품", kind: "PRODUCT", prob: 10 },
          { label: "쿠폰", kind: "COUPON", prob: 30 },
          { label: "꽝", kind: "MISS", prob: 60 },
        ],
      };
    case "SEQUENTIAL":
      return { rankCount: 3, rewards: ["", "", ""] };
    default:
      return {};
  }
}
