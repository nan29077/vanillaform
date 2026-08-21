"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {Save, X} from 'lucide-react';
import { InstagramIcon, YoutubeIcon } from "@/components/shared/SnsIcons";
import ImageUploader from "@/components/shared/ImageUploader";
import SavedPopup from "@/components/shared/SavedPopup";
import Link from "next/link";

interface ShopData {
  slug: string;
  shopName: string;
  category: string | null;
  mood: string | null;
  shopDescription: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  youtubeChannelId?: string | null;
  shopLogo?: string | null;
  shopBanner?: string | null;
}

const CATEGORY_OPTIONS = [
  "패션", "뷰티", "라이프스타일", "홈리빙", "푸드", "디지털/가전",
  "액세서리", "키즈/베이비", "스포츠/아웃도어", "반려동물", "건강/웰빙",
  "여행", "도서/문구", "핸드메이드", "빈티지", "기타",
];

const MOOD_OPTIONS = [
  "미니멀", "캐주얼", "모던", "러블리", "내추럴", "빈티지",
  "트렌디", "클래식", "스트릿", "럭셔리", "유니크", "에스닉",
  "심플", "로맨틱", "시크", "기타",
];

export default function ShopEditForm({ initial }: { initial: ShopData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    shopName: initial.shopName || "",
    category: initial.category || "",
    mood: initial.mood || "",
    shopDescription: initial.shopDescription || "",
    instagramUrl: initial.instagramUrl || "",
    youtubeUrl: initial.youtubeUrl || "",
    tiktokUrl: initial.tiktokUrl || "",
    facebookUrl: initial.facebookUrl || "",
    twitterUrl: initial.twitterUrl || "",
    youtubeChannelId: initial.youtubeChannelId || "",
    shopLogo: initial.shopLogo || "",
    shopBanner: initial.shopBanner || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const handleChange = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/seller/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setShowSavedPopup(true);
      // 사이드바 샵이름 즉시 반영 (서버 컴포넌트 재렌더)
      router.refresh();
    } catch (e: any) {
      setError(e.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [form]);

  return (
    <>
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      {/* Header with Save button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">샵 관리</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/shop/${initial.slug}`}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
          >
            <Icon name="ArrowRight" size={13} strokeWidth={1.5} />
            Shop 바로가기
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
              saved
                ? "bg-green-500 text-white"
                : saving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-black text-white hover:bg-gray-800 active:scale-95"
            }`}
          >
            {saved ? (
              <>
                <Icon name="Check" size={16} strokeWidth={2} />
                저장됨
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={1.5} />
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success/Error Notification */}
      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2 animate-fade-in">
          <Icon name="Check" size={16} className="text-green-500" />
          저장 되었습니다.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
          {error}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* 샵 이미지 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
          <h3 className="text-sm font-bold text-gray-900">샵 이미지</h3>

          {/* 샵 로고 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">샵 로고 (프로필 이미지)</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                {form.shopLogo ? (
                  <img src={form.shopLogo} alt="샵 로고" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Icon name="Camera" size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <ImageUploader
                  images={form.shopLogo ? [form.shopLogo] : []}
                  onChange={(urls) => setForm((p) => ({ ...p, shopLogo: urls[0] || "" }))}
                  maxImages={1}
                  compact
                />
                {form.shopLogo && (
                  <button
                    onClick={() => setForm((p) => ({ ...p, shopLogo: "" }))}
                    className="mt-1 text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                  >
                    <X size={10} /> 이미지 제거
                  </button>
                )}
                <p className="text-[10px] text-gray-400 mt-1">권장: 200x200px, JPG/PNG</p>
                <p className="text-[10px] text-blue-500 mt-0.5">셀러샵 상단 헤더 및 프로필 원형 이미지로 표시됩니다.</p>
              </div>
            </div>
          </div>

          {/* 샵 배너 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">샵 배너 이미지</label>
            {form.shopBanner ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-2">
                <img src={form.shopBanner} alt="배너" className="w-full h-full object-cover" />
                <button
                  onClick={() => setForm((p) => ({ ...p, shopBanner: "" }))}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="w-full h-32 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 mb-2">
                <div className="text-center">
                  <Icon name="Upload" size={20} className="mx-auto mb-1" />
                  <p className="text-[10px]">배너 이미지 업로드</p>
                </div>
              </div>
            )}
            <ImageUploader
              images={form.shopBanner ? [form.shopBanner] : []}
              onChange={(urls) => setForm((p) => ({ ...p, shopBanner: urls[0] || "" }))}
              maxImages={1}
              compact
            />
            <p className="text-[10px] text-gray-400 mt-1">권장: 1200x400px, JPG/PNG</p>
            <p className="text-[10px] text-blue-500 mt-0.5">셀러샵 페이지 상단 전체 너비 배너 영역에 표시됩니다.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">샵 이름</label>
            <input
              type="text"
              className="input-field"
              value={form.shopName}
              onChange={e => handleChange("shopName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">샵 ID</label>
            <input type="text" className="input-field bg-gray-50 text-gray-500" defaultValue={initial.slug} readOnly />
            <p className="text-[10px] text-gray-400 mt-1">샵 주소: /shop/{initial.slug}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleChange("category", form.category === cat ? "" : cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    form.category === cat
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">무드/컨셉</label>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleChange("mood", form.mood === m ? "" : m)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    form.mood === m
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">샵 설명</label>
            <textarea
              className="input-field h-24 resize-none"
              value={form.shopDescription}
              onChange={e => handleChange("shopDescription", e.target.value)}
              placeholder="샵에 대한 소개를 작성해주세요"
            />
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">소셜 미디어</h3>
          <div className="flex items-center gap-3">
            <InstagramIcon size={20} className="flex-shrink-0" />
            <input
              type="text" className="input-field flex-1"
              value={form.instagramUrl}
              onChange={e => handleChange("instagramUrl", e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
          <div className="flex items-center gap-3">
            <YoutubeIcon size={20} className="flex-shrink-0" />
            <input
              type="text" className="input-field flex-1"
              value={form.youtubeUrl}
              onChange={e => handleChange("youtubeUrl", e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex-shrink-0 mt-2.5 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="flex-1 space-y-1">
              <input
                type="text" className="input-field w-full"
                value={(form as any).youtubeChannelId || ""}
                onChange={e => handleChange("youtubeChannelId", e.target.value)}
                placeholder="YouTube 채널 ID (예: UCxxxxxxxx 또는 @채널핸들) — 자동 감지 방식 B용"
              />
              <p className="text-[10px] text-gray-400">채널 ID를 저장하면 라이브 생성 시 방식 B 자동 감지 기본값으로 사용됩니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.16 15.2a6.34 6.34 0 0 0 6.33 6.34 6.34 6.34 0 0 0 6.33-6.34V8.96a8.27 8.27 0 0 0 4.77 1.52V7.03a4.84 4.84 0 0 1-1-.34Z" />
            </svg>
            <input
              type="text" className="input-field flex-1"
              value={form.tiktokUrl}
              onChange={e => handleChange("tiktokUrl", e.target.value)}
              placeholder="https://tiktok.com/@..."
            />
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <input
              type="text" className="input-field flex-1"
              value={form.facebookUrl}
              onChange={e => handleChange("facebookUrl", e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <input
              type="text" className="input-field flex-1"
              value={form.twitterUrl}
              onChange={e => handleChange("twitterUrl", e.target.value)}
              placeholder="https://x.com/..."
            />
          </div>
        </div>
      </div>
    </>
  );
}
