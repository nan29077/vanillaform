"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Upload, X, Sparkles} from 'lucide-react';
import { InstagramIcon, YoutubeIcon, TiktokIcon, FacebookIcon, TwitterXIcon } from "@/components/shared/SnsIcons";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";

interface PickSellerButtonProps {
  sellerId: string;
  sellerName: string;
  sellerChannels?: {
    instagram?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
    facebook?: string | null;
    twitter?: string | null;
  };
  variant?: "default" | "icon" | "large";
  className?: string;
}

interface ChannelVerification {
  id: string;
  channelType: string;
  status: string;
  screenshotUrl?: string;
}

const CHANNEL_META: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  instagram: { label: "인스타그램", icon: InstagramIcon, color: "text-pink-500", bgColor: "bg-pink-50" },
  youtube: { label: "유튜브", icon: YoutubeIcon, color: "text-red-500", bgColor: "bg-red-50" },
  tiktok: { label: "틱톡", icon: TiktokIcon, color: "text-gray-800", bgColor: "bg-gray-50" },
  facebook: { label: "페이스북", icon: FacebookIcon, color: "text-blue-500", bgColor: "bg-blue-50" },
  twitter: { label: "X (트위터)", icon: TwitterXIcon, color: "text-gray-800", bgColor: "bg-gray-50" },
};

export default function PickSellerButton({
  sellerId,
  sellerName,
  sellerChannels,
  variant = "default",
  className = "",
}: PickSellerButtonProps) {
  const { appConfirm, appAlert } = useAppDialog();
  const { data: session } = useSession();
  const router = useRouter();
  const [isPicked, setIsPicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifications, setVerifications] = useState<ChannelVerification[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (session) {
      fetch(`/api/sellers/pick?sellerId=${sellerId}`)
        .then((r) => r.json())
        .then((d) => setIsPicked(d.picked))
        .catch(() => {});
      // 채널 인증 상태 조회
      fetch(`/api/channel-verification?sellerId=${sellerId}`)
        .then((r) => r.json())
        .then((d) => setVerifications(d.verifications || []))
        .catch(() => {});
    }
  }, [session, sellerId]);

  const handlePick = async () => {
    if (!session) {
      router.push("/auth/login");
      return;
    }

    // Pick 해제 시 경고
    if (isPicked) {
      const msg = hasApprovedChannel
        ? "Pick을 취소하면 채널인증 할인 혜택이 사라지며,\n다시 할인을 받으려면 Pick 후 채널 인증을 다시 해야 합니다.\n\n정말 Pick을 취소하시겠습니까?"
        : "Pick을 취소하시겠습니까?\n취소 후 다시 Pick하면 채널 인증을 다시 진행해야 합니다.";
      const confirmed = await appConfirm(msg);
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sellers/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      const data = await res.json();

      // 거절 이력이 있어 재인증 필요
      if (data.needVerification) {
        setIsPicked(false);
        setVerifications([]);
        await appAlert(data.message);
        // 거절 기록 정리 후 다시 Pick 시도 → 팝업에서 인증 유도
        const res2 = await fetch("/api/sellers/pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerId }),
        });
        const data2 = await res2.json();
        setIsPicked(data2.picked);
        if (data2.picked) setShowPopup(true);
        return;
      }

      setIsPicked(data.picked);

      if (data.picked) {
        // Pick 했을 때 팝업 표시
        setShowPopup(true);
      } else {
        // Pick 취소 시 채널인증 상태 초기화
        setVerifications([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleChannelVerify = async (channelType: string) => {
    setSelectedChannel(channelType);
    setShowVerifyModal(true);
  };

  const [ocrResult, setOcrResult] = useState<{ verified: boolean; confidence: number; message?: string } | null>(null);

  const submitVerification = async (screenshotUrl: string) => {
    if (!selectedChannel) return;
    try {
      setUploading(true);
      setOcrResult(null);
      const res = await fetch("/api/channel-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, channelType: selectedChannel, screenshotUrl }),
      });
      const data = await res.json();
      if (data.verification) {
        setVerifications((prev) => {
          const existing = prev.findIndex((v) => v.channelType === selectedChannel);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data.verification;
            return updated;
          }
          return [...prev, data.verification];
        });
      }
      // OCR 결과 표시
      if (data.ocrResult) {
        setOcrResult(data.ocrResult);
        if (data.ocrResult.verified) {
          // OCR 자동 승인됨 - 3초 후 자동 닫기
          setTimeout(() => {
            setShowVerifyModal(false);
            setSelectedChannel(null);
            setOcrResult(null);
          }, 3000);
        } else {
          // 수동 검토 필요 - 2초 후 닫기
          setTimeout(() => {
            setShowVerifyModal(false);
            setSelectedChannel(null);
            setOcrResult(null);
          }, 2500);
        }
      } else {
        setShowVerifyModal(false);
        setSelectedChannel(null);
      }
    } catch {
      appAlert("인증 제출에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const getVerificationStatus = (channelType: string) => {
    return verifications.find((v) => v.channelType === channelType);
  };

  // Available channels for this seller
  const availableChannels = sellerChannels
    ? Object.entries(sellerChannels).filter(([, url]) => !!url).map(([type]) => type)
    : [];

  const hasApprovedChannel = verifications.some((v) => v.status === "APPROVED");
  const hasPendingChannel = verifications.some((v) => v.status === "PENDING");

  // 인증 필요한 상태에서 팝업 닫기 → Pick 취소
  const needsVerification = availableChannels.length > 0 && !hasApprovedChannel;
  const closePopup = async () => {
    setShowPopup(false);
    if (needsVerification && isPicked) {
      // 인증 안 하고 닫으면 Pick 취소
      await fetch("/api/sellers/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      setIsPicked(false);
    }
  };

  // ─── PICK 안내 팝업 ───
  const PickPopup = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closePopup}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 그래디언트 */}
        <div className="bg-gradient-to-br from-brand-500 to-pink-500 px-6 pt-8 pb-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
            <div className="absolute -bottom-5 -left-5 w-24 h-24 bg-white rounded-full" />
          </div>
          <button
            onClick={closePopup}
            className="absolute top-3 right-3 p-1.5 text-white/60 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur mx-auto flex items-center justify-center mb-3">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Pick 완료!</h2>
            <p className="text-white/80 text-sm">{sellerName}을(를) Pick 하셨습니다</p>
          </div>
        </div>

        {/* 혜택 안내 */}
        <div className="px-6 -mt-6 relative z-10">
          <div className="bg-white rounded-xl border border-gray-100 shadow-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Gift" size={18} className="text-brand-500" />
              <h3 className="text-sm font-bold text-gray-900">더 많은 혜택을 받아보세요!</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-brand-600">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">채널 구독 & 팔로잉</p>
                  <p className="text-xs text-gray-500 mt-0.5">유튜브, 인스타그램 등 채널을 구독해주세요</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-brand-600">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">구독 인증하기</p>
                  <p className="text-xs text-gray-500 mt-0.5">구독 화면을 캡쳐하여 인증해주세요</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="Check" size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">특별 할인 혜택</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    인증 완료 시 해당 샵의 모든 상품을 <span className="text-brand-600 font-semibold">할인된 가격</span>으로 구매할 수 있어요!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 채널 구독 바로가기 */}
        {availableChannels.length > 0 && (
          <div className="px-6 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">채널 바로가기</p>
            <div className="space-y-1.5">
              {availableChannels.map((ch) => {
                const meta = CHANNEL_META[ch];
                const url = sellerChannels?.[ch as keyof typeof sellerChannels];
                const status = getVerificationStatus(ch);
                return (
                  <div key={ch} className="flex items-center gap-2">
                    <a
                      href={url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${meta.bgColor} hover:opacity-80 transition-opacity`}
                    >
                      <meta.icon size={16} className={meta.color} />
                      <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                      <Icon name="ArrowRight" size={12} className="text-gray-400 ml-auto" />
                    </a>
                    {status?.status === "APPROVED" ? (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">인증완료</span>
                    ) : status?.status === "PENDING" ? (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-50 text-yellow-600 font-medium">심사중</span>
                    ) : (
                      <button
                        onClick={() => handleChannelVerify(ch)}
                        className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
                      >
                        인증하기
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 py-5 space-y-2">
          {needsVerification ? (
            <button
              onClick={() => {
                setShowPopup(false);
                // 첫 번째 미인증 채널의 인증 모달 바로 열기
                const unverified = availableChannels.find((ch) => !getVerificationStatus(ch) || getVerificationStatus(ch)?.status === "REJECTED");
                if (unverified) handleChannelVerify(unverified);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-pink-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              지금 바로 인증하고 할인 받기
            </button>
          ) : (
            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-3 text-sm btn-primary"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ─── 채널 인증 모달 (OCR 플로우 포함) ───
  const VerifyModal = () => {
    const [previewUrl, setPreviewUrl] = useState("");
    const [step, setStep] = useState<"subscribe" | "capture">("subscribe");
    const meta = selectedChannel ? CHANNEL_META[selectedChannel] : null;
    const channelUrl = selectedChannel ? sellerChannels?.[selectedChannel as keyof typeof sellerChannels] : null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" onClick={() => setShowVerifyModal(false)}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {meta && <meta.icon size={20} className={meta.color} />}
                <h3 className="text-base font-bold text-gray-900">{meta?.label} 구독 인증</h3>
              </div>
              <button onClick={() => { setShowVerifyModal(false); setOcrResult(null); }} className="p-1.5 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* 스텝 인디케이터 */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${
                step === "subscribe" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">1</span>
                채널 구독
              </div>
              <Icon name="ChevronDown" size={12} className="text-gray-300 -rotate-90" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${
                step === "capture" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">2</span>
                캡쳐 인증
              </div>
            </div>

            {step === "subscribe" ? (
              <>
                {/* Step 1: 채널 구독하기 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-3">📱 채널 바로가기</p>
                  {channelUrl ? (
                    <a
                      href={channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl ${meta?.bgColor} hover:opacity-80 transition-opacity`}
                    >
                      {meta && <meta.icon size={20} className={meta.color} />}
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">{sellerName}의 {meta?.label}</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">클릭하여 채널로 이동 후 구독/팔로잉 해주세요</p>
                      </div>
                      <Icon name="ArrowRight" size={14} className="text-gray-400" />
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">채널 URL이 등록되지 않았습니다</p>
                  )}
                </div>

                <div className="bg-brand-50 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-brand-600">
                    💡 채널에서 <strong>구독/팔로잉</strong>을 완료한 후 &quot;다음&quot; 버튼을 눌러주세요.
                    구독 완료 화면을 캡쳐하면 <strong>OCR 자동 인증</strong>으로 빠르게 할인 혜택을 받을 수 있습니다!
                  </p>
                </div>

                <button
                  onClick={() => setStep("capture")}
                  className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
                >
                  구독 완료! 다음 단계로 →
                </button>
              </>
            ) : (
              <>
                {/* Step 2: 스크린샷 인증 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">📸 인증 방법</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <p className="text-xs text-gray-600">{meta?.label} 구독/팔로잉 완료 화면을 캡쳐</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <p className="text-xs text-gray-600">아래에 캡쳐 이미지를 업로드</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">✓</span>
                      <p className="text-xs text-gray-600"><strong>OCR 자동 분석</strong>으로 즉시 인증 or 관리자 확인</p>
                    </div>
                  </div>
                </div>

                {/* 스크린샷 업로드 */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">구독 인증 캡쳐</p>
                  {previewUrl ? (
                    <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                      <img src={previewUrl} alt="screenshot" className="w-full h-full object-contain" />
                      <button
                        onClick={() => setPreviewUrl("")}
                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-all">
                      <Icon name="Camera" size={28} className="text-gray-300" />
                      <span className="text-xs text-gray-500">캡쳐 이미지를 업로드하세요</span>
                      <span className="text-[10px] text-gray-400">JPG, PNG (최대 5MB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("subscribe")}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    ← 이전
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="px-5 pb-5">
            {/* OCR 결과 표시 */}
            {ocrResult && (
              <div className={`mb-3 rounded-xl p-3 text-center ${
                ocrResult.verified
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                {ocrResult.verified ? (
                  <>
                    <Icon name="Check" size={24} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-700">OCR 자동 인증 완료!</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">구독이 확인되어 자동 승인되었습니다.<br/>할인 혜택이 즉시 적용됩니다!</p>
                    <p className="text-[9px] text-emerald-500 mt-1">신뢰도: {ocrResult.confidence}%</p>
                  </>
                ) : (
                  <>
                    <Icon name="Clock" size={24} className="text-yellow-500 mx-auto mb-1" />
                    <p className="text-xs font-bold text-yellow-700">인증 심사 중</p>
                    <p className="text-[10px] text-yellow-600 mt-0.5">자동 확인이 어려워 셀러/관리자가 직접 확인합니다.</p>
                    <p className="text-[9px] text-yellow-500 mt-1">보통 24시간 이내 처리됩니다.</p>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => previewUrl && submitVerification(previewUrl)}
              disabled={!previewUrl || uploading || !!ocrResult}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                previewUrl && !ocrResult
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {uploading ? "OCR 분석 중..." : ocrResult ? (ocrResult.verified ? "자동 승인 완료!" : "심사 접수 완료") : "인증 제출하기"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── 버튼 렌더링 ───

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handlePick}
          disabled={loading}
          className={`p-2 rounded-full transition-all ${
            isPicked
              ? "bg-brand-50 text-brand-500"
              : "bg-white/80 text-gray-400 hover:text-brand-500"
          } ${className}`}
          title={isPicked ? (hasPendingChannel ? "인증 심사중" : "Pick 해제") : `${sellerName} Pick`}
        >
          <Icon name="Wishlist"
            size={20}
            strokeWidth={1.5}
            className={isPicked ? (hasPendingChannel ? "fill-yellow-400 text-yellow-400" : "fill-brand-500") : ""}
          />
        </button>
        {showPopup && <PickPopup />}
        {showVerifyModal && <VerifyModal />}
      </>
    );
  }

  if (variant === "large") {
    return (
      <>
        <button
          onClick={handlePick}
          disabled={loading}
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm transition-all ${
            isPicked
              ? hasPendingChannel && !hasApprovedChannel
                ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                : "bg-brand-50 text-brand-600 border border-brand-200"
              : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600 border border-gray-200"
          } ${className}`}
        >
          <Icon name="Wishlist"
            size={18}
            strokeWidth={1.5}
            className={isPicked ? "fill-brand-500 text-brand-500" : ""}
          />
          {isPicked ? "Picked!" : "Pick"}
          {isPicked && hasApprovedChannel && (
            <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">할인적용중</span>
          )}
          {isPicked && hasPendingChannel && !hasApprovedChannel && (
            <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">인증심사중</span>
          )}
        </button>
        {showPopup && <PickPopup />}
        {showVerifyModal && <VerifyModal />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handlePick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          isPicked
            ? "bg-brand-500 text-white shadow-sm"
            : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600"
        } ${className}`}
      >
        <Icon name="Wishlist"
          size={16}
          strokeWidth={isPicked ? 2 : 1.5}
          className={isPicked ? "fill-white" : ""}
        />
        {isPicked ? "Picked" : "Pick"}
        {isPicked && hasPendingChannel && !hasApprovedChannel && (
          <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">인증심사중</span>
        )}
      </button>
      {showPopup && <PickPopup />}
      {showVerifyModal && <VerifyModal />}
    </>
  );
}
