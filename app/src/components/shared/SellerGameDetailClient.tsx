"use client";

import { Icon as CustomIcon } from '@/components/shared/Icon';
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Disc3, Network, Ticket, Play, Monitor, Hash, Zap, HelpCircle, BarChart3, Target, Package, ListOrdered, Trophy, X} from 'lucide-react';
import {
  GAME_TYPE_META, GAME_TYPE_GUIDE, defaultConfig, usesItems, usesParticipants, usesAnnounce,
  validateGameInput, type GameTypeId,
} from "@/lib/gameTypes";
import GameFields from "@/components/shared/GameFields";
import GameCouponManager from "@/components/shared/GameCouponManager";

interface Game {
  id: string;
  type: string;
  title: string;
  items: string[];
  config: Record<string, any> | null;
  result: Record<string, any> | null;
  status: string;
  participantCount: number;
  createdAt: string;
}

interface Participant {
  id: string;
  name: string;
  entry: string | null;
  isMember: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  Disc3, Network, Ticket, Zap, Hash, HelpCircle, BarChart3, Target, Package, ListOrdered,
};

export default function SellerGameDetailClient({ game: initial }: { game: Game }) {
  const router = useRouter();
  const [game, setGame] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [qr, setQr] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(initial.title);
  const [editItems, setEditItems] = useState<string[]>(initial.items);
  const [editConfig, setEditConfig] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const meta = GAME_TYPE_META[game.type as GameTypeId] || GAME_TYPE_META.ROULETTE;
  const Icon = ICONS[meta.icon] || Disc3;
  const cfg = game.config || {};

  const isItem = usesItems(game.type);
  const isParticipation = usesParticipants(game.type);
  const isGoal = game.type === "GOAL_GAUGE";
  const isBox = game.type === "BOX_OPEN";
  const isSequential = game.type === "SEQUENTIAL";
  const isKeyword = game.type === "KEYWORD";
  const isQuiz = game.type === "QUIZ";
  const isNumber = game.type === "NUMBER_GUESS";
  const isVote = game.type === "VOTE";
  const canAnnounce = usesAnnounce(game.type); // 결과 발표(추첨) 버튼 사용
  const running = game.status === "RUNNING";
  const finished = game.status === "FINISHED";
  // 시청자 직접 참여가 필요 없는 게임(룰렛·사다리·제비뽑기) — QR 비활성화
  const noViewerJoin = isItem;

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const overlayUrl = origin ? `${origin}/game/${game.id}?overlay=true` : `/game/${game.id}?overlay=true`;
  const previewUrl = origin ? `${origin}/game/${game.id}` : `/game/${game.id}`;
  const joinUrl = origin ? `${origin}/game/${game.id}/join` : `/game/${game.id}/join`;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  // QR 코드 생성 (참여 URL)
  useEffect(() => {
    if (!origin) return;
    let active = true;
    import("qrcode")
      .then((m) => m.toDataURL(joinUrl, { width: 240, margin: 1, color: { dark: "#7a4c0c", light: "#ffffff" } }))
      .then((url) => { if (active) setQr(url); })
      .catch(() => {});
    return () => { active = false; };
  }, [origin, joinUrl]);

  // 참여자 폴링 (참여형 게임)
  const loadParticipants = useCallback(async () => {
    if (!isParticipation) return;
    try {
      const res = await fetch(`/api/games/${game.id}/participate`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setParticipants(data.participants || []);
      setGame((g) => ({ ...g, participantCount: data.count ?? g.participantCount }));
    } catch { /* ignore */ }
  }, [game.id, isParticipation]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isParticipation) return;
    loadParticipants();
    pollRef.current = setInterval(loadParticipants, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isParticipation, loadParticipants]);

  const patch = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/seller/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame((g) => ({ ...g, status: data.game.status, result: null }));
        if (action === "start") {
          const idx = extra?.selectedIndex as number | undefined;
          if (isParticipation) showToast("참여를 열었습니다");
          else showToast(idx !== undefined ? `${idx + 1}번부터 시작했습니다` : "게임을 시작했습니다");
        } else if (action === "reset" || action === "stop") {
          showToast("초기화했습니다");
          setParticipants([]);
        }
        router.refresh();
      } else {
        showToast(data.error || "요청에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    } finally {
      setBusy(false);
    }
  };

  // 결과 발표 (참여형/박스깡)
  const announce = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/games/${game.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: game.type }),
      });
      const data = await res.json();
      if (res.ok) {
        setGame((g) => ({ ...g, status: "FINISHED", result: data.result }));
        showToast("결과를 발표했습니다");
        router.refresh();
      } else {
        showToast(data.error || "결과 처리에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(
      () => showToast(`${label}을(를) 복사했습니다`),
      () => showToast("복사에 실패했습니다", false),
    );
  };

  // 설정 수정
  const openEdit = () => {
    setEditTitle(game.title);
    setEditItems(game.items.length ? game.items : ["", ""]);
    setEditConfig({ ...defaultConfig(game.type), ...(game.config || {}) });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    const err = validateGameInput(game.type, editTitle, editItems, editConfig);
    if (err) return showToast(err, false);
    const cleanItems = usesItems(game.type) ? editItems.map((i) => i.trim()).filter(Boolean) : [];
    const payloadConfig: Record<string, any> = { ...editConfig };
    if (Array.isArray(payloadConfig.choices))
      payloadConfig.choices = payloadConfig.choices.map((c: string) => c.trim()).filter(Boolean);
    if (Array.isArray(payloadConfig.boxes))
      payloadConfig.boxes = payloadConfig.boxes
        .filter((b: any) => String(b.label).trim())
        .map((b: any) => ({ label: String(b.label).trim(), kind: b.kind, prob: Number(b.prob) || 0 }));

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/seller/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", title: editTitle.trim(), items: cleanItems, config: payloadConfig }),
      });
      const data = await res.json();
      if (res.ok) {
        // update 액션은 저장 후 대기(IDLE) 상태로 초기화하고 기존 결과를 지웁니다.
        setGame((g) => ({
          ...g,
          title: editTitle.trim(),
          items: cleanItems,
          config: payloadConfig,
          status: "IDLE",
          result: null,
        }));
        showToast("설정을 수정했습니다");
        setShowEdit(false);
        router.refresh();
      } else {
        showToast(data.error || "수정에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    } finally {
      setSavingEdit(false);
    }
  };

  const statusBadge = (
    <span
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
        running
          ? "bg-amber-100 text-amber-700"
          : finished
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500"
      }`}
    >
      {running ? (isParticipation ? "참여 오픈" : "진행중") : finished ? "종료" : "대기"}
    </span>
  );

  // 선택지 실시간 집계 (VOTE·QUIZ 공용)
  const voteChoices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
  const voteCounts = voteChoices.map(
    (_, i) => participants.filter((p) => Number((p.entry ?? "").trim()) === i).length,
  );
  const voteTotal = voteCounts.reduce((a, b) => a + b, 0);
  const quizAnswerIndex = Number(cfg.answerIndex);

  // KEYWORD 정답 판정 (대소문자 무시)
  const keywordAnswer = String(cfg.keyword ?? "").trim().toLowerCase();
  const isKeywordCorrect = (entry: string | null) =>
    keywordAnswer !== "" && (entry ?? "").trim().toLowerCase() === keywordAnswer;
  const keywordCorrectCount = isKeyword
    ? participants.filter((p) => isKeywordCorrect(p.entry)).length
    : 0;

  // BOX_OPEN 참여자별 오픈 결과 파싱
  const parseBox = (entry: string | null): { label: string; kind: string } | null => {
    if (!entry) return null;
    try {
      const v = JSON.parse(entry);
      if (v && typeof v === "object" && "label" in v) return { label: String(v.label), kind: String(v.kind ?? "MISS") };
    } catch {
      /* ignore */
    }
    return null;
  };

  return (
    <div>
      {/* 상단 내비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/seller/games" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <CustomIcon name="ArrowRight" size={14} className="rotate-180" /> 게임관리로 돌아가기
        </Link>
        <Link
          href="/seller/games"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors"
        >
          <CustomIcon name="Home" size={13} /> 게임 홈으로 가기
        </Link>
      </div>

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm shadow-amber-200">
          <Icon size={22} className="text-white" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{game.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {meta.label}
            {isItem ? ` · 항목 ${game.items.length}개` : ""}
            {isParticipation ? ` · 참여 ${game.participantCount}명` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={openEdit}
            disabled={running}
            title={running ? "진행 중에는 수정할 수 없습니다 (리셋 후 수정)" : "게임 설정 수정"}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-amber-300 hover:text-amber-700 text-gray-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CustomIcon name="Edit" size={13} /> 설정 수정
          </button>
          <p className="text-xs text-gray-400 text-right leading-tight">게임을 리셋한 후 설정을 수정하세요</p>
        </div>
      </div>

      {/* 게임 컨트롤 카드 */}
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">게임 컨트롤</h2>
          {statusBadge}
        </div>

        {/* 항목 기반 */}
        {isItem && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => patch("start")} disabled={busy}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-all ${
                  busy
                    ? "bg-amber-300 opacity-60 cursor-not-allowed"
                    : running
                      ? "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-300 ring-2 ring-amber-300"
                      : "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-200 ring-2 ring-offset-1 ring-amber-400"
                }`}>
                <Play size={17} fill="currentColor" /> {running ? "다시 시작" : "게임 시작"}
              </button>
              <button onClick={() => patch("reset")} disabled={busy}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-sm font-bold transition-colors">
                <CustomIcon name="Reorder" size={16} /> 리셋
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              <b>게임 시작</b>을 누르면 방송 오버레이에서 애니메이션이 재생되고 결과가 표시됩니다.
              <b> 리셋</b>은 결과를 지우고 대기 상태로 되돌립니다.
            </p>
          </>
        )}

        {/* 참여형 / 박스깡 / 목표 게이지 */}
        {!isItem && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              {/* 참여 열기 / 시작 — IDLE일 때만 활성, RUNNING이면 비활성 */}
              <button onClick={() => patch("start")} disabled={busy || running}
                className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-sm font-bold transition-all ${
                  busy || running
                    ? "bg-amber-300 opacity-50 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-300 ring-2 ring-offset-1 ring-amber-400"
                }`}>
                <Play size={16} fill="currentColor" /> {isGoal ? "시작" : "참여 열기"}
              </button>

              {/* 추첨 시작 / 결과 발표 / 게임 종료 — RUNNING일 때 활성 */}
              {canAnnounce ? (
                <button
                  onClick={announce}
                  disabled={busy || (game.participantCount === 0 && !(isSequential && game.items.length > 0))}
                  className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-sm font-bold transition-all ${
                    busy || (game.participantCount === 0 && !(isSequential && game.items.length > 0))
                      ? "bg-emerald-300 opacity-50 cursor-not-allowed"
                      : running
                        ? "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-300 ring-2 ring-offset-1 ring-emerald-400"
                        : "bg-emerald-400 hover:bg-emerald-500 shadow-sm"
                  }`}>
                  <Trophy size={16} /> {isSequential ? "추첨 시작" : "결과 발표"}
                </button>
              ) : (
                <button onClick={() => patch("finish")} disabled={busy || !running}
                  className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-sm font-bold transition-all ${
                    busy || !running
                      ? "bg-emerald-300 opacity-50 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-300 ring-2 ring-offset-1 ring-emerald-400"
                  }`}>
                  <CustomIcon name="Check" size={16} /> 게임 종료
                </button>
              )}

              <button onClick={() => patch("reset")} disabled={busy}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 text-sm font-bold transition-colors">
                <CustomIcon name="Reorder" size={16} /> 리셋
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              {isSequential && <><b>참여 열기</b>로 시청자 이름을 모으고, <b>추첨 시작</b>으로 순위를 추첨합니다. </>}
              {canAnnounce && !isSequential && <><b>참여 열기</b>로 시청자 참여를 받고, 마감 후 <b>결과 발표</b>로 당첨자를 가립니다. </>}
              {isBox && <><b>참여 열기</b> 후 시청자가 QR로 각자 박스를 엽니다. 마감하려면 <b>게임 종료</b>를 누르세요. </>}
              {isGoal && <><b>시작</b> 이후 결제 완료 주문 수가 목표 게이지에 실시간 반영됩니다. </>}
              <b>리셋</b>은 결과{isParticipation ? "·참여자" : ""}를 초기화합니다.
            </p>
          </>
        )}

        {/* 사다리 번호별 시작 */}
        {game.type === "LADDER" && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Hash size={15} className="text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">번호별 시작</h3>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">특정 번호를 선택하면 해당 경로가 애니메이션으로 추적됩니다.</p>
            <div className="flex flex-wrap gap-2">
              {game.items.map((_, i) => (
                <button key={i} onClick={() => patch("start", { selectedIndex: i })} disabled={busy}
                  className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 text-sm font-bold border border-amber-200 transition-colors">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                  번 시작
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 게임 쿠폰 관리 (상태 무관) */}
      <GameCouponManager gameId={game.id} onToast={showToast} />

      {/* 실시간 참여자 (참여형) */}
      {isParticipation && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CustomIcon name="Users" size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-gray-900">실시간 참여자</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {game.participantCount}명
              </span>
            </div>
            <button onClick={loadParticipants} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-amber-600">
              <CustomIcon name="Reorder" size={12} /> 새로고침
            </button>
          </div>

          {/* VOTE·QUIZ: 선택지별 실시간 바 차트 */}
          {(isVote || isQuiz) && (
            <div className="space-y-2 mb-3">
              {voteChoices.map((c, i) => {
                const cnt = voteCounts[i];
                const pct = voteTotal > 0 ? Math.round((cnt / voteTotal) * 100) : 0;
                const isAns = isQuiz && quizAnswerIndex === i;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className={`font-semibold ${isAns ? "text-emerald-700" : "text-gray-700"}`}>
                        {String.fromCharCode(65 + i)}. {c}
                        {isAns && <span className="ml-1 text-[10px] font-bold text-emerald-600">정답</span>}
                      </span>
                      <span className="text-gray-400">{cnt}{isVote ? "표" : "명"} · {pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isAns ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-amber-400 to-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* KEYWORD: 정답자 수 요약 */}
          {isKeyword && participants.length > 0 && (
            <p className="text-[11px] text-gray-500 mb-2">
              정답 <b className="text-emerald-600">{keywordCorrectCount}명</b> · 전체 {participants.length}명
              {cfg.winnerCount ? ` (선착순 ${cfg.winnerCount}명 당첨)` : ""}
            </p>
          )}

          {participants.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">아직 참여자가 없습니다. QR코드를 방송에 노출해 참여를 유도하세요.</p>
          ) : isVote ? (
            <p className="text-[11px] text-gray-400 text-center py-1">익명 투표 · 총 {voteTotal}표</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {participants.map((p) => {
                // 타입별 참여자 표시
                let extra: React.ReactNode = null;
                if (isKeyword) {
                  const ok = isKeywordCorrect(p.entry);
                  extra = (
                    <b className={ok ? "text-emerald-600" : "text-gray-400"}>
                      · {p.entry}{ok ? " ✓" : ""}
                    </b>
                  );
                } else if (isNumber) {
                  extra = <b className="text-amber-600">· {p.entry}</b>;
                } else if (isQuiz && p.entry != null) {
                  const idx = Number(p.entry);
                  const ok = idx === quizAnswerIndex;
                  extra = (
                    <b className={ok ? "text-emerald-600" : "text-gray-400"}>
                      · {Number.isInteger(idx) ? String.fromCharCode(65 + idx) : "-"}{ok ? " ✓" : ""}
                    </b>
                  );
                } else if (isBox) {
                  const box = parseBox(p.entry);
                  if (box) {
                    const miss = box.kind === "MISS";
                    extra = <b className={miss ? "text-gray-400" : "text-amber-600"}>· {box.label}</b>;
                  }
                }
                return (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
                    {p.isMember && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {p.name}
                    {extra}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 결과 발표 (종료 시) */}
      {finished && game.result && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-gray-900">결과</h2>
          </div>
          <ResultView type={game.type} result={game.result} />
        </div>
      )}

      {/* OBS/프리즘 오버레이 안내 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={16} className="text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900">방송 오버레이 (OBS · 프리즘)</h2>
        </div>

        {/* 오버레이 URL */}
        <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">오버레이 URL (투명 배경)</label>
        <div className="flex items-center gap-2 mb-2">
          <input readOnly value={overlayUrl}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[12px] text-gray-600 font-mono truncate" />
          <button onClick={() => copy(overlayUrl, "오버레이 URL")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold shrink-0 transition-colors">
            <CustomIcon name="Copy" size={14} /> 복사
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <a href={overlayUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-600 hover:text-amber-700">
            <Monitor size={12} /> 게임화면 보기
          </a>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-700">
            <CustomIcon name="ArrowRight" size={12} /> 미리보기 (일반 배경)
          </a>
        </div>

        {/* OBS 안내 */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CustomIcon name="Video" size={14} className="text-gray-500" />
            <h3 className="text-[13px] font-bold text-gray-700">OBS Studio 설정 방법</h3>
          </div>
          <ol className="text-[12px] text-gray-600 leading-relaxed space-y-1 list-decimal pl-4">
            <li>OBS 실행 → <b>소스</b> 추가(+) → <b>브라우저</b> 선택</li>
            <li>URL에 위 <b>오버레이 URL</b> 붙여넣기</li>
            <li><b>Allow transparency(투명도 허용)</b> 체크 ✓</li>
            <li>너비 <b>1920</b>, 높이 <b>1080</b> 설정</li>
            <li>확인 후 게임 소스를 <b>최상단 레이어</b>로 이동</li>
          </ol>
        </div>

        {/* 프리즘 안내 */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CustomIcon name="Video" size={14} className="text-gray-500" />
            <h3 className="text-[13px] font-bold text-gray-700">Prism Live Studio 설정 방법</h3>
          </div>
          <ol className="text-[12px] text-gray-600 leading-relaxed space-y-1 list-decimal pl-4">
            <li>레이아웃 편집 → <b>소스 추가</b> → <b>웹 브라우저</b> 선택</li>
            <li>위 <b>오버레이 URL</b> 입력, <b>투명 배경</b> 옵션 활성화</li>
            <li>화면에서 크기 및 위치 조정</li>
          </ol>
        </div>

        {/* 원리 */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <CustomIcon name="Warning" size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <b>투명 배경 작동 원리</b> — URL 뒤 <b>?overlay=true</b> 파라미터가 배경을 투명하게 처리해, 크로마키 없이
            게임 UI만 방송 화면에 오버레이됩니다. (권장 캔버스 1920×1080)
          </p>
        </div>
      </div>

      {/* QR 참여 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <CustomIcon name="QrCode" size={16} className={noViewerJoin ? "text-gray-300" : "text-amber-500"} />
          <h2 className="text-sm font-bold text-gray-900">QR코드 참여</h2>
        </div>

        {/* 시청자 참여 가능한 게임: 게임화면 QR 안내 */}
        {!noViewerJoin && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-3">
            <CustomIcon name="Info" size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              게임화면(오버레이)에 참여 QR코드가 적용돼 있습니다. 방송 화면에서 시청자가 직접 스캔할 수 있습니다.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-32 h-32 rounded-xl border border-gray-100 bg-white flex items-center justify-center overflow-hidden">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt="참여 QR코드"
                  className={`w-full h-full ${noViewerJoin ? "grayscale opacity-40" : ""}`}
                />
              ) : (
                <CustomIcon name="QrCode" size={40} className="text-gray-200" />
              )}
            </div>
            {qr && !noViewerJoin && (
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qr;
                  a.download = "game-qr.png";
                  a.click();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold transition-colors border border-amber-200 w-full justify-center"
              >
                <CustomIcon name="Download" size={11} /> QR 다운로드
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {noViewerJoin ? (
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3 mb-2">
                <CustomIcon name="Info" size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  이 게임은 시청자 직접 참여가 필요 없는 게임입니다. 셀러가 직접 진행하며 결과를 발표합니다.
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-gray-500 leading-relaxed mb-2">
                시청자가 이 QR코드를 스캔하면 참여 페이지가 열립니다. 방송 화면이나 채팅에 QR/링크를 노출하세요.
              </p>
            )}
            <div className="flex items-center gap-2">
              <input readOnly value={joinUrl}
                className={`flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-mono truncate ${
                  noViewerJoin ? "text-gray-400" : "text-gray-600"
                }`} />
              <button
                onClick={() => copy(joinUrl, "참여 링크")}
                disabled={noViewerJoin}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                  noViewerJoin
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white"
                }`}
              >
                <CustomIcon name="Copy" size={13} /> 복사
              </button>
            </div>
            {!noViewerJoin && (
              <a href={joinUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 mt-2">
                <CustomIcon name="ArrowRight" size={12} /> 참여 페이지 미리보기
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 설정 요약 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">게임 설정</h2>
        <ConfigSummary type={game.type} items={game.items} config={cfg} />
      </div>

      {/* 설정 수정 모달 */}
      {showEdit && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">게임 설정 수정 · {meta.label}</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {running ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-800 leading-relaxed">
                <CustomIcon name="Warning" size={15} className="text-amber-500 mt-0.5 shrink-0" />
                진행 중인 게임은 수정할 수 없습니다. 먼저 <b>리셋</b>한 뒤 수정하세요.
              </div>
            ) : (
              <>
                <div className="text-[11px] text-gray-500 leading-relaxed bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                  {GAME_TYPE_GUIDE[game.type as GameTypeId]}
                </div>
                <GameFields
                  type={game.type as GameTypeId}
                  title={editTitle}
                  items={editItems}
                  config={editConfig}
                  onTitle={setEditTitle}
                  onItems={setEditItems}
                  onConfig={setEditConfig}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {savingEdit ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={() => setShowEdit(false)}
                    className="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold transition-colors"
                  >
                    취소
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                  저장하면 게임이 <b>대기</b> 상태로 초기화되며 기존 결과는 지워집니다.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            {toast.ok ? <CustomIcon name="Check" size={16} className="text-emerald-400" /> : <CustomIcon name="Warning" size={16} className="text-amber-400" />}
            {toast.msg}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes toast-slide-down {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-slide-down { animation: toast-slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}

/* ── 결과 표시 ── */
function ResultView({ type, result }: { type: string; result: Record<string, any> }) {
  const chip = (label: string, i?: number) => (
    <span key={label + i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-[12px] font-bold text-emerald-800">
      <Trophy size={12} className="text-emerald-500" /> {label}
    </span>
  );

  if (type === "VOTE") {
    const choices: string[] = result.choices || [];
    const counts: number[] = result.counts || [];
    const total = result.total || 0;
    return (
      <div>
        {result.winnerIndex >= 0 && (
          <p className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-1.5"><Trophy size={14} className="text-emerald-500" /> 최다 득표: {result.winnerLabel}</p>
        )}
        <div className="space-y-2">
          {choices.map((c, i) => {
            const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="font-semibold text-gray-700">{c}</span>
                  <span className="text-gray-400">{counts[i]}표 · {pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "BOX_OPEN" && result.box) {
    const kindLabel: Record<string, string> = { PRODUCT: "상품", COUPON: "쿠폰", MISS: "꽝" };
    return (
      <p className="text-sm font-bold text-gray-800">
        열린 박스: <span className="text-amber-600">{result.box.label}</span>{" "}
        <span className="text-[11px] text-gray-400">({kindLabel[result.box.kind] || result.box.kind})</span>
      </p>
    );
  }

  if (type === "SEQUENTIAL" && Array.isArray(result.ranks)) {
    return (
      <div className="space-y-1.5">
        {result.ranks.map((r: any) => (
          <div key={r.rank} className="flex items-center gap-2 text-[13px]">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">{r.rank}</span>
            <b className="text-gray-800">{r.name}</b>
            {r.reward && <span className="text-[11px] text-gray-400">— {r.reward}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (result.winner) return <div className="flex flex-wrap gap-2">{chip(result.winner)}</div>;

  const winners: string[] = Array.isArray(result.winners) ? result.winners : [];
  if (winners.length === 0) return <p className="text-xs text-gray-400">당첨자가 없습니다.</p>;
  return <div className="flex flex-wrap gap-2">{winners.map((w, i) => chip(w, i))}</div>;
}

/* ── 설정 요약 ── */
function ConfigSummary({ type, items, config }: { type: string; items: string[]; config: Record<string, any> }) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 text-[13px] py-1.5">
      <span className="text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );

  if (usesItems(type)) {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-[12px] font-semibold text-amber-800">
              <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
              {item}
            </span>
          ))}
        </div>
        {type === "SEQUENTIAL" && (
          <div className="mt-3 pt-3 border-t border-gray-100">{row("당첨 순위", `1등 ~ ${config.rankCount ?? "-"}등`)}</div>
        )}
      </div>
    );
  }

  if (type === "KEYWORD")
    return (
      <div>
        {row("키워드", config.keyword || "-")}
        {row("당첨 인원", `${config.winnerCount ?? 1}명`)}
        {config.reward ? row("보상", config.reward) : null}
      </div>
    );

  if (type === "NUMBER_GUESS")
    return (
      <div>
        {row("정답", config.answer)}
        {row("범위", `${config.min} ~ ${config.max}`)}
        {row("당첨 방식", config.mode === "exact" ? "정답자" : "가장 가까운 N명")}
        {row("당첨 인원", `${config.winnerCount ?? 1}명`)}
      </div>
    );

  if (type === "QUIZ")
    return (
      <div>
        {row("문제", config.question || "-")}
        {row("선택지", (config.choices || []).map((c: string, i: number) => (
          <span key={i} className={`inline-block mr-1.5 px-2 py-0.5 rounded ${Number(config.answerIndex) === i ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-gray-100 text-gray-600"}`}>{c}</span>
        )))}
        {row("제한시간", `${config.timeLimit ?? 30}초`)}
      </div>
    );

  if (type === "VOTE")
    return (
      <div>
        {row("주제", config.topic || "-")}
        {row("선택지", (config.choices || []).join(", "))}
        {row("제한시간", `${config.timeLimit ?? 30}초`)}
      </div>
    );

  if (type === "GOAL_GAUGE")
    return (
      <div>
        {row("목표 수량", `${config.target ?? 0}건`)}
        {config.reward ? row("달성 보상", config.reward) : null}
      </div>
    );

  if (type === "BOX_OPEN") {
    const kindLabel: Record<string, string> = { PRODUCT: "상품", COUPON: "쿠폰", MISS: "꽝" };
    return (
      <div className="space-y-1.5">
        {(config.boxes || []).map((b: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            <b className="text-gray-800">{b.label}</b>
            <span className="text-[11px] text-gray-400">({kindLabel[b.kind] || b.kind})</span>
            <span className="ml-auto text-amber-600 font-bold">{b.prob}%</span>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 mt-1">시청자가 QR로 각자 박스를 열어 확률대로 결과를 받습니다.</p>
      </div>
    );
  }

  if (type === "SEQUENTIAL") {
    const rewards: string[] = Array.isArray(config.rewards) ? config.rewards : [];
    const hasReward = rewards.some((r) => r && r.trim());
    return (
      <div>
        {row("당첨 순위", `1등 ~ ${config.rankCount ?? "-"}등`)}
        {hasReward &&
          row(
            "순위별 보상",
            <div className="flex flex-col gap-0.5">
              {rewards.map((r, i) =>
                r && r.trim() ? (
                  <span key={i}>
                    <span className="text-amber-600 font-bold">{i + 1}등</span> — {r}
                  </span>
                ) : null,
              )}
            </div>,
          )}
        <p className="text-[11px] text-gray-400 mt-2">시청자가 QR로 이름을 등록하면 참여자 풀에서 순위를 추첨합니다.</p>
      </div>
    );
  }

  return null;
}
