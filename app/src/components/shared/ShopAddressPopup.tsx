"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {X, Hexagon} from 'lucide-react';

interface Address {
  id: string;
  name: string;
  phone: string;
  zipCode: string | null;
  address1: string;
  address2: string | null;
  isDefault: boolean;
}

interface FormState {
  name: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string;
}

export default function ShopAddressPopup({ sellerSlug }: { sellerSlug: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<Address | null>(null);
  const [optIn, setOptIn] = useState(true);
  const [form, setForm] = useState<FormState>({ name: "", phone: "", zipCode: "", address1: "", address2: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const storageKey = `shop-addr-popup-${sellerSlug}`;

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as any)?.role;
    if (role !== "BUYER") return;

    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const [addrRes, notiRes, profileRes] = await Promise.all([
          fetch("/api/addresses", { cache: "no-store" }),
          fetch("/api/buyer/notification-settings", { cache: "no-store" }).catch(() => null),
          fetch("/api/user/profile", { cache: "no-store" }).catch(() => null),
        ]);
        const addrData = await addrRes.json().catch(() => ({ addresses: [] }));
        const list: Address[] = addrData.addresses || [];
        const def = list.find((a) => a.isDefault) || list[0] || null;

        if (notiRes?.ok) {
          const noti = await notiRes.json().catch(() => null);
          if (noti && typeof noti.liveAlimtalkOptIn === "boolean") {
            if (!cancelled) setOptIn(noti.liveAlimtalkOptIn);
          }
        }

        if (!cancelled) {
          setAddress(def);
          if (!def) {
            // 배송지 미등록: 프로필(소셜 로그인으로 받은 연락처·주소 포함)로 폼을 미리 채운다.
            const prof = profileRes?.ok ? await profileRes.json().catch(() => null) : null;
            setForm((f) => ({
              ...f,
              name: prof?.name || session?.user?.name || "",
              phone: prof?.phone ? fmtPhone(prof.phone) : "",
              zipCode: prof?.zipCode || "",
              address1: prof?.address1 || "",
              address2: prof?.address2 || "",
            }));
          }
          setLoading(false);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const markShown = () => {
    try { sessionStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  };

  const handleLater = () => { markShown(); setOpen(false); };

  const handleConfirm = async () => {
    try {
      await fetch("/api/buyer/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAlimtalkOptIn: optIn }),
      });
    } catch { /* ignore */ }
    markShown();
    setOpen(false);
  };

  const fmtPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  };

  const openPostcode = () => {
    const run = () => {
      new (window as any).daum.Postcode({
        oncomplete(data: any) {
          setForm((f) => ({ ...f, zipCode: data.zonecode, address1: data.roadAddress || data.jibunAddress }));
        },
      }).open();
    };
    if ((window as any).daum?.Postcode) { run(); return; }
    const s = document.createElement("script");
    s.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = run;
    document.head.appendChild(s);
  };

  const handleSaveAddress = async () => {
    setSaveError("");
    if (!form.name.trim()) { setSaveError("이름을 입력해주세요."); return; }
    if (!form.phone.trim()) { setSaveError("연락처를 입력해주세요."); return; }
    if (!form.address1.trim()) { setSaveError("주소를 검색해주세요."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ""),
          zipCode: form.zipCode || null,
          address1: form.address1.trim(),
          address2: form.address2.trim() || null,
          isDefault: true,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error || "저장에 실패했습니다.");
        setSaving(false);
        return;
      }
      try {
        await fetch("/api/buyer/notification-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveAlimtalkOptIn: optIn }),
        });
      } catch { /* ignore */ }
      markShown();
      setOpen(false);
    } catch {
      setSaveError("네트워크 오류가 발생했습니다.");
      setSaving(false);
    }
  };

  if (!open || loading) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={handleLater} />

      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-popup-up">
        <div className="relative bg-gradient-to-br from-amber-400 to-amber-500 px-5 py-4">
          <button
            onClick={handleLater}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            aria-label="close"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center">
              <Icon name="Truck" size={19} />
            </div>
            <div>
              <h2 className="text-base font-extrabold">배송지 확인</h2>
              <p className="text-[11px] text-white/80 flex items-center gap-1"><Hexagon size={11} strokeWidth={1.5} /> 라이브 셀러샵 방문을 환영합니다</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {address ? (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                <p className="text-[13px] font-bold text-amber-800">아래의 주소를 배송지로 설정합니다.</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">
                  주소가 맞는지 확인해주세요. 변경이 필요하면 배송지를 수정할 수 있습니다.
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 mb-4">
                <InfoRow icon={<Icon name="MyPage" size={14} />} label="받는분" value={address.name} />
                <InfoRow icon={<Hexagon size={14} strokeWidth={1.5} />} label="닉네임" value={session?.user?.name || "-"} />
                <InfoRow icon={<Icon name="Phone" size={14} />} label="연락처" value={address.phone} />
                <InfoRow
                  icon={<Icon name="Home" size={14} />}
                  label="주소"
                  value={
                    (address.zipCode ? `(${address.zipCode}) ` : "") +
                    address.address1 +
                    (address.address2 ? ` ${address.address2}` : "")
                  }
                />
              </div>

              <label className="flex items-start gap-2.5 px-1 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-amber-500 shrink-0"
                />
                <span className="text-[12px] text-gray-600 leading-snug">
                  판매자 알림 정보를 받고 싶으십니까?
                  <span className="block text-[11px] text-gray-400">라이브·공동구매 등 라이브 셀러 소식을 알림톡으로 받아요</span>
                </span>
              </label>

              <div className="flex gap-2 mb-3">
                <a
                  href="/my/addresses"
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[13px] font-bold transition-colors"
                >
                  배송지 변경
                </a>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-bold shadow-sm shadow-amber-200 transition-colors"
                >
                  확인
                </button>
              </div>

              <button
                onClick={handleLater}
                className="w-full flex items-center justify-center gap-1 py-2 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                나중에 입력하기 <Icon name="ChevronDown" size={13} className="-rotate-90" />
              </button>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                <p className="text-[13px] font-bold text-amber-800">배송지를 등록해주세요</p>
                <p className="text-[11px] text-amber-700/80 mt-0.5">
                  지금 입력하지 않으면 주문 시 결제 창에서 입력하실 수 있습니다.
                </p>
              </div>

              <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:border-amber-400 transition-colors">
                  <Icon name="MyPage" size={15} className="text-amber-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="받는 분 이름"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 text-[13px] outline-none placeholder:text-gray-300"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:border-amber-400 transition-colors">
                  <Icon name="Phone" size={15} className="text-amber-400 shrink-0" />
                  <input
                    type="tel"
                    placeholder="연락처 (010-0000-0000)"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: fmtPhone(e.target.value) }))}
                    className="flex-1 text-[13px] outline-none placeholder:text-gray-300"
                  />
                </div>

                <div>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:border-amber-400 transition-colors">
                      <Icon name="Location" size={15} className="text-amber-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="주소 검색"
                        value={form.address1}
                        readOnly
                        onClick={openPostcode}
                        className="flex-1 text-[13px] outline-none placeholder:text-gray-300 cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={openPostcode}
                      className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 text-[12px] font-bold transition-colors shrink-0"
                    >
                      <Icon name="Search" size={13} /> 검색
                    </button>
                  </div>
                  {form.address1 && (
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 mt-2 focus-within:border-amber-400 transition-colors">
                      <Icon name="Home" size={15} className="text-amber-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="상세 주소 (동 호수 등)"
                        value={form.address2}
                        onChange={(e) => setForm((f) => ({ ...f, address2: e.target.value }))}
                        className="flex-1 text-[13px] outline-none placeholder:text-gray-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2.5 px-1 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-amber-500 shrink-0"
                />
                <span className="text-[12px] text-gray-600 leading-snug">
                  판매자 알림 정보를 받고 싶으십니까?
                  <span className="block text-[11px] text-gray-400">라이브·공동구매 등 라이브 셀러 소식을 알림톡으로 받아요</span>
                </span>
              </label>

              {saveError && (
                <p className="text-[12px] text-red-500 mb-3 px-1">{saveError}</p>
              )}

              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleLater}
                  className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[13px] font-bold transition-colors"
                >
                  나중에 입력
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-[13px] font-bold shadow-sm shadow-amber-200 transition-colors"
                >
                  {saving ? "저장 중..." : "배송지 저장"}
                </button>
              </div>

              <p className="text-center text-[11px] text-gray-400">
                나중에 입력 시 주문 창에서 입력하실 수 있습니다.
              </p>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes popup-up {
          0% { opacity: 0; transform: translateY(24px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-popup-up { animation: popup-up 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-[11px] text-gray-400 w-12 shrink-0">{label}</span>
      <span className="text-[13px] text-gray-800 font-medium flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}
