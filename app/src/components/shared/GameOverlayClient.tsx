"use client";

import { Icon as CustomIcon } from '@/components/shared/Icon';
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {Trophy, Target, Vote as VoteIcon, Ticket, ListOrdered, Medal, PartyPopper, Wind, Hexagon, Disc3, Network, Hash, HelpCircle, BarChart3, Gamepad2, Zap, Package, Gift} from 'lucide-react';
import { usesParticipants } from "@/lib/gameTypes";

interface RouletteResult { winner: string; index: number }
interface LadderRung { row: number; col: number }
interface LadderResult {
  rungs: LadderRung[];
  rows: number;
  order: string[];
  activeIndex?: number;
}
interface GameState {
  id: string; type: string; title: string; items: string[];
  config: Record<string, any> | null;
  status: string; result: any;
  participantCount?: number;
  voteCounts?: number[];
  quizCounts?: number[];
  keywordCorrect?: number;
  goalCurrent?: number;
  updatedAt: string;
}

const HONEY = ["#377255","#ffc31a","#d99000","#ffd84d","#b37100","#ffe888"];

export default function GameOverlayClient({
  gameId,
  overlayStyle = "classic",
}: {
  gameId: string;
  overlayStyle?: "classic" | "card";
}) {
  const [state, setState] = useState<GameState | null>(null);
  const [qr, setQr] = useState("");
  const searchParams = useSearchParams();
  // ?overlay=true → 완전 투명(방송 합성용, OBS). 아니면 크림색 미리보기 페이지.
  const isOverlay = searchParams?.get("overlay") === "true";

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (isOverlay) {
      // ── OBS 합성 모드: 완전 투명 (절대 변경 금지) ──
      // !important를 사용해 globals.css의 크림색 배경을 완전히 제거합니다.
      html.style.setProperty("background", "transparent", "important");
      html.style.setProperty("background-color", "transparent", "important");
      html.style.setProperty("background-image", "none", "important");
      body.style.setProperty("background", "transparent", "important");
      body.style.setProperty("background-color", "transparent", "important");
      body.style.setProperty("background-image", "none", "important");
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("overflow", "hidden", "important");
      body.style.setProperty("height", "100dvh", "important");
      body.style.setProperty("min-height", "0", "important");
      document.querySelectorAll("body > canvas").forEach((c) => {
        (c as HTMLElement).style.display = "none";
      });
    } else {
      // ── 일반 미리보기 모드: 크림색 모바일 페이지 ──
      // game/layout.tsx의 !important CSS를 덮어쓰기 위해 setProperty("…", "…", "important") 사용
      html.style.setProperty("background", "#FFFBF0", "important");
      html.style.setProperty("height", "auto", "important");
      html.style.setProperty("min-height", "100dvh", "important");
      body.style.setProperty("background", "#FFFBF0", "important");
      body.style.setProperty("background-image", "none", "important");
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("overflow", "auto", "important");
      body.style.setProperty("height", "auto", "important");
      body.style.setProperty("min-height", "100dvh", "important");
      return () => {
        // 언마운트 시 인라인 스타일 제거 → game/layout.tsx CSS가 다시 적용됨
        html.style.removeProperty("background");
        html.style.removeProperty("height");
        html.style.removeProperty("min-height");
        body.style.removeProperty("background");
        body.style.removeProperty("background-image");
        body.style.removeProperty("margin");
        body.style.removeProperty("padding");
        body.style.removeProperty("overflow");
        body.style.removeProperty("height");
        body.style.removeProperty("min-height");
      };
    }
  }, [isOverlay]);

  // 참여형 게임 QR — 오버레이/일반 모두 생성 (OBS 합성 시 시청자가 직접 스캔 가능)
  // ※ OBS 설정 시 브라우저 소스 "Allow transparency(투명도 허용)"를 반드시 체크하세요.
  //   OBS 사용자 정의 CSS에 body { background: transparent !important; } 추가도 권장합니다.
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const joinUrl = `${origin}/game/${gameId}/join`;
    let cancelled = false;
    import("qrcode")
      .then((m) => m.toDataURL(joinUrl, { width: 220, margin: 1 }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [gameId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: GameState = await res.json();
      setState(data);
    } catch { /* ignore */ }
  }, [gameId]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 1200);
    return () => clearInterval(t);
  }, [poll]);

  if (!state) return null;
  const animKey = `${state.status}-${state.updatedAt}`;

  // ══════════════════════════════════════════════════════════
  // OBS 합성 모드 (새 카드 스타일) — 투명 배경 + 로고/제목/게임 카드 레이아웃
  // 관리자가 해당 게임 타입에 "card" 스타일을 지정한 경우에만 사용.
  // ══════════════════════════════════════════════════════════
  if (isOverlay && overlayStyle === "card") {
    return (
      <div
        className="h-[100dvh] flex flex-col items-center justify-start overflow-hidden pt-3 px-3 pb-3 gap-2.5"
        style={{
          background: "transparent",
          fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif",
        }}
      >
        {/* 상단 카드: 로고 + 게임 제목 */}
        <div className="bg-white/90 rounded-2xl shadow-lg px-4 py-3 text-center w-full max-w-sm flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="바닐라폼 게임" className="h-9 w-auto object-contain mx-auto mb-1" />
          <p className="text-sm font-semibold text-gray-700">{state.title}</p>
        </div>

        {/* 메인 카드: 기존 게임 콘텐츠 컴포넌트 재사용 */}
        <div className="bg-white/90 rounded-2xl shadow-lg p-5 w-full max-w-sm flex-shrink-0">
          <div className="flex justify-center overflow-x-hidden">
            {state.type === "ROULETTE"     && <Roulette game={state} animKey={animKey} />}
            {state.type === "LADDER"       && <Ladder   game={state} animKey={animKey} />}
            {state.type === "DRAW"         && <Draw     game={state} animKey={animKey} />}
            {state.type === "KEYWORD"      && <Keyword  game={state} />}
            {state.type === "NUMBER_GUESS" && <NumberGuess game={state} />}
            {state.type === "QUIZ"         && <Quiz     game={state} />}
            {state.type === "VOTE"         && <Vote     game={state} />}
            {state.type === "GOAL_GAUGE"   && <GoalGauge game={state} />}
            {state.type === "BOX_OPEN"     && <BoxOpen  game={state} animKey={animKey} />}
            {state.type === "SEQUENTIAL"   && <Sequential game={state} animKey={animKey} />}
          </div>
        </div>

        {/* 참여형 게임 QR — IDLE/RUNNING 시 시청자가 스트림에서 직접 스캔 */}
        {usesParticipants(state.type) && state.status !== "FINISHED" && qr && (
          <div className="bg-white/90 rounded-2xl shadow-lg px-4 py-3 flex flex-col items-center gap-1.5 w-full max-w-sm flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" className="w-24 h-24 block" />
            <p className="text-xs font-bold text-purple-600 tracking-tight">📱 QR 스캔으로 참여하기</p>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // OBS 합성 모드 — 기존 렌더링 그대로 유지 (투명 배경 + 떠 있는 게임)
  // ══════════════════════════════════════════════════════════
  if (isOverlay) {
    // QR은 참여형 게임이고 종료되지 않은 경우(IDLE/RUNNING) 항상 표시 — 시청자가 미리 스캔 가능
    const showQr = usesParticipants(state.type) && state.status !== "FINISHED" && !!qr;
    return (
      <div style={{
        position:"fixed", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", background:"transparent",
        fontFamily:"'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif",
        overflow:"hidden",
      }}>
        <div style={{ paddingTop:14, paddingBottom:8, flexShrink:0 }}>
          {/* OBS 합성용: 투명 배경 위에 뜨는 제목 알약 */}
          <div style={{
            background:"linear-gradient(135deg,#377255 0%,#ffd84d 100%)",
            color:"#fff", fontSize:38, fontWeight:800, padding:"14px 44px",
            borderRadius:999, border:"3px solid rgba(255,255,255,0.9)",
            boxShadow:"0 6px 24px rgba(245,167,0,0.5),0 2px 0 #b37100,inset 0 1px 0 rgba(255,255,255,0.3)",
            textShadow:"0 1px 4px rgba(0,0,0,0.15)", letterSpacing:-0.5,
            display:"flex", alignItems:"center", gap:10,
          }}>
            <Hexagon size={32} strokeWidth={2.5} />{state.title}
          </div>
        </div>

        <div style={{
          flex:1, minHeight:0, width:"100%", display:"flex", alignItems:"flex-start",
          justifyContent:"center", overflowX:"hidden", overflowY:"auto",
          padding: showQr ? "20px 20px 200px" : "20px 20px 20px", boxSizing:"border-box",
        }}>
          {state.type === "ROULETTE"     && <Roulette game={state} animKey={animKey} isOverlay />}
          {state.type === "LADDER"       && <Ladder   game={state} animKey={animKey} />}
          {state.type === "DRAW"         && <Draw     game={state} animKey={animKey} isOverlay />}
          {state.type === "KEYWORD"      && <Keyword  game={state} />}
          {state.type === "NUMBER_GUESS" && <NumberGuess game={state} />}
          {state.type === "QUIZ"         && <Quiz     game={state} isOverlay />}
          {state.type === "VOTE"         && <Vote     game={state} />}
          {state.type === "GOAL_GAUGE"   && <GoalGauge game={state} />}
          {state.type === "BOX_OPEN"     && <BoxOpen  game={state} animKey={animKey} />}
          {state.type === "SEQUENTIAL"   && <Sequential game={state} animKey={animKey} isOverlay />}
        </div>

        {/* 참여형 게임 QR — absolute 고정으로 항상 하단에 표시 */}
        {showQr && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.96)", borderRadius: 16, padding: "12px 16px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR" style={{ width: 140, height: 140, display: "block" }} />
              <p style={{
                fontSize: 14, fontWeight: 700, color: "#7c3aed",
                letterSpacing: -0.3, margin: 0, whiteSpace: "nowrap",
              }}>📱 QR 스캔으로 참여하기</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // 일반 미리보기 모드 — 크림색 카드 레이아웃 (GameJoinClient 스타일)
  // ══════════════════════════════════════════════════════════
  const statusLabel =
    state.status === "FINISHED"
      ? "게임이 종료되었습니다"
      : state.status === "RUNNING"
        ? `${TYPE_LABEL[state.type] ?? state.type} 진행 중`
        : "게임 시작을 기다리는 중";

  return (
    <div
      className="w-full"
      style={{ background:"#FFFBF0", minHeight:"100dvh", fontFamily:"'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif" }}
    >
      <div className="max-w-sm mx-auto px-4 py-8 flex flex-col gap-4">
        {/* 상단 카드: 로고 */}
        <header className="bg-white rounded-2xl shadow-sm p-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="바닐라폼 게임" className="h-10 w-auto mx-auto mb-2 object-contain" />
          <p className="text-sm font-medium text-amber-500">라이브 게임 참여</p>
        </header>

        {/* 메인 카드: 게임 제목 + 상태별 내용 */}
        <main className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-center mb-1 text-gray-900">{state.title}</h1>
          <p className="text-sm text-gray-500 text-center mb-4">{statusLabel}</p>
          <PreviewBody state={state} animKey={animKey} qr={qr} />
        </main>

        {/* 하단 푸터 */}
        <p className="text-center text-xs text-gray-400 pb-4">Powered by 바닐라폼 라이브 게임</p>
      </div>
    </div>
  );
}

/* ══════ 일반 미리보기 모드 전용 UI ══════ */

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  ROULETTE: Disc3, LADDER: Network, DRAW: Ticket, KEYWORD: Zap,
  NUMBER_GUESS: Hash, QUIZ: HelpCircle, VOTE: BarChart3,
  GOAL_GAUGE: Target, BOX_OPEN: Package, SEQUENTIAL: ListOrdered,
};
const TYPE_LABEL: Record<string, string> = {
  ROULETTE: "룰렛", LADDER: "사다리타기", DRAW: "제비뽑기", KEYWORD: "선착순 키워드",
  NUMBER_GUESS: "숫자 맞히기", QUIZ: "라이브 퀴즈", VOTE: "실시간 투표",
  GOAL_GAUGE: "공동 목표 게이지", BOX_OPEN: "박스깡", SEQUENTIAL: "연속 룰렛",
};
const ANIMATED_TYPES = ["ROULETTE", "LADDER", "DRAW"];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      {children}
    </span>
  );
}

function CountPillTW({ n, label = "참여" }: { n: number; label?: string }) {
  return (
    <Pill>
      <CustomIcon name="Users" className="w-3.5 h-3.5" /> {label} {n}명
    </Pill>
  );
}

function QrBlock({ qr, title }: { qr: string; title?: string }) {
  const handleDownload = async () => {
    if (!qr) return;
    if (!title) {
      const a = document.createElement("a");
      a.href = qr;
      a.download = "game-qr.png";
      a.click();
      return;
    }
    // 제목 + QR 합성 이미지 다운로드
    const img = new Image();
    img.src = qr;
    await new Promise<void>((res) => { img.onload = () => res(); });
    const pad = 24;
    const titleH = 56;
    const subH = 28;
    const canvas = document.createElement("canvas");
    canvas.width = img.width + pad * 2;
    canvas.height = img.height + titleH + subH + pad * 2;
    const ctx = canvas.getContext("2d")!;
    // 배경
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 상단 앰버 바
    ctx.fillStyle = "#377255";
    ctx.fillRect(0, 0, canvas.width, 6);
    // 게임 제목
    ctx.fillStyle = "#7a4c0c";
    ctx.font = "bold 20px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, pad + 26);
    // 부제목
    ctx.fillStyle = "#b37100";
    ctx.font = "600 13px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.fillText("📱 시청자 참여 QR", canvas.width / 2, pad + 50);
    // QR 이미지
    ctx.drawImage(img, pad, titleH + subH + pad);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "game-qr.png";
    a.click();
  };
  return (
    <div className="mt-5 w-full flex flex-col items-center border-t border-gray-100 pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
        <CustomIcon name="QrCode" className="w-4 h-4 text-amber-500" /> 시청자 참여 QR
      </p>
      {qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="참여 QR" className="w-32 h-32 rounded-lg border border-gray-100" />
          <button
            onClick={handleDownload}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-semibold transition-colors border border-amber-200"
          >
            <CustomIcon name="Download" className="w-3.5 h-3.5" /> QR 다운로드
          </button>
        </>
      ) : (
        <div className="w-32 h-32 rounded-lg border border-gray-100 bg-gray-50 animate-pulse" />
      )}
    </div>
  );
}

function extractWinners(state: GameState): string[] {
  const r = state.result as any;
  if (!r) return [];
  if (Array.isArray(r.winners)) return r.winners.map(String);
  if (Array.isArray(r.ranks))
    return r.ranks.map((x: any) => (x?.name ? `${x.rank}등 ${x.name}` : String(x?.rank ?? "")));
  if (typeof r.winner === "string") return [r.winner];
  if (state.type === "VOTE") {
    const choices: string[] = Array.isArray(state.config?.choices) ? state.config!.choices : [];
    const counts: number[] = Array.isArray(r.counts)
      ? r.counts
      : Array.isArray(state.voteCounts) ? state.voteCounts : [];
    if (counts.length) {
      const idx = counts.reduce((m, c, i) => (c > counts[m] ? i : m), 0);
      if (choices[idx]) return [String(choices[idx])];
    }
  }
  return [];
}

function PreviewBody({ state, animKey, qr }: { state: GameState; animKey: string; qr: string; }) {
  // QR 다운로드 이미지에 삽입될 제목: "[게임 타입] 시청자참여"
  const gameTitle = `${TYPE_LABEL[state.type] ?? state.type} 시청자참여`;
  const TypeIcon = TYPE_ICON[state.type] ?? Hexagon;
  const participation = usesParticipants(state.type);

  // ── 종료 ──
  if (state.status === "FINISHED") {
    const winners = extractWinners(state);
    const reward = typeof state.config?.reward === "string" ? state.config.reward : "";
    return (
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <Trophy className="h-7 w-7 text-amber-500" strokeWidth={1.75} />
        </div>
        <h2 className="mt-3 text-lg font-bold text-gray-900">게임 종료</h2>
        {winners.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-gray-500">당첨자 {winners.length}명</p>
            <div className="mt-4 flex w-full flex-col gap-2.5">
              {winners.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                    <CustomIcon name="Gift" className="h-5 w-5 text-amber-500" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-gray-900">{w}</p>
                    {reward && <p className="mt-0.5 truncate text-xs text-gray-500">{reward}</p>}
                  </div>
                  <Trophy className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={2} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">게임이 종료되었습니다</p>
        )}
      </div>
    );
  }

  // ── 준비 중 (IDLE 등 RUNNING 이 아닌 상태) ──
  if (state.status !== "RUNNING") {
    return (
      <div className="flex flex-col items-center text-center">
        <Gamepad2 className="w-12 h-12 text-amber-400" strokeWidth={1.75} />
        <h2 className="mt-4 text-lg font-bold text-gray-900">잠시 후 게임이 시작됩니다</h2>
        <p className="mt-1 text-sm text-gray-500">셀러가 곧 게임을 시작합니다</p>
        <div className="mt-3">
          <Pill>
            <TypeIcon className="w-3.5 h-3.5" /> {TYPE_LABEL[state.type] ?? state.type}
          </Pill>
        </div>
        {participation && <QrBlock qr={qr} title={gameTitle} />}
      </div>
    );
  }

  // ── 진행 중 ──
  // ROULETTE / LADDER / DRAW → 기존 애니메이션 컴포넌트 재사용 (다크 스테이지 위)
  if (ANIMATED_TYPES.includes(state.type)) {
    return (
      <div className="rounded-xl bg-[#1A1A2E] p-4 overflow-x-auto">
        <div className="flex justify-center min-w-min">
          {state.type === "ROULETTE" && <Roulette game={state} animKey={animKey} />}
          {state.type === "LADDER" && <Ladder game={state} animKey={animKey} />}
          {state.type === "DRAW" && <Draw game={state} animKey={animKey} />}
        </div>
      </div>
    );
  }

  const cfg = state.config || {};

  // KEYWORD
  if (state.type === "KEYWORD") {
    const winnerCount = Math.max(1, Number(cfg.winnerCount) || 1);
    const correct = state.keywordCorrect || 0;
    const remain = Math.max(0, winnerCount - correct);
    return (
      <div className="flex flex-col items-center text-center">
        <CustomIcon name="Lightning" className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
        <h2 className="mt-4 text-lg font-bold text-gray-900">키워드를 입력하세요</h2>
        <div className="mt-3 rounded-xl bg-amber-500 px-6 py-3 text-2xl font-extrabold tracking-tight text-white">
          {cfg.keyword || "???"}
        </div>
        <div className="mt-3">
          <CountPillTW n={state.participantCount || 0} />
        </div>
        <p className="mt-2 text-xs font-semibold text-amber-600">
          {remain > 0 ? `선착순 ${winnerCount}자리 중 ${remain}자리 남음` : `선착순 ${winnerCount}자리 마감!`}
        </p>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // NUMBER_GUESS
  if (state.type === "NUMBER_GUESS") {
    return (
      <div className="flex flex-col items-center text-center">
        <Hash className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
        <h2 className="mt-4 text-lg font-bold text-gray-900">숫자를 맞혀보세요</h2>
        <div className="mt-3 rounded-xl border-2 border-dashed border-amber-300 px-6 py-2 text-xl font-extrabold text-amber-500">
          {cfg.min ?? 1} ~ {cfg.max ?? 100}
        </div>
        <div className="mt-3">
          <CountPillTW n={state.participantCount || 0} />
        </div>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // VOTE
  if (state.type === "VOTE") {
    const choices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
    const counts: number[] = Array.isArray(state.voteCounts) ? state.voteCounts : choices.map(() => 0);
    const total = counts.reduce((a, b) => a + b, 0);
    return (
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <VoteIcon className="w-5 h-5 text-amber-500" /> {cfg.topic || "실시간 투표"}
        </div>
        <div className="space-y-3">
          {choices.map((c, i) => {
            const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
            return (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>{c}</span>
                  <span className="text-amber-600">{counts[i] || 0}표 · {pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-gray-400">총 {total}표</p>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // QUIZ
  if (state.type === "QUIZ") {
    const choices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
    const counts: number[] = Array.isArray(state.quizCounts) ? state.quizCounts : choices.map(() => 0);
    return (
      <div>
        <p className="mb-3 text-center text-base font-bold text-gray-900">Q. {cfg.question || "-"}</p>
        <div className="grid grid-cols-1 gap-2">
          {choices.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[12px] font-bold text-gray-400">
                  {i + 1}
                </span>
                {c}
              </span>
              <span className="text-xs text-amber-600">{counts[i] || 0}명</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center">
          <CountPillTW n={state.participantCount || 0} />
        </div>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // GOAL_GAUGE (주문 기반 — QR 불필요)
  if (state.type === "GOAL_GAUGE") {
    const target = Math.max(1, Number(cfg.target) || 1);
    const current = Number(state.goalCurrent) || 0;
    const pct = Math.min(100, Math.round((current / target) * 100));
    const achieved = current >= target;
    return (
      <div className="flex flex-col items-center text-center">
        <Target className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
        <h2 className="mt-3 text-lg font-bold text-gray-900">{achieved ? "목표 달성!" : "공동 목표까지"}</h2>
        <p className="mt-2 text-3xl font-extrabold text-amber-500">
          {current} <span className="text-lg font-bold text-amber-600/70">/ {target}건</span>
        </p>
        <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {cfg.reward && (
          <div className="mt-3">
            <Pill>
              <CustomIcon name="Gift" className="w-3.5 h-3.5" /> {cfg.reward}
            </Pill>
          </div>
        )}
      </div>
    );
  }

  // BOX_OPEN
  if (state.type === "BOX_OPEN") {
    const boxes: { label: string; prob: number }[] = Array.isArray(cfg.boxes) ? cfg.boxes : [];
    return (
      <div className="flex flex-col items-center text-center">
        <CustomIcon name="Package" className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
        <h2 className="mt-3 text-lg font-bold text-gray-900">상자 오픈 중</h2>
        <p className="mt-1 text-sm text-gray-500">QR로 참여해 각자 박스를 열어보세요</p>
        {boxes.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {boxes.map((b, i) => (
              <span
                key={i}
                className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                {b.label} {b.prob}%
              </span>
            ))}
          </div>
        )}
        <div className="mt-3">
          <CountPillTW n={state.participantCount || 0} label="오픈" />
        </div>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // SEQUENTIAL
  if (state.type === "SEQUENTIAL") {
    return (
      <div className="flex flex-col items-center text-center">
        <ListOrdered className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
        <h2 className="mt-3 text-lg font-bold text-gray-900">연속 추첨 진행 중</h2>
        <p className="mt-1 text-sm text-gray-500">QR로 참여한 시청자 중 순위를 추첨합니다</p>
        <div className="mt-3">
          <CountPillTW n={state.participantCount || 0} />
        </div>
        <QrBlock qr={qr} title={gameTitle} />
      </div>
    );
  }

  // 폴백
  return (
    <div className="flex flex-col items-center text-center">
      <TypeIcon className="w-12 h-12 text-amber-500" strokeWidth={1.75} />
      <h2 className="mt-4 text-lg font-bold text-gray-900">{TYPE_LABEL[state.type] ?? "게임"} 진행 중</h2>
    </div>
  );
}

/* ─── 공용 UI 조각 ─── */
function Panel({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      background:"transparent",
      minWidth:340, maxWidth: wide ? 900 : 720, width:"100%", display:"flex", flexDirection:"column",
      alignItems:"center", gap:14,
    }}>{children}</div>
  );
}

function CountPill({ n }: { n: number }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8, background:"#fff7e0",
      border:"2px solid #377255", borderRadius:999, padding:"8px 20px",
      fontSize:20, fontWeight:800, color:"#b37100",
    }}>
      <CustomIcon name="Users" size={18} strokeWidth={2.5} /> 참여 {n}명
    </div>
  );
}

function WinnerBadge({ label }: { label: string }) {
  return (
    <div style={{
      marginTop:8, fontSize:28, fontWeight:800, color:"#7a4c0c",
      background:"#fff", padding:"12px 36px", borderRadius:999,
      border:"4px solid #377255",
      boxShadow:"0 10px 30px rgba(0,0,0,0.25)",
      animation:"pop-in 0.5s cubic-bezier(0.18,0.89,0.32,1.28)",
      display:"flex", alignItems:"center", gap:10,
    }}>
      <span style={{ color:"#d99000", fontSize:16, fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }}>
        <Trophy size={16} strokeWidth={2.5} /> 당첨
      </span>
      {label}
    </div>
  );
}

/* ─── 룰렛 ─── */
function Roulette({ game, animKey, isOverlay }: { game: GameState; animKey: string; isOverlay?: boolean }) {
  const items = game.items;
  const n = items.length;
  const seg = 360 / n;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const result = game.result as RouletteResult | null;

  useEffect(() => {
    if (game.status === "RUNNING" && result && typeof result.index === "number") {
      setDone(false); setSpinning(true);
      const target = 360 * 6 + (result.index * seg + seg / 2);
      setRotation(prev => {
        const base = Math.floor(prev / 360) * 360;
        return base + target + 360 * (prev >= base + target ? 1 : 0);
      });
      const t = setTimeout(() => { setSpinning(false); setDone(true); }, 4200);
      return () => clearTimeout(t);
    } else { setSpinning(false); setDone(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const gradient = items.map((_, i) => `${HONEY[i % HONEY.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",");
  const SIZE = isOverlay ? 500 : 340; const R = SIZE / 2;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
      <div style={{ position:"relative", width:SIZE, height:SIZE }}>
        <div style={{
          position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)",
          width:0, height:0, borderLeft:"14px solid transparent",
          borderRight:"14px solid transparent", borderTop:"28px solid #fff",
          filter:"drop-shadow(0 3px 4px rgba(0,0,0,0.4))", zIndex:5,
        }} />
        <div style={{
          width:SIZE, height:SIZE, borderRadius:"50%",
          background:`conic-gradient(${gradient})`,
          border:"10px solid #fff",
          boxShadow:"0 12px 40px rgba(0,0,0,0.35),inset 0 0 0 3px #b37100",
          transform:`rotate(${rotation}deg)`,
          transition:spinning ? "transform 4s cubic-bezier(0.15,0.65,0.12,1)" : "none",
          position:"relative",
        }}>
          {items.map((item, i) => {
            const angle = i * seg + seg / 2;
            // 세그먼트 호 길이 기준으로 최대 텍스트 너비 계산 (70%로 여유 확보)
            const arcMaxWidth = Math.floor(2 * Math.PI * (R * 0.52) / n * 0.70);
            const fs = isOverlay ? (n > 8 ? 16 : 20) : (n > 8 ? 12 : 15);
            return (
              <div key={i} style={{
                position:"absolute", top:"50%", left:"50%",
                transformOrigin:"0 0",
                transform:`rotate(${angle}deg) translate(${R * 0.52}px,-10px)`,
                color:"#fff", fontWeight:800, fontSize: fs,
                textShadow:"0 1px 3px rgba(0,0,0,0.5)",
                whiteSpace:"nowrap", maxWidth:arcMaxWidth,
                overflow:"hidden", textOverflow:"ellipsis",
              }}>{item}</div>
            );
          })}
        </div>
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)", width: isOverlay ? 80 : 60, height: isOverlay ? 80 : 60,
          borderRadius:"50%", background:"#fff", border:"4px solid #377255",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 4px 14px rgba(0,0,0,0.3)", zIndex:4,
        }}><Hexagon size={isOverlay ? 38 : 28} strokeWidth={2.5} color="#377255" /></div>
      </div>
      {done && result && <WinnerBadge label={result.winner} />}
      <style jsx global>{`
        @keyframes pop-in {
          0%{transform:scale(0.4);opacity:0}
          100%{transform:scale(1);opacity:1}
        }
      `}</style>
    </div>
  );
}

/* ─── 제비뚝기 ─── */
function Draw({ game, animKey, isOverlay }: { game: GameState; animKey: string; isOverlay?: boolean }) {
  const items = game.items;
  const result = game.result as RouletteResult | null;
  const [phase, setPhase] = useState<"idle"|"shuffle"|"reveal">("idle");

  // overlay 모드에서 카드/폰트 크기 확대
  const cardW  = isOverlay ? 170 : 112;
  const cardH  = isOverlay ? 235 : 154;
  const gap    = isOverlay ? 20  : 16;
  const maxCol = isOverlay ? 4   : 5;

  useEffect(() => {
    if (game.status === "RUNNING" && result && typeof result.index === "number") {
      setPhase("shuffle");
      const t = setTimeout(() => setPhase("reveal"), 1800);
      return () => clearTimeout(t);
    }
    setPhase("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: isOverlay ? 24 : 16 }}>
      <div style={{
        display:"grid",
        gridTemplateColumns:`repeat(${Math.min(items.length, maxCol)},1fr)`,
        gap, maxWidth: isOverlay ? 820 : 640,
      }}>
        {items.map((item, i) => {
          const isWinner = result?.index === i;
          const allRevealed = phase === "reveal";
          const dimmed = allRevealed && !isWinner;
          return (
            <div key={i} style={{
              width:cardW, height:cardH, borderRadius:18,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              textAlign:"center", padding:"8px 6px", fontWeight:800,
              color: allRevealed ? (isWinner ? "#7a4c0c" : "#999") : "#7a4c0c",
              background: allRevealed
                ? (isWinner ? "linear-gradient(160deg,#fffbe6,#fff)" : "#f0f0f0")
                : "linear-gradient(160deg,#ffc31a,#377255)",
              border: allRevealed
                ? (isWinner ? "5px solid #377255" : "3px solid #ddd")
                : "4px solid rgba(255,255,255,0.8)",
              boxShadow: allRevealed
                ? (isWinner ? "0 14px 32px rgba(245,167,0,0.55)" : "0 4px 10px rgba(0,0,0,0.1)")
                : "0 8px 20px rgba(0,0,0,0.28)",
              opacity: dimmed ? 0.45 : 1,
              transform: isWinner && allRevealed ? "translateY(-12px) scale(1.06)" : "none",
              transition:"all 0.45s cubic-bezier(0.18,0.89,0.32,1.28)",
              animation:phase === "shuffle" ? `wiggle 0.5s ease-in-out ${i * 0.08}s infinite` : "none",
            }}>
              {allRevealed ? (
                <>
                  <span style={{ marginBottom:4, display:"flex" }}>
                    {isWinner
                      ? <Trophy size={isOverlay ? 40 : 26} strokeWidth={2.5} color="#377255" />
                      : <Hexagon size={isOverlay ? 30 : 20} strokeWidth={2.5} color="#999" />}
                  </span>
                  <span style={{ fontSize: isOverlay ? (item.length > 4 ? 18 : 24) : (item.length > 4 ? 12 : 15), lineHeight:1.2 }}>{item}</span>
                </>
              ) : (
                <>
                  <span style={{ display:"flex" }}><Hexagon size={isOverlay ? 64 : 42} strokeWidth={2} color="#fff" /></span>
                  <span style={{ fontSize: isOverlay ? 16 : 11, marginTop:4, opacity:0.6 }}>???</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {phase === "reveal" && result && <WinnerBadge label={result.winner} />}
      <style jsx>{`
        @keyframes wiggle {
          0%,100%{transform:translateY(0) rotate(-3deg)}
          50%{transform:translateY(-10px) rotate(3deg)}
        }
      `}</style>
    </div>
  );
}

/* ─── 사다리타기 ─── */
function buildWaypoints(
  startCol: number,
  rungs: LadderRung[],
  totalRows: number,
  colX: (i: number) => number,
  topY: number,
  botY: number,
): [number, number][] {
  const pts: [number, number][] = [];
  let col = startCol;
  const rowH = (botY - topY) / totalRows;
  pts.push([colX(col), topY]);
  for (let row = 0; row < totalRows; row++) {
    const midY = topY + (row + 0.5) * rowH;
    const endY = topY + (row + 1) * rowH;
    const goRight = rungs.some(r => r.row === row && r.col === col);
    const goLeft  = rungs.some(r => r.row === row && r.col === col - 1);
    if (goRight) { pts.push([colX(col), midY]); col++; pts.push([colX(col), midY]); }
    else if (goLeft) { pts.push([colX(col), midY]); col--; pts.push([colX(col), midY]); }
    pts.push([colX(col), endY]);
  }
  return pts;
}

function partialPath(waypoints: [number, number][], progress: number): string {
  if (waypoints.length < 2) return "";
  const N = waypoints.length - 1;
  const total = progress * N;
  const idx = Math.min(Math.floor(total), N - 1);
  const frac = total - idx;
  const pts = waypoints.slice(0, idx + 1);
  const [x1, y1] = waypoints[idx];
  const [x2, y2] = waypoints[idx + 1];
  pts.push([x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac]);
  return "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
}

function Ladder({ game, animKey }: { game: GameState; animKey: string }) {
  const items = game.items;
  const n = items.length;
  const result = game.result as LadderResult | null;
  const activeIndex = result?.activeIndex;

  const [progress, setProgress] = useState(0);
  const [reveal, setReveal] = useState(false);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number | undefined>(undefined);
  const ANIM_MS = activeIndex !== undefined ? 3500 : 2200;

  useEffect(() => {
    setProgress(0); setReveal(false);
    startRef.current = undefined;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (game.status === "RUNNING" && result) {
      const animate = (time: number) => {
        if (!startRef.current) startRef.current = time;
        const p = Math.min(1, (time - startRef.current) / ANIM_MS);
        setProgress(p);
        if (p < 1) { rafRef.current = requestAnimationFrame(animate); }
        else { setReveal(true); }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const decorRungsRef = useRef<LadderRung[] | null>(null);
  const decorRowsRef  = useRef(Math.max(8, n * 3));
  if (!decorRungsRef.current) {
    const rows = decorRowsRef.current;
    const r: LadderRung[] = [];
    for (let row = 0; row < rows; row++) {
      const used = new Set<number>();
      for (let col = 0; col < n - 1; col++) {
        if (!used.has(col) && !used.has(col + 1) && Math.random() < 0.42) {
          r.push({ row, col }); used.add(col);
        }
      }
    }
    decorRungsRef.current = r;
  }

  const displayRungs: LadderRung[] = result?.rungs ?? decorRungsRef.current!;
  const totalRows: number = result?.rows ?? decorRowsRef.current;

  const VW = Math.max(400, Math.min(900, n * 110 + 80));
  const VH = 440;
  const padX = 50; const topY = 55; const botY = VH - 55;
  const colGap = n > 1 ? (VW - padX * 2) / (n - 1) : 0;
  const colX = (i: number) => padX + i * colGap;
  const rungY = (row: number) => topY + ((row + 0.5) / totalRows) * (botY - topY);

  const waypoints: [number, number][] =
    activeIndex !== undefined && result?.rungs
      ? buildWaypoints(activeIndex, displayRungs, totalRows, colX, topY, botY)
      : [];

  const drawn = waypoints.length > 1 && progress > 0 ? partialPath(waypoints, progress) : "";

  let ballX = -100; let ballY = -100;
  if (waypoints.length > 1 && progress > 0 && progress < 1) {
    const N = waypoints.length - 1;
    const total = progress * N;
    const idx = Math.min(Math.floor(total), N - 1);
    const frac = total - idx;
    const [x1, y1] = waypoints[idx]; const [x2, y2] = waypoints[idx + 1];
    ballX = x1 + (x2 - x1) * frac; ballY = y1 + (y2 - y1) * frac;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, width:"100%" }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width:"100%", maxWidth:VW, overflow:"visible" }}>
        <defs>
          <filter id="glow-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-strong" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd84d"/>
            <stop offset="100%" stopColor="#377255"/>
          </linearGradient>
        </defs>

        {/* 세로 줄 - amber 색상으로 가시성 확보 */}
        {items.map((_, i) => {
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== undefined && !isActive;
          return (
            <line key={`v${i}`} x1={colX(i)} y1={topY} x2={colX(i)} y2={botY}
              stroke={isActive ? "#ffd84d" : "#ffc31a"}
              strokeWidth={isActive ? 9 : 6} strokeLinecap="round"
              opacity={isDimmed ? 0.35 : 0.92}
              filter={isActive ? "url(#glow-soft)" : undefined}
            />
          );
        })}

        {/* 가로 발판 */}
        {displayRungs.map((rg, i) => (
          <line key={`h${i}`}
            x1={colX(rg.col)} y1={rungY(rg.row)}
            x2={colX(rg.col + 1)} y2={rungY(rg.row)}
            stroke="#fff" strokeWidth={4.5} strokeLinecap="round" opacity={0.88}
          />
        ))}

        {/* 경로 추적선 */}
        {drawn && (
          <>
            <path d={drawn} fill="none" stroke="rgba(0,0,0,0.3)"
              strokeWidth={10} strokeLinecap="round" strokeLinejoin="round"/>
            <path d={drawn} fill="none" stroke="#ff3b3b"
              strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
              filter="url(#glow-strong)"/>
          </>
        )}

        {/* 볼 */}
        {progress > 0 && progress < 1 && waypoints.length > 1 && (
          <>
            <circle cx={ballX} cy={ballY} r={13} fill="rgba(0,0,0,0.3)"/>
            <circle cx={ballX} cy={ballY} r={11} fill="#ff3b3b" filter="url(#glow-strong)"/>
            <circle cx={ballX} cy={ballY} r={5} fill="#fff" opacity={0.9}/>
          </>
        )}

        {/* 상단 번호 밷지 */}
        {items.map((_, i) => {
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== undefined && !isActive;
          return (
            <g key={`top${i}`} transform={`translate(${colX(i)},${topY - 26})`}>
              <circle r={20}
                fill={isActive ? "#ff3b3b" : "url(#amberGrad)"}
                opacity={isDimmed ? 0.4 : 1}
                filter={isActive ? "url(#glow-soft)" : undefined}
                stroke="#fff" strokeWidth={2.5}
              />
              <text textAnchor="middle" dominantBaseline="middle"
                fill="#fff" fontWeight="800" fontSize={n > 9 ? 11 : 14}>
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* 하단 결과 밷지 */}
        {items.map((_, i) => {
          const label = reveal && result?.order ? result.order[i] : "?";
          const isRevealed = reveal && !!result?.order;
          return (
            <g key={`bot${i}`} transform={`translate(${colX(i)},${botY + 28})`}>
              <rect x={-34} y={-17} width={68} height={34} rx={10}
                fill={isRevealed ? "#fff" : "rgba(245,167,0,0.85)"}
                stroke={isRevealed ? "#377255" : "rgba(255,255,255,0.7)"}
                strokeWidth={2.5}
              />
              <text textAnchor="middle" dominantBaseline="middle"
                fill={isRevealed ? "#b37100" : "#fff"}
                fontWeight="800" fontSize={label.length > 4 ? 10 : 13}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── 당첨자 목록 배지 ─── */
function WinnerList({ winners }: { winners: string[] }) {
  if (!winners.length)
    return <div style={{ fontSize:20, fontWeight:700, color:"#999" }}>당첨자가 없습니다</div>;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center" }}>
      {winners.map((w, i) => (
        <div key={i} style={{
          fontSize:22, fontWeight:800, color:"#7a4c0c", background:"#fff",
          padding:"10px 24px", borderRadius:999, border:"3px solid #377255",
          boxShadow:"0 8px 24px rgba(245,167,0,0.4)",
          animation:`pop-in 0.5s cubic-bezier(0.18,0.89,0.32,1.28) ${i * 0.08}s both`,
          display:"flex", alignItems:"center", gap:8,
        }}>
          <Trophy size={20} strokeWidth={2.5} color="#377255" /> {w}
        </div>
      ))}
      <style jsx global>{`@keyframes pop-in{0%{transform:scale(0.4);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

/* ─── 선착순 키워드 ─── */
function Keyword({ game }: { game: GameState }) {
  const cfg = game.config || {};
  const finished = game.status === "FINISHED";
  const winners: string[] = finished && Array.isArray(game.result?.winners) ? game.result.winners : [];
  const winnerCount = Math.max(1, Number(cfg.winnerCount) || 1);
  const correct = game.keywordCorrect || 0;
  const remain = Math.max(0, winnerCount - correct);
  return (
    <Panel>
      {finished ? (
        <>
          <div style={{ fontSize:16, fontWeight:700, color:"#d99000", display:"flex", alignItems:"center", gap:6 }}>
            <PartyPopper size={16} strokeWidth={2.5} /> 당첨 결과
          </div>
          <WinnerList winners={winners} />
        </>
      ) : (
        <>
          <div style={{ fontSize:17, fontWeight:700, color:"#7a4c0c" }}>아래 키워드를 먼저 입력하세요!</div>
          <div style={{
            fontSize:40, fontWeight:900, color:"#fff", letterSpacing:-0.5,
            background:"linear-gradient(135deg,#ffc31a,#377255)", padding:"14px 40px",
            borderRadius:20, boxShadow:"0 10px 28px rgba(245,167,0,0.5)",
            textShadow:"0 2px 6px rgba(0,0,0,0.2)",
          }}>{cfg.keyword || "???"}</div>
          <CountPill n={game.participantCount || 0} />
          <div style={{ fontSize:15, color: remain > 0 ? "#b37100" : "#059669", fontWeight:700 }}>
            {remain > 0
              ? `선착순 ${winnerCount}자리 중 ${remain}자리 남음`
              : `선착순 ${winnerCount}자리 마감!`}
            {cfg.reward ? ` · ${cfg.reward}` : ""}
          </div>
        </>
      )}
    </Panel>
  );
}

/* ─── 숫자 맞히기 ─── */
function NumberGuess({ game }: { game: GameState }) {
  const cfg = game.config || {};
  const finished = game.status === "FINISHED";
  const winners: string[] = finished && Array.isArray(game.result?.winners) ? game.result.winners : [];
  return (
    <Panel>
      {finished ? (
        <>
          <div style={{ fontSize:16, fontWeight:700, color:"#d99000", display:"flex", alignItems:"center", gap:6 }}>
            <Target size={16} strokeWidth={2.5} /> 정답 {game.result?.answer ?? ""}
          </div>
          <WinnerList winners={winners} />
        </>
      ) : (
        <>
          <div style={{ fontSize:19, fontWeight:800, color:"#7a4c0c" }}>숫자를 맞혀보세요!</div>
          <div style={{
            fontSize:34, fontWeight:900, color:"#377255",
            border:"3px dashed #377255", borderRadius:16, padding:"10px 34px",
          }}>{cfg.min ?? 1} ~ {cfg.max ?? 100}</div>
          <CountPill n={game.participantCount || 0} />
        </>
      )}
    </Panel>
  );
}

/* ─── 라이브 퀴즈 ─── */
function Quiz({ game, isOverlay }: { game: GameState; isOverlay?: boolean }) {
  const cfg = game.config || {};
  const choices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
  const finished = game.status === "FINISHED";
  const answerIndex = Number(game.result?.answerIndex ?? cfg.answerIndex ?? -1);
  const counts: number[] = Array.isArray(game.quizCounts) ? game.quizCounts : choices.map(() => 0);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <Panel>
      <div style={{
        fontSize:22, fontWeight:800, textAlign:"center",
        color: isOverlay ? "#fff" : "#3a2a10",
        textShadow: isOverlay ? "0 1px 6px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,1)" : undefined,
      }}>
        Q. {cfg.question || "-"}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, width:"100%" }}>
        {choices.map((c, i) => {
          const isAns = finished && i === answerIndex;
          const cnt = counts[i] || 0;
          const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
          return (
            <div key={i} style={{
              position:"relative", overflow:"hidden",
              fontSize:18, fontWeight:800, padding:"14px 16px", borderRadius:14, textAlign:"center",
              color: isAns ? "#fff" : (isOverlay ? "#fff" : "#7a4c0c"),
              background: isAns
                ? "linear-gradient(135deg,#34d399,#059669)"
                : (isOverlay ? "rgba(255,255,255,0.08)" : "#fff7e0"),
              border: isAns ? "3px solid #059669" : (isOverlay ? "2px solid rgba(255,255,255,0.3)" : "2px solid #f5d58a"),
              boxShadow: isAns ? "0 8px 22px rgba(5,150,105,0.4)" : "none",
              textShadow: isOverlay ? "0 1px 5px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,1)" : undefined,
              transition:"all 0.3s",
            }}>
              {/* 진행 중 응답 비율 바 (정답 비공개) */}
              {!finished && (
                <div style={{
                  position:"absolute", left:0, top:0, bottom:0, width:`${pct}%`,
                  background: isOverlay ? "rgba(245,167,0,0.4)" : "rgba(245,167,0,0.22)", transition:"width 0.5s ease", zIndex:0,
                }} />
              )}
              <span style={{ position:"relative", zIndex:1 }}>
                {isAns ? <CustomIcon name="Check" size={18} strokeWidth={3} style={{ verticalAlign:"middle", marginRight:4 }} /> : `${i + 1}. `}{c}
                {!finished && <span style={{ marginLeft:6, fontSize:14, color: isOverlay ? "#ffd84d" : "#b37100" }}>{cnt}명</span>}
              </span>
            </div>
          );
        })}
      </div>
      {finished
        ? <div style={{ fontSize:16, fontWeight:800, color:"#059669", display:"flex", alignItems:"center", gap:6 }}>정답자 {game.result?.correctCount ?? 0}명 <PartyPopper size={16} strokeWidth={2.5} /></div>
        : <CountPill n={game.participantCount || 0} />}
    </Panel>
  );
}

/* ─── 실시간 투표 ─── */
function Vote({ game }: { game: GameState }) {
  const cfg = game.config || {};
  const choices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
  const finished = game.status === "FINISHED";
  const counts: number[] = Array.isArray(game.result?.counts)
    ? game.result.counts
    : Array.isArray(game.voteCounts)
      ? game.voteCounts
      : choices.map(() => 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const maxIdx = counts.reduce((m, c, i) => (c > counts[m] ? i : m), 0);
  return (
    <Panel>
      <div style={{ fontSize:22, fontWeight:800, color:"#3a2a10", textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        <VoteIcon size={22} strokeWidth={2.5} /> {cfg.topic || "-"}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%" }}>
        {choices.map((c, i) => {
          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          const win = finished && total > 0 && i === maxIdx;
          return (
            <div key={i}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:16, fontWeight:700, color:"#5a4a2a", marginBottom:4 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>{win && <Trophy size={15} strokeWidth={2.5} color="#377255" />}{c}</span>
                <span style={{ color:"#b37100" }}>{counts[i]}표 · {pct}%</span>
              </div>
              <div style={{ height:22, borderRadius:999, background:"#f0e6cc", overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${pct}%`, borderRadius:999,
                  background: win ? "linear-gradient(90deg,#34d399,#059669)" : "linear-gradient(90deg,#ffd84d,#377255)",
                  transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)",
                }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:"#b37100" }}>총 {total}표</div>
    </Panel>
  );
}

/* ─── 공동 목표 게이지 ─── */
function GoalGauge({ game }: { game: GameState }) {
  const cfg = game.config || {};
  const target = Math.max(1, Number(cfg.target) || 1);
  const current = Number(game.goalCurrent) || 0;
  const pct = Math.min(100, Math.round((current / target) * 100));
  const achieved = current >= target;
  return (
    <Panel>
      <div style={{ fontSize:20, fontWeight:800, color:"#3a2a10", display:"flex", alignItems:"center", gap:6 }}>
        {achieved ? <><PartyPopper size={20} strokeWidth={2.5} /> 목표 달성!</> : "공동 목표까지"}
      </div>
      <div style={{ fontSize:38, fontWeight:900, color:"#377255" }}>
        {current} <span style={{ fontSize:22, color:"#b37100" }}>/ {target}건</span>
      </div>
      <div style={{ width:440, maxWidth:"100%", height:34, borderRadius:999, background:"#f0e6cc", overflow:"hidden", boxShadow:"inset 0 2px 6px rgba(0,0,0,0.12)" }}>
        <div style={{
          height:"100%", width:`${pct}%`, borderRadius:999,
          background: achieved ? "linear-gradient(90deg,#34d399,#059669)" : "linear-gradient(90deg,#ffd84d,#377255)",
          transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)",
          display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:12,
          color:"#fff", fontWeight:800, fontSize:15,
        }}>{pct >= 12 ? `${pct}%` : ""}</div>
      </div>
      {cfg.reward && (
        <div style={{
          fontSize:15, fontWeight:700, color: achieved ? "#059669" : "#b37100",
          background: achieved ? "#d1fae5" : "#fff7e0", padding:"8px 20px", borderRadius:999,
          display:"inline-flex", alignItems:"center", gap:6,
        }}><CustomIcon name="Gift" size={15} strokeWidth={2.5} /> {cfg.reward}</div>
      )}
    </Panel>
  );
}

/* ─── 박스깡 ─── */
function BoxOpen({ game, animKey }: { game: GameState; animKey: string }) {
  const cfg = game.config || {};
  const boxes: { label: string; kind: string; prob: number }[] = Array.isArray(cfg.boxes) ? cfg.boxes : [];
  const finished = game.status === "FINISHED" && game.result?.box;
  const [phase, setPhase] = useState<"idle" | "shake" | "open">("idle");

  useEffect(() => {
    if (finished) {
      setPhase("shake");
      const t = setTimeout(() => setPhase("open"), 1400);
      return () => clearTimeout(t);
    }
    setPhase("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  const KIND_ICON: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
    PRODUCT: Gift, COUPON: Ticket, MISS: Wind,
  };

  if (phase === "open" && game.result?.box) {
    const box = game.result.box;
    const miss = box.kind === "MISS";
    const OpenIcon = KIND_ICON[box.kind] || Package;
    return (
      <Panel>
        <div style={{ display:"flex", animation:"pop-in 0.5s cubic-bezier(0.18,0.89,0.32,1.28)" }}>
          <OpenIcon size={64} strokeWidth={1.75} color={miss ? "#999" : "#377255"} />
        </div>
        <div style={{
          fontSize:30, fontWeight:900, color: miss ? "#999" : "#7a4c0c",
          background:"#fff", padding:"12px 36px", borderRadius:999,
          border:`4px solid ${miss ? "#ccc" : "#377255"}`,
          boxShadow:"0 10px 30px rgba(0,0,0,0.25)",
        }}>{box.label}</div>
        <style jsx global>{`@keyframes pop-in{0%{transform:scale(0.3);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ fontSize:19, fontWeight:800, color:"#7a4c0c", display:"flex", alignItems:"center", gap:6 }}>
        {phase === "shake" ? "박스를 여는 중..." : <><CustomIcon name="Gift" size={19} strokeWidth={2.5} /> 박스깡 대기 중</>}
      </div>
      <div style={{
        display:"flex", animation: phase === "shake" ? "box-shake 0.4s ease-in-out infinite" : "none",
      }}><CustomIcon name="Package" size={80} strokeWidth={1.5} color="#b37100" /></div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", maxWidth:460 }}>
        {boxes.map((b, i) => {
          const KI = KIND_ICON[b.kind];
          return (
            <span key={i} style={{
              fontSize:13, fontWeight:700, color:"#b37100", background:"#fff7e0",
              border:"1.5px solid #f5d58a", borderRadius:999, padding:"5px 12px",
              display:"inline-flex", alignItems:"center", gap:5,
            }}>{KI && <KI size={13} strokeWidth={2.5} />} {b.label} {b.prob}%</span>
          );
        })}
      </div>
      {phase !== "shake" && (
        <div style={{ fontSize:13, fontWeight:700, color:"#b37100" }}>
          QR로 참여해 각자 박스를 열어보세요 · {game.participantCount || 0}명 오픈
        </div>
      )}
      <style jsx global>{`
        @keyframes box-shake{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-8px)}}
      `}</style>
    </Panel>
  );
}

/* ─── 연속 룰렛 (순위 추첨) ─── */
function Sequential({ game, animKey, isOverlay }: { game: GameState; animKey: string; isOverlay?: boolean }) {
  const finished = game.status === "FINISHED" || game.status === "RUNNING";
  const ranks: { rank: number; name: string; reward?: string }[] =
    Array.isArray(game.result?.ranks) ? game.result.ranks : [];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (finished && ranks.length > 0) {
      setShown(0);
      const timers: ReturnType<typeof setTimeout>[] = [];
      ranks.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 700 * (i + 1))));
      return () => timers.forEach(clearTimeout);
    }
    setShown(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  if (!finished || ranks.length === 0) {
    const rankCount = Math.max(1, Number(game.config?.rankCount) || 1);
    return (
      <Panel>
        <div style={{
          fontSize:19, fontWeight:800, display:"flex", alignItems:"center", gap:8,
          color: isOverlay ? "#ffd84d" : "#7a4c0c",
          textShadow: isOverlay ? "0 1px 6px rgba(0,0,0,0.9)" : undefined,
        }}>
          <ListOrdered size={19} strokeWidth={2.5} /> 연속 룰렛 참여 받는 중
        </div>
        <div style={{
          fontSize:14, fontWeight:700,
          color: isOverlay ? "#ffc31a" : "#b37100",
          textShadow: isOverlay ? "0 1px 4px rgba(0,0,0,0.8)" : undefined,
        }}>
          QR로 참여하면 1등~{rankCount}등 순위 추첨에 응모됩니다
        </div>
        <CountPill n={game.participantCount || 0} />
        {game.items.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", maxWidth:520 }}>
            {game.items.map((it, i) => (
              <span key={i} style={{
                fontSize:15, fontWeight:700, color: isOverlay ? "#ffd84d" : "#b37100",
                background: isOverlay ? "rgba(245,167,0,0.2)" : "#fff7e0",
                border: isOverlay ? "1.5px solid rgba(245,213,138,0.6)" : "1.5px solid #f5d58a",
                borderRadius:999, padding:"6px 14px",
                textShadow: isOverlay ? "0 1px 4px rgba(0,0,0,0.8)" : undefined,
              }}>{it}</span>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  const MEDAL_COLOR = ["#377255", "#b0b0b0", "#cd7f32"];
  return (
    <Panel>
      <div style={{
        fontSize:18, fontWeight:800, display:"flex", alignItems:"center", gap:6,
        color: isOverlay ? "#ffd84d" : "#d99000",
        textShadow: isOverlay ? "0 1px 6px rgba(0,0,0,0.9)" : undefined,
      }}>
        <PartyPopper size={18} strokeWidth={2.5} /> 순위 발표
      </div>
      <div style={{
        display:"flex", flexDirection:"column", gap:10, width:"100%",
        ...(isOverlay ? { maxHeight:420, overflowY:"auto" } : {}),
      }}>
        {ranks.map((r, i) => (
          <div key={r.rank} style={{
            display:"flex", alignItems:"center", gap:12, padding:"10px 18px", borderRadius:14,
            background: isOverlay ? "transparent" : (i < shown ? "linear-gradient(135deg,#fffbe6,#fff)" : "#f4f4f4"),
            border: i < shown
              ? "3px solid #377255"
              : (isOverlay ? "2px solid rgba(255,255,255,0.15)" : "2px solid #e5e5e5"),
            opacity: i < shown ? 1 : 0.35,
            transform: i < shown ? "translateX(0)" : "translateX(-12px)",
            transition:"all 0.4s cubic-bezier(0.18,0.89,0.32,1.28)",
          }}>
            <span style={{ display:"flex", width:28, justifyContent:"center" }}>
              {i < 3
                ? <Medal size={26} strokeWidth={2} color={MEDAL_COLOR[i]} />
                : <span style={{
                    fontSize:16, fontWeight:900,
                    color: isOverlay ? "#ffd84d" : "#b37100",
                    textShadow: isOverlay ? "0 1px 4px rgba(0,0,0,0.8)" : undefined,
                  }}>{r.rank}</span>}
            </span>
            <span style={{
              fontSize:20, fontWeight:900, flex:1,
              color: isOverlay ? "#fff" : "#7a4c0c",
              textShadow: isOverlay ? "0 1px 6px rgba(0,0,0,0.95),0 0 2px rgba(0,0,0,1)" : undefined,
            }}>
              {i < shown ? r.name : "???"}
            </span>
            {i < shown && r.reward && (
              <span style={{
                fontSize:13, fontWeight:700, display:"inline-flex", alignItems:"center", gap:5,
                color: isOverlay ? "#ffd84d" : "#b37100",
                textShadow: isOverlay ? "0 1px 4px rgba(0,0,0,0.8)" : undefined,
              }}>
                <CustomIcon name="Gift" size={13} strokeWidth={2.5} /> {r.reward}
              </span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
