"use client";

;
import { Icon } from '@/components/shared/Icon';
import { usesItems, type GameTypeId } from "@/lib/gameTypes";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400";

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{children}</p>;
}

interface GameFieldsProps {
  type: GameTypeId;
  title: string;
  items: string[];
  config: Record<string, any>;
  onTitle: (v: string) => void;
  onItems: (v: string[]) => void;
  onConfig: (v: Record<string, any>) => void;
}

// 생성/수정 공용 — 제목 + 항목 + 타입별 config 입력 필드 (안내 문구 포함)
export default function GameFields({
  type, title, items, config, onTitle, onItems, onConfig,
}: GameFieldsProps) {
  const cfg = (k: string, v: any) => onConfig({ ...config, [k]: v });

  // 항목(룰렛/사다리/제비뽑기/연속룰렛)
  const handleItemChange = (i: number, val: string) =>
    onItems(items.map((v, idx) => (idx === i ? val : v)));
  const addItem = () => onItems([...items, ""]);
  const removeItem = (i: number) => {
    if (items.length <= 2) return;
    onItems(items.filter((_, idx) => idx !== i));
  };

  // 선택지(퀴즈/투표)
  const choices: string[] = Array.isArray(config.choices) ? config.choices : [];
  const setChoice = (i: number, val: string) =>
    cfg("choices", choices.map((c, idx) => (idx === i ? val : c)));
  const addChoice = () => { if (choices.length < 4) cfg("choices", [...choices, ""]); };
  const removeChoice = (i: number) => {
    if (choices.length <= 2) return;
    const next = choices.filter((_, idx) => idx !== i);
    const patch: Record<string, any> = { ...config, choices: next };
    if (type === "QUIZ" && Number(config.answerIndex) >= next.length) patch.answerIndex = 0;
    onConfig(patch);
  };

  // 박스깡
  const boxes: { label: string; kind: string; prob: number }[] = Array.isArray(config.boxes)
    ? config.boxes
    : [];
  const setBox = (i: number, patch: Partial<{ label: string; kind: string; prob: number }>) =>
    cfg("boxes", boxes.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBox = () => cfg("boxes", [...boxes, { label: "", kind: "MISS", prob: 10 }]);
  const removeBox = (i: number) => {
    if (boxes.length <= 1) return;
    cfg("boxes", boxes.filter((_, idx) => idx !== i));
  };

  // 연속 룰렛 보상
  const rewards: string[] = Array.isArray(config.rewards) ? config.rewards : [];
  const rankCount = config.rankCount ?? 3;
  const setRankCount = (n: number) => {
    const rc = Math.max(1, Math.min(n, 20));
    onConfig({ ...config, rankCount: rc, rewards: Array.from({ length: rc }, (_, i) => rewards[i] ?? "") });
  };

  return (
    <>
      {/* 제목 */}
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">제목</label>
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="예) 오늘의 이벤트 게임"
        maxLength={40}
        className={inputCls + " mb-4"}
      />

      {/* ── 항목 기반 (룰렛/사다리/제비뽑기/연속룰렛) ── */}
      {usesItems(type) && (
        <>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">
            항목 <span className="text-gray-300 font-normal">(최소 2개)</span>
          </label>
          <div className="space-y-2 mb-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <input
                  value={item}
                  onChange={(e) => handleItemChange(i, e.target.value)}
                  placeholder={`항목 ${i + 1}`}
                  maxLength={30}
                  className={inputCls + " flex-1"}
                />
                <button
                  onClick={() => removeItem(i)}
                  disabled={items.length <= 2}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                >
                  <Icon name="Delete" size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 mb-4"
          >
            <Icon name="Plus" size={14} /> 항목 추가
          </button>
        </>
      )}

      {/* ── 연속 룰렛: 순위 수 + 보상 ── */}
      {type === "SEQUENTIAL" && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">당첨 순위 수</label>
          <input
            type="number" min={1} max={20}
            value={rankCount}
            onChange={(e) => setRankCount(Number(e.target.value))}
            className={inputCls}
          />
          <Hint>당첨자를 뽑을 순위 수입니다. 예: 3으로 설정하면 1등, 2등, 3등을 차례로 추첨합니다.</Hint>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 mt-3">순위별 보상 (선택)</label>
          <div className="space-y-2">
            {Array.from({ length: rankCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-600 w-9 shrink-0">{i + 1}등</span>
                <input
                  value={rewards[i] ?? ""}
                  onChange={(e) =>
                    cfg("rewards", Array.from({ length: rankCount }, (_, idx) =>
                      idx === i ? e.target.value : (rewards[idx] ?? ""),
                    ))
                  }
                  placeholder={`${i + 1}등 보상 (예: 5,000원 쿠폰)`}
                  className={inputCls + " flex-1"}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 선착순 키워드 ── */}
      {type === "KEYWORD" && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">키워드</label>
            <input value={config.keyword ?? ""} onChange={(e) => cfg("keyword", e.target.value)}
              placeholder="예) 바닐라폼" maxLength={30} className={inputCls} />
            <Hint>시청자가 채팅에 입력해야 하는 정확한 단어를 입력하세요. 대소문자는 구분하지 않습니다.</Hint>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">당첨 인원</label>
              <input type="number" min={1} value={config.winnerCount ?? 1}
                onChange={(e) => cfg("winnerCount", Number(e.target.value))} className={inputCls} />
              <Hint>동시에 당첨될 최대 인원 수입니다.</Hint>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">보상 (선택)</label>
              <input value={config.reward ?? ""} onChange={(e) => cfg("reward", e.target.value)}
                placeholder="예: 쿠폰" className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* ── 숫자 맞히기 ── */}
      {type === "NUMBER_GUESS" && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">정답 (셀러만)</label>
              <input type="number" value={config.answer ?? 0}
                onChange={(e) => cfg("answer", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">최소</label>
              <input type="number" value={config.min ?? 1}
                onChange={(e) => cfg("min", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">최대</label>
              <input type="number" value={config.max ?? 100}
                onChange={(e) => cfg("max", Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <Hint>정답 숫자는 시청자에게는 보이지 않습니다. 게임 종료 후 공개됩니다. 최소·최대는 시청자가 입력할 수 있는 숫자의 최솟값과 최댓값입니다.</Hint>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">당첨 방식</label>
              <select value={config.mode ?? "closest"} onChange={(e) => cfg("mode", e.target.value)} className={inputCls}>
                <option value="closest">가장 가까운 N명</option>
                <option value="exact">정답자</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">당첨 인원</label>
              <input type="number" min={1} value={config.winnerCount ?? 1}
                onChange={(e) => cfg("winnerCount", Number(e.target.value))} className={inputCls} />
              <Hint>동시에 당첨될 최대 인원 수입니다.</Hint>
            </div>
          </div>
        </div>
      )}

      {/* ── 라이브 퀴즈 / 실시간 투표 (선택지 공유) ── */}
      {(type === "QUIZ" || type === "VOTE") && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              {type === "QUIZ" ? "문제" : "투표 주제"}
            </label>
            <input
              value={type === "QUIZ" ? (config.question ?? "") : (config.topic ?? "")}
              onChange={(e) => cfg(type === "QUIZ" ? "question" : "topic", e.target.value)}
              placeholder={type === "QUIZ" ? "예) 바닐라폼 마스코트는?" : "예) 다음 라이브 상품은?"}
              maxLength={80} className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              선택지 <span className="text-gray-300 font-normal">(2~4개)</span>
            </label>
            <div className="space-y-2">
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  {type === "QUIZ" ? (
                    <button
                      onClick={() => cfg("answerIndex", i)}
                      title="정답으로 지정"
                      className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 border-2 transition-colors ${
                        Number(config.answerIndex) === i
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-white border-gray-200 text-gray-400"
                      }`}
                    >
                      {Number(config.answerIndex) === i ? "✓" : i + 1}
                    </button>
                  ) : (
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                  )}
                  <input value={c} onChange={(e) => setChoice(i, e.target.value)}
                    placeholder={`선택지 ${i + 1}`} maxLength={30} className={inputCls + " flex-1"} />
                  <button onClick={() => removeChoice(i)} disabled={choices.length <= 2}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                    <Icon name="Delete" size={15} />
                  </button>
                </div>
              ))}
            </div>
            {choices.length < 4 && (
              <button onClick={addChoice} className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 mt-2">
                <Icon name="Plus" size={14} /> 선택지 추가
              </button>
            )}
            {type === "QUIZ" && (
              <p className="text-[11px] text-gray-400 mt-2">
                왼쪽 동그라미를 눌러 <b className="text-emerald-600">정답</b>을 지정하세요.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">제한시간 (초)</label>
            <input type="number" min={0} value={config.timeLimit ?? 30}
              onChange={(e) => cfg("timeLimit", Number(e.target.value))} className={inputCls} />
            <Hint>0으로 설정하면 제한시간 없이 진행됩니다.</Hint>
          </div>
        </div>
      )}

      {/* ── 공동 목표 게이지 ── */}
      {type === "GOAL_GAUGE" && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">목표 주문 수량</label>
            <input type="number" min={1} value={config.target ?? 100}
              onChange={(e) => cfg("target", Number(e.target.value))} className={inputCls} />
            <Hint>해당 라이브에서 달성할 주문 수량 목표입니다.</Hint>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">달성 보상 (선택)</label>
            <input value={config.reward ?? ""} onChange={(e) => cfg("reward", e.target.value)}
              placeholder="예: 전 상품 10% 할인 쿠폰" className={inputCls} />
            <Hint>목표 달성 시 모든 구매자에게 제공할 혜택을 입력하세요. (예: 10% 추가 할인 쿠폰)</Hint>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            진행 상황은 게임 생성 이후 결제 완료 주문 수로 실시간 집계됩니다.
          </p>
        </div>
      )}

      {/* ── 박스깡 ── */}
      {type === "BOX_OPEN" && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-2">박스 항목 · 확률(%)</label>
          <div className="space-y-2">
            {boxes.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={b.label} onChange={(e) => setBox(i, { label: e.target.value })}
                  placeholder="항목명" maxLength={20} className={inputCls + " flex-1"} />
                <select value={b.kind} onChange={(e) => setBox(i, { kind: e.target.value })}
                  className="px-2 py-2 rounded-lg border border-gray-200 text-xs shrink-0">
                  <option value="PRODUCT">상품</option>
                  <option value="COUPON">쿠폰</option>
                  <option value="MISS">꽝</option>
                </select>
                <input type="number" min={0} value={b.prob}
                  onChange={(e) => setBox(i, { prob: Number(e.target.value) })}
                  className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm shrink-0" />
                <button onClick={() => removeBox(i)} disabled={boxes.length <= 1}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                  <Icon name="Delete" size={15} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addBox} className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 mt-2">
            <Icon name="Plus" size={14} /> 박스 추가
          </button>
          <Hint>모든 항목의 확률 합계가 100이 되도록 설정하세요.</Hint>
          <p className="text-[11px] text-gray-400 mt-1">
            확률 합계: <b>{boxes.reduce((a, b) => a + (Number(b.prob) || 0), 0)}%</b> (합이 100이 아니어도 비율대로 적용됩니다)
          </p>
        </div>
      )}
    </>
  );
}
