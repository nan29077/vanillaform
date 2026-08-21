"use client";

import { Icon as CustomIcon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import {Target, Loader2, Gift, Ticket, Wind, Package} from 'lucide-react';

interface JoinGame {
  id: string;
  type: string;
  title: string;
  status: string;
  updatedAt: string;
  config: Record<string, any> | null;
}

const KIND_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  PRODUCT: Gift,
  COUPON: Ticket,
  MISS: Wind,
};

export default function GameJoinClient({
  game,
  defaultName,
  isMember,
}: {
  game: JoinGame;
  defaultName: string;
  isMember: boolean;
}) {
  const cfg = game.config || {};
  const [name, setName] = useState(defaultName);
  const [entry, setEntry] = useState<string>("");
  const [choiceIdx, setChoiceIdx] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [boxResult, setBoxResult] = useState<{ label: string; kind: string } | null>(null);
  const [loginHref, setLoginHref] = useState("/auth/login");

  // updatedAt을 포함해서 셀러가 게임을 재시작(새 회차)하면 storageKey가 바뀌어 재참여 가능
  const storageKey = `sb_game_joined_${game.id}_${game.updatedAt}`;

  // 로그인 후 이 참여 페이지로 돌아오도록 callbackUrl 구성
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginHref(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    }
  }, []);

  // 게임 레이아웃(투명/overflow hidden !important)을 일반 모바일 페이지로 복원.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const apply = (el: HTMLElement, k: string, v: string) => el.style.setProperty(k, v, "important");
    apply(html, "background", "#fff7e8");
    apply(html, "height", "auto");
    apply(body, "background", "#fff7e8");
    apply(body, "background-image", "none");
    apply(body, "overflow", "auto");
    apply(body, "height", "auto");
    apply(body, "min-height", "100dvh");
    return () => {
      [html, body].forEach((el) => {
        ["background", "background-image", "overflow", "height", "min-height"].forEach((k) =>
          el.style.removeProperty(k),
        );
      });
    };
  }, []);

  // 중복 참여 방지: 같은 브라우저에서 이미 참여했는지 확인
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setState("done");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.box) setBoxResult(parsed.box);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const choices: string[] = Array.isArray(cfg.choices) ? cfg.choices : [];
  const type = game.type;
  const isSequential = type === "SEQUENTIAL";
  const isQuiz = type === "QUIZ";
  const isVote = type === "VOTE";
  const isNumber = type === "NUMBER_GUESS";
  const isKeyword = type === "KEYWORD";
  const isBox = type === "BOX_OPEN";
  const isGoal = type === "GOAL_GAUGE";
  const needsName = !isVote; // 투표만 익명 허용

  const isRunning = game.status === "RUNNING";
  const isFinished = game.status === "FINISHED";

  const submit = async () => {
    setError("");
    if (needsName && !name.trim()) return setError("이름(닉네임)을 입력해주세요");

    let entryVal: string | undefined;
    if (isQuiz || isVote) {
      if (choiceIdx === null) return setError("선택지를 골라주세요");
      entryVal = String(choiceIdx);
    } else if (isNumber) {
      if (entry.trim() === "" || Number.isNaN(Number(entry))) return setError("숫자를 입력해주세요");
      entryVal = entry.trim();
    } else if (isKeyword) {
      if (!entry.trim()) return setError("키워드를 입력해주세요");
      entryVal = entry.trim();
    }

    setState("sending");
    try {
      const res = await fetch(`/api/games/${game.id}/participate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), entry: entryVal, gameType: type }),
      });
      const data = await res.json();
      if (res.ok) {
        let box: { label: string; kind: string } | null = null;
        if (isBox && data.result) {
          // BOX_OPEN: 서버가 계산한 결과 즉시 표시
          const kind = typeof cfg.boxes === "object" && Array.isArray(cfg.boxes)
            ? (cfg.boxes.find((b: any) => b.label === data.result)?.kind ?? "MISS")
            : "MISS";
          box = { label: String(data.result), kind };
          setBoxResult(box);
        }
        try {
          localStorage.setItem(storageKey, JSON.stringify(box ? { box } : { joined: true }));
        } catch {
          /* ignore */
        }
        setState("done");
      } else {
        setError(data.error || "참여에 실패했습니다");
        setState("idle");
      }
    } catch {
      setError("오류가 발생했습니다");
      setState("idle");
    }
  };

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-colors";

  // 참여 완료 화면
  const renderDone = () => {
    if (isBox && boxResult) {
      const miss = boxResult.kind === "MISS";
      const Icon = KIND_ICON[boxResult.kind] || Package;
      return (
        <div className="flex flex-col items-center text-center py-4">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${miss ? "bg-gray-100" : "bg-amber-50"}`}
          >
            <Icon size={38} className={miss ? "text-gray-400" : "text-amber-500"} />
          </div>
          <p className="text-[11px] font-semibold text-gray-400 mb-1">박스 오픈 결과</p>
          <h1 className={`text-2xl font-bold mb-2 ${miss ? "text-gray-500" : "text-amber-600"}`}>
            {boxResult.label}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {miss ? "아쉽지만 다음 기회에!" : "축하합니다! 방송에서 안내를 확인하세요."}
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <CustomIcon name="Check" size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1.5">
          {isVote ? "투표 완료" : "참여 완료"}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {name.trim() && <b className="text-amber-600">{name}</b>}
          {name.trim() ? "님, " : ""}
          {isVote ? "소중한 한 표 감사합니다." : "참여가 접수되었습니다."}
          <br />방송 화면에서 결과를 확인하세요.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        {/* 상단 로고 헤더 */}
        <header className="mb-5 flex flex-col items-center rounded-2xl bg-white border border-amber-100 py-4 px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="바닐라폼 게임" className="h-8 w-auto object-contain" />
          <p className="mt-2 text-[11px] font-semibold text-amber-700/70">라이브 게임 참여</p>
        </header>

        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6">
          {state === "done" ? (
            renderDone()
          ) : isGoal ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <Target size={30} className="text-amber-400" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-1.5">함께 목표를 달성해요</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                이 게임은 별도 참여 없이 <b>구매 수량</b>으로 진행됩니다.
                <br />방송 화면의 목표 게이지를 확인하세요.
              </p>
            </div>
          ) : isFinished ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <CustomIcon name="Lock" size={30} className="text-gray-400" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-1.5">참여가 마감되었습니다</h1>
              <p className="text-sm text-gray-500">이미 종료된 게임입니다.</p>
            </div>
          ) : !isRunning ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <CustomIcon name="Clock" size={30} className="text-gray-400" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-1.5">현재 참여 가능한 게임이 아닙니다</h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                아직 참여가 시작되지 않았습니다.
                <br />방송에서 안내가 나오면 다시 시도해주세요.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-gray-900 text-center mb-1">{game.title}</h1>
              <p className="text-xs text-gray-400 text-center mb-5">
                {isBox
                  ? "박스를 열어 결과를 확인하세요"
                  : isVote
                    ? "선택지에 투표하세요"
                    : "아래 정보를 입력하고 참여하세요"}
              </p>

              {/* 비회원 로그인 유도 — 로그인 시 당첨 쿠폰 자동 수령 */}
              {!isMember && (
                <a
                  href={loginHref}
                  className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <CustomIcon name="Login" size={15} className="shrink-0 text-amber-500" />
                  <span className="text-[12px] leading-snug flex-1">
                    <b>로그인</b>하고 참여하면 당첨 시 <b>쿠폰을 자동으로</b> 받을 수 있어요
                  </span>
                  <span className="text-[11px] font-bold shrink-0">로그인 →</span>
                </a>
              )}

              {/* 이름 (투표 제외) */}
              {needsName && (
                <>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름 · 닉네임</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예) 바닐라 플라워123"
                    maxLength={20}
                    className={inputCls}
                  />
                  {isMember && (
                    <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CustomIcon name="Check" size={12} strokeWidth={3} /> 로그인 계정으로 참여합니다
                    </p>
                  )}
                </>
              )}

              {/* 키워드 */}
              {isKeyword && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">키워드 입력</label>
                  <input
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="방송에서 안내된 키워드"
                    maxLength={30}
                    className={inputCls}
                  />
                </div>
              )}

              {/* 숫자 */}
              {isNumber && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    숫자 예측 {cfg.min != null && cfg.max != null ? `(${cfg.min} ~ ${cfg.max})` : ""}
                  </label>
                  <input
                    type="number"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="정답이라고 생각하는 숫자"
                    className={inputCls}
                  />
                </div>
              )}

              {/* 퀴즈/투표 선택지 */}
              {(isQuiz || isVote) && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    {isQuiz ? (cfg.question || "정답 선택") : (cfg.topic || "선택")}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {choices.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setChoiceIdx(i)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left text-sm font-semibold transition-all ${
                          choiceIdx === i
                            ? "border-amber-400 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-amber-200"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 ${
                            choiceIdx === i ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {i + 1}
                        </span>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 박스깡 안내 */}
              {isBox && (
                <div className="mt-4 flex flex-col items-center">
                  <CustomIcon name="Package" size={56} className="text-amber-400 mb-2" strokeWidth={1.5} />
                  <p className="text-xs text-gray-400 text-center">버튼을 누르면 확률에 따라 결과가 결정됩니다</p>
                </div>
              )}

              {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

              <button
                onClick={submit}
                disabled={state === "sending"}
                className="w-full mt-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-base font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {state === "sending" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> 처리 중...
                  </>
                ) : (
                  <>
                    {isBox ? <CustomIcon name="Package" size={18} /> : <CustomIcon name="Check" size={18} />}{" "}
                    {isBox ? "박스 열기" : isVote ? "투표하기" : isSequential ? "참여 신청" : "제출하기"}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-amber-700/50 mt-5">
          Powered by 바닐라폼 라이브 게임
        </p>
      </div>
    </div>
  );
}
