"use client";

import { Icon as CustomIcon } from '@/components/shared/Icon';
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {Gamepad2, X, Disc3, Network, Ticket, Settings2, Zap, Hash, HelpCircle, BarChart3, Target, Package, ListOrdered, Monitor, Trophy} from 'lucide-react';
import {
  GAME_TYPES, GAME_TYPE_META, GAME_TYPE_GUIDE, defaultConfig, usesItems, usesParticipants,
  validateGameInput, type GameTypeId,
} from "@/lib/gameTypes";
import GameFields from "@/components/shared/GameFields";
import GameCouponDraft, { type DraftCoupon } from "@/components/shared/GameCouponDraft";

interface Game {
  id: string;
  type: string;
  title: string;
  items: string[];
  config: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Disc3, Network, Ticket, Zap, Hash, HelpCircle, BarChart3, Target, Package, ListOrdered,
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  IDLE: { label: "대기", cls: "bg-gray-100 text-gray-500" },
  RUNNING: { label: "진행중", cls: "bg-amber-100 text-amber-700" },
  FINISHED: { label: "종료", cls: "bg-emerald-100 text-emerald-700" },
};

export default function SellerGamesClient({
  games,
  visibleTypes,
}: {
  games: Game[];
  visibleTypes?: string[];
}) {
  const router = useRouter();
  // 최고관리자가 노출을 켠 게임 타입만 생성 목록에 표시 (미지정 시 전체 노출)
  const availableTypes = (
    visibleTypes ? GAME_TYPES.filter((t) => visibleTypes.includes(t)) : [...GAME_TYPES]
  ) as GameTypeId[];
  const firstType: GameTypeId = availableTypes[0] ?? GAME_TYPES[0];

  const [showCreate, setShowCreate] = useState(false);
  const [showGuide, setShowGuide] = useState<{ type: GameTypeId; title: string } | null>(null);
  const [type, setType] = useState<GameTypeId>(firstType);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", ""]);
  const [config, setConfig] = useState<Record<string, any>>(defaultConfig(firstType));
  const [coupons, setCoupons] = useState<DraftCoupon[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const resetForm = () => {
    setType(firstType);
    setTitle("");
    setItems(["", ""]);
    setConfig(defaultConfig(firstType));
    setCoupons([]);
  };

  const changeType = (t: GameTypeId) => {
    setType(t);
    setConfig(defaultConfig(t));
    if (t === "SEQUENTIAL") setItems((prev) => (prev.length >= 2 ? prev : ["", ""]));
  };

  const handleCreate = async () => {
    const err = validateGameInput(type, title, items, config);
    if (err) return showToast(err, false);

    const cleanItems = usesItems(type) ? items.map((i) => i.trim()).filter(Boolean) : [];
    // 선택지/보상 공백 정리
    const payloadConfig: Record<string, any> = { ...config };
    if (Array.isArray(payloadConfig.choices))
      payloadConfig.choices = payloadConfig.choices.map((c: string) => c.trim()).filter(Boolean);
    if (Array.isArray(payloadConfig.boxes))
      payloadConfig.boxes = payloadConfig.boxes
        .filter((b: any) => String(b.label).trim())
        .map((b: any) => ({ label: String(b.label).trim(), kind: b.kind, prob: Number(b.prob) || 0 }));

    setSaving(true);
    try {
      const res = await fetch("/api/seller/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title.trim(), items: cleanItems, config: payloadConfig }),
      });
      const data = await res.json();
      if (res.ok) {
        // 생성된 게임에 초안 쿠폰들을 일괄 등록
        if (coupons.length > 0 && data.game?.id) {
          await Promise.all(
            coupons.map((c) =>
              fetch(`/api/seller/games/${data.game.id}/coupons`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(c),
              }).catch(() => null),
            ),
          );
        }
        showToast("게임이 생성되었습니다");
        resetForm();
        setShowCreate(false);
        router.refresh();
      } else {
        showToast(data.error || "생성에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 게임을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/seller/games/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("삭제되었습니다");
        router.refresh();
      } else {
        const data = await res.json();
        showToast(data.error || "삭제에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    }
  };

  const openOverlayUrl = (id: string) => {
    const url = `${window.location.origin}/game/${id}?overlay=true`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyOverlayUrl = (id: string) => {
    const url = `${window.location.origin}/game/${id}?overlay=true`;
    navigator.clipboard?.writeText(url).then(
      () => showToast("오버레이 URL이 복사되었습니다"),
      () => showToast("복사에 실패했습니다", false),
    );
  };

  return (
    <div className="animate-fade-in">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">게임관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            룰렛·퀴즈·투표·박스깡 등 방송(OBS/프리즘) 참여 게임을 만들고 오버레이로 사용하세요
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          disabled={availableTypes.length === 0}
          title={availableTypes.length === 0 ? "현재 생성 가능한 게임 유형이 없습니다" : undefined}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          {showCreate ? <X size={15} /> : <CustomIcon name="Plus" size={15} />}
          {showCreate ? "닫기" : "새 게임"}
        </button>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
        <CustomIcon name="Warning" size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          게임을 만들면 고유 URL이 발급됩니다. 방송 소프트웨어의 <b>브라우저 소스</b>로{" "}
          <b>?overlay=true</b> URL을 넣으면 투명 배경 위에 게임 화면만 표시됩니다. (크로마키 불필요)
          시청자는 <b>QR코드</b>로 참여할 수 있습니다.
        </p>
      </div>

      {/* 생성 폼 */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 animate-fade-in">
          <h2 className="text-sm font-bold text-gray-900 mb-3">새 게임 만들기</h2>

          {/* 게임 종류 */}
          <label className="block text-xs font-semibold text-gray-500 mb-2">게임 종류</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {availableTypes.map((t) => {
              const meta = GAME_TYPE_META[t];
              const Icon = ICONS[meta.icon] || Disc3;
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => changeType(t)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg border-2 transition-all ${
                    active
                      ? "border-amber-400 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-amber-200"
                  }`}
                >
                  <Icon size={20} className={active ? "text-amber-600" : "text-gray-400"} />
                  <span
                    className={`text-[11px] font-bold text-center leading-tight ${active ? "text-amber-700" : "text-gray-600"}`}
                  >
                    {meta.label}
                  </span>
                  {usesParticipants(t) && (
                    <span className="text-[9px] bg-blue-50 text-blue-500 px-1 py-0.5 rounded-full font-semibold leading-none">
                      시청자 참여가능
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-gray-500 leading-relaxed bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            {GAME_TYPE_GUIDE[type]}
          </div>

          <GameFields
            type={type}
            title={title}
            items={items}
            config={config}
            onTitle={setTitle}
            onItems={setItems}
            onConfig={setConfig}
          />

          <GameCouponDraft value={coupons} onChange={setCoupons} onToast={showToast} />

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {saving ? "생성 중..." : "게임 생성"}
            </button>
            <button
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 게임 목록 */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Gamepad2 size={30} className="text-amber-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">아직 만든 게임이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">새 게임을 만들어 방송에서 활용해보세요</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {games.map((g) => {
            const meta = GAME_TYPE_META[g.type as GameTypeId] || GAME_TYPE_META.ROULETTE;
            const Icon = ICONS[meta.icon] || Disc3;
            const st = STATUS_META[g.status] || STATUS_META.IDLE;
            const detail = usesItems(g.type)
              ? `항목 ${g.items.length}개`
              : GAME_TYPE_META[g.type as GameTypeId]?.category === "order"
                ? "주문 목표"
                : "참여형";
            return (
              <div key={g.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{g.title}</p>
                      <p className="text-[11px] text-gray-400">{meta.label} · {detail}</p>
                      {usesParticipants(g.type) ? (
                        <span className="inline-block mt-0.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">시청자 참여가능</span>
                      ) : (
                        <span className="inline-block mt-0.5 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-semibold">셀러 진행</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/seller/games/${g.id}`}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
                  >
                    <Settings2 size={13} /> 관리
                  </Link>
                  <button
                    onClick={() => setShowGuide({ type: g.type as GameTypeId, title: g.title })}
                    title="게임 설명 보기"
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                  >
                    <CustomIcon name="File" size={13} />
                  </button>
                  <button
                    onClick={() => openOverlayUrl(g.id)}
                    title="게임화면 새 창에서 열기"
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                  >
                    <Monitor size={13} /> 게임화면 보기
                  </button>
                  <button
                    onClick={() => copyOverlayUrl(g.id)}
                    title="게임화면 URL 복사"
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                  >
                    <CustomIcon name="Copy" size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <CustomIcon name="Delete" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 게임 설명 모달 */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowGuide(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CustomIcon name="File" size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900">게임 사용 가이드</h2>
              </div>
              <button
                onClick={() => setShowGuide(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 게임 제목 + 유형 설명 */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wide mb-1">
                  {GAME_TYPE_META[showGuide.type]?.label ?? showGuide.type}
                </p>
                <p className="text-xs font-bold text-amber-900 mb-2 truncate">{showGuide.title}</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {GAME_TYPE_GUIDE[showGuide.type]}
                </p>
              </div>

              {/* 플레이 방법 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-[12px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <CustomIcon name="File" size={13} className="text-gray-400" /> 플레이 방법
                </h3>
                <div className="space-y-2 text-[12px] text-gray-600 leading-relaxed">
                  <p><span className="font-semibold text-gray-700">진행자(셀러):</span> 게임을 생성한 후 라이브 방송 중 컨트롤 패널에서 게임을 시작하세요. 오버레이 URL을 OBS/프리즘 브라우저 소스에 연결하면 방송 화면에 게임이 표시됩니다.</p>
                  <p><span className="font-semibold text-gray-700">시청자:</span> 방송 화면의 QR코드를 스마트폰으로 스캔하거나 링크로 접속해 참여합니다. 별도 앱 설치 없이 브라우저에서 바로 참여할 수 있습니다.</p>
                </div>
              </div>

              {/* OBS 설정 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-[12px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <CustomIcon name="Video" size={13} className="text-gray-400" /> OBS / 프리즘 오버레이 설정
                </h3>
                <ol className="text-[12px] text-gray-600 leading-relaxed space-y-1 list-decimal pl-4">
                  <li>게임 관리 페이지에서 <b>오버레이 URL 복사</b></li>
                  <li>OBS: 소스 추가(+) → <b>브라우저</b> → URL 붙여넣기 → <b>Allow transparency(투명도 허용)</b> 체크</li>
                  <li>너비 <b>1920</b>, 높이 <b>1080</b> 권장 / 게임 소스를 <b>최상단 레이어</b>로 이동</li>
                  <li>프리즘: 소스 추가 → <b>웹 브라우저</b> → URL 입력 → <b>투명 배경</b> 옵션 활성화</li>
                </ol>
                <div className="mt-2.5 bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[11px] text-gray-500 font-mono">
                    OBS 사용자 정의 CSS 추가 권장:<br />
                    <span className="text-amber-700 font-semibold">body {'{ background: transparent !important; }'}</span>
                  </p>
                </div>
              </div>

              {/* QR코드 활용법 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-[12px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <CustomIcon name="QrCode" size={13} className="text-gray-400" /> QR코드 활용법
                </h3>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  시청자들이 스마트폰으로 QR코드를 스캔하여 참여 페이지에 접속합니다. 게임 관리 페이지에서 QR코드를 확인하고, 방송 화면에 크게 노출하거나 채팅에 참여 링크를 공유하세요. 별도 앱 설치 없이 모바일 브라우저에서 바로 참여됩니다.
                </p>
              </div>

              {/* 시상 방법 */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-[12px] font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Trophy size={13} className="text-amber-400" /> 시상 방법
                </h3>
                <p className="text-[12px] text-gray-600 leading-relaxed">
                  게임 종료 후 당첨자 목록에서 쿠폰을 발급하거나 채팅으로 당첨자를 호명하세요. 게임 관리 페이지의 <b>쿠폰 관리</b> 탭에서 당첨자에게 직접 쿠폰을 발급할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            {toast.ok ? (
              <CustomIcon name="Check" size={16} className="text-emerald-400" />
            ) : (
              <CustomIcon name="Warning" size={16} className="text-amber-400" />
            )}
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
