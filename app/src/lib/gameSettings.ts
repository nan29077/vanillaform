// 게임 노출/오버레이 스타일 설정 (서버 전용) — JSON 파일 기반.
// 최고관리자가 게임 유형별 "셀러 노출 여부"와 "오버레이 스타일"을 설정한다.
// prisma 등 서버 모듈에 의존하지 않지만 fs 를 사용하므로 서버에서만 import 할 것.

import { promises as fs } from "fs";
import path from "path";
import { GAME_TYPES } from "@/lib/gameTypes";

export type OverlayStyle = "classic" | "card";

export interface GameTypeSetting {
  sellerVisible: boolean;
  overlayStyle: OverlayStyle;
}

export interface GameSettings {
  gameTypes: Record<string, GameTypeSetting>;
}

// process.cwd() 는 app/ (package.json 위치) — 스펙에 따라 src/data 에 저장.
const SETTINGS_PATH = path.join(process.cwd(), "src", "data", "game-settings.json");

export function defaultGameSettings(): GameSettings {
  const gameTypes: Record<string, GameTypeSetting> = {};
  for (const t of GAME_TYPES) {
    // 기본값은 새 카드 스타일(투명 배경 + 로고 카드 + 게임 카드)
    gameTypes[t] = { sellerVisible: true, overlayStyle: "card" };
  }
  return { gameTypes };
}

// 파일에 없는 신규 게임 타입은 기본값으로 채우고, 잘못된 값은 안전하게 보정.
function normalize(raw: unknown): GameSettings {
  const base = defaultGameSettings();
  const rawTypes =
    raw && typeof raw === "object" && (raw as any).gameTypes && typeof (raw as any).gameTypes === "object"
      ? (raw as any).gameTypes
      : {};
  for (const t of GAME_TYPES) {
    const v = rawTypes[t];
    if (v && typeof v === "object") {
      base.gameTypes[t] = {
        sellerVisible: v.sellerVisible !== false,
        // 명시적으로 "classic" 인 경우만 기존 스타일, 그 외(미지정 포함)는 기본 "card"
        overlayStyle: v.overlayStyle === "classic" ? "classic" : "card",
      };
    }
  }
  return base;
}

export async function readGameSettings(): Promise<GameSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    return normalize(JSON.parse(raw));
  } catch {
    // 파일 없음/파싱 오류 시 코드 기본값으로 폴백
    return defaultGameSettings();
  }
}

export async function writeGameSettings(settings: GameSettings): Promise<void> {
  const normalized = normalize(settings);
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(normalized, null, 2), "utf-8");
}

// 셀러 게임관리 화면에 노출할 게임 타입 목록
export async function getSellerVisibleTypes(): Promise<string[]> {
  const s = await readGameSettings();
  return (GAME_TYPES as readonly string[]).filter((t) => s.gameTypes[t]?.sellerVisible !== false);
}

// 특정 게임 타입의 오버레이 스타일 (기본 card)
export async function getOverlayStyle(type: string): Promise<OverlayStyle> {
  const s = await readGameSettings();
  return s.gameTypes[type]?.overlayStyle ?? "card";
}
