"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Quote, Save, Loader2, Sparkles, Heart, Radio, ShieldCheck, Star, Zap, TrendingUp, Users} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

type HomeStat = { value: string; label: string };
type HomeStory = { name: string; quote: string; metric: string; avatar: string };
type BenefitStat = { value: string; label: string; sub: string };
type BenefitItem = { iconType: string; title: string; desc: string };

const AVATARS = [
  "/avatars/여성구매회원_1.png", "/avatars/여성구매회원_2.png", "/avatars/여성구매회원_3.png", "/avatars/여성구매회원_4.png", "/avatars/여성구매회원_5.png",
  "/avatars/남성구매회원_1.png", "/avatars/남성구매회원_2.png", "/avatars/남성구매회원_3.png", "/avatars/남성구매회원_4.png", "/avatars/남성구매회원_5.png",
];

const ICON_OPTIONS = [
  { value: "heart", label: "❤️ 하트" },
  { value: "radio", label: "📻 라디오" },
  { value: "shield", label: "🛡️ 방패" },
  { value: "star", label: "⭐ 별" },
  { value: "zap", label: "⚡ 번개" },
  { value: "trending", label: "📈 성장" },
  { value: "users", label: "👥 사용자" },
];

function SectionSaveButton({ saving, label, onClick }: { saving: boolean; label: string; onClick: () => void }) {
  return (
    <div className="pt-2 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "저장 중..." : label}
      </button>
    </div>
  );
}

export default function HomeContentManager({
  initialStats,
  initialStories,
  initialBenefits,
}: {
  initialStats: HomeStat[];
  initialStories: HomeStory[];
  initialBenefits?: { stats: BenefitStat[]; items: BenefitItem[] };
}) {
  const router = useRouter();
  const { appAlert } = useAppDialog();

  const [stats, setStats] = useState<HomeStat[]>(initialStats.length ? initialStats : [{ value: "", label: "" }]);
  const [savingStats, setSavingStats] = useState(false);
  const [stories, setStories] = useState<HomeStory[]>(initialStories);
  const [savingStories, setSavingStories] = useState(false);

  const defaultBenefitStats: BenefitStat[] = initialBenefits?.stats ?? [
    { value: "68%", label: "단골 재구매율", sub: "PICK 라이브 셀러 기준" },
    { value: "3.2x", label: "라이브 평균 체류", sub: "일반 대비" },
    { value: "1,200+", label: "활동 라이브 셀러", sub: "누적" },
    { value: "4,500+", label: "월 라이브 방송", sub: "플랫폼 합계" },
  ];
  const defaultBenefitItems: BenefitItem[] = initialBenefits?.items ?? [
    { iconType: "heart", title: "단골 PICK으로 충성 고객", desc: "한 번 PICK한 팸이 다시 찾아오는, 관계 기반의 반복 구매." },
    { iconType: "radio", title: "라이브로 실시간 소통", desc: "방송 중 바로 묻고 바로 사는, 몰입도 높은 쿼핑 경험." },
    { iconType: "shield", title: "정산·배송 걱정 없이", desc: "복잡한 운영은 플랫폼이, 라이브 셀러는 판매와 소통에만 집중." },
  ];

  const [benefitStats, setBenefitStats] = useState<BenefitStat[]>(defaultBenefitStats);
  const [benefitItems, setBenefitItems] = useState<BenefitItem[]>(defaultBenefitItems);
  const [savingBenefits, setSavingBenefits] = useState(false);

  const updateStat = (i: number, key: keyof HomeStat, v: string) =>
    setStats((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));
  const updateStory = (i: number, key: keyof HomeStory, v: string) =>
    setStories((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));
  const updateBenefitStat = (i: number, key: keyof BenefitStat, v: string) =>
    setBenefitStats((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));
  const updateBenefitItem = (i: number, key: keyof BenefitItem, v: string) =>
    setBenefitItems((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: v } : s)));

  const inputCls = "flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40";
  const w3Cls = "w-1/3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40";

  const save = async (
    setSaving: (v: boolean) => void,
    payload: object,
    successMsg: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await appAlert({ message: successMsg, type: "success" });
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert({ message: d.error || "저장에 실패했습니다.", type: "warning" });
      }
    } catch {
      await appAlert({ message: "저장 중 오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Quote size={15} className="text-brand-600" /> 바닐라폼로 성공한 라이브 셀러
          </h2>
          <button
            onClick={() => setStories((p) => [...p, { name: "", quote: "", metric: "", avatar: AVATARS[0] }])}
            className="text-xs flex items-center gap-1 text-brand-600 font-medium hover:underline"
          >
            <Icon name="Plus" size={13} /> 스토리 추가
          </button>
        </div>
        <div className="space-y-3">
          {stories.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input value={s.name} onChange={(e) => updateStory(i, "name", e.target.value)}
                  placeholder="이름 · 분야 (예: 유나 · 뷰티 라이브 셀러)" className={inputCls} />
                <button onClick={() => setStories((p) => p.filter((_, idx) => idx !== i))}
                  className="p-2 text-gray-300 hover:text-red-500" aria-label="삭제"><Icon name="Delete" size={15} /></button>
              </div>
              <textarea value={s.quote} onChange={(e) => updateStory(i, "quote", e.target.value)}
                placeholder="한마디 (라이브 셀러의 후기)" rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40 resize-none" />
              <div className="flex items-center gap-2">
                <input value={s.metric} onChange={(e) => updateStory(i, "metric", e.target.value)}
                  placeholder="성과 (예: 월 매출 1,800만+)" className={inputCls} />
                <select value={s.avatar} onChange={(e) => updateStory(i, "avatar", e.target.value)}
                  className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40">
                  {AVATARS.map((a) => (
                    <option key={a} value={a}>{a.split("/").pop()?.replace(".png", "")}</option>
                  ))}
                </select>
                <img src={s.avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-100 flex-shrink-0" />
              </div>
            </div>
          ))}
          {stories.length === 0 && <p className="text-xs text-gray-400 py-2">스토리가 없습니다. 추가해주세요.</p>}
        </div>
        <SectionSaveButton saving={savingStories} label="성공한 라이브 셀러 저장"
          onClick={() => save(setSavingStories, { section: "stories", stories }, "성공한 라이브 셀러 스토리가 저장되었습니다.")} />
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-4">
          <Sparkles size={15} className="text-brand-600" /> 바닐라폼로 얻는 것
        </h2>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">통계 타일</p>
            <button onClick={() => setBenefitStats((p) => [...p, { value: "", label: "", sub: "" }])}
              className="text-xs flex items-center gap-1 text-brand-600 font-medium hover:underline">
              <Icon name="Plus" size={13} /> 추가
            </button>
          </div>
          <div className="space-y-2">
            {benefitStats.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={s.value} onChange={(e) => updateBenefitStat(i, "value", e.target.value)}
                  placeholder="숫자 (예: 68%)" className={w3Cls} />
                <input value={s.label} onChange={(e) => updateBenefitStat(i, "label", e.target.value)}
                  placeholder="라벨 (예: 단골 재구매율)" className={inputCls} />
                <input value={s.sub} onChange={(e) => updateBenefitStat(i, "sub", e.target.value)}
                  placeholder="서브 (예: PICK 라이브 셀러 기준)" className={inputCls} />
                <button onClick={() => setBenefitStats((p) => p.filter((_, idx) => idx !== i))}
                  className="p-2 text-gray-300 hover:text-red-500" aria-label="삭제"><Icon name="Delete" size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600">혜택 카드</p>
            <button onClick={() => setBenefitItems((p) => [...p, { iconType: "heart", title: "", desc: "" }])}
              className="text-xs flex items-center gap-1 text-brand-600 font-medium hover:underline">
              <Icon name="Plus" size={13} /> 추가
            </button>
          </div>
          <div className="space-y-2">
            {benefitItems.map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select value={s.iconType} onChange={(e) => updateBenefitItem(i, "iconType", e.target.value)}
                    className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40">
                    {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={s.title} onChange={(e) => updateBenefitItem(i, "title", e.target.value)}
                    placeholder="제목" className={inputCls} />
                  <button onClick={() => setBenefitItems((p) => p.filter((_, idx) => idx !== i))}
                    className="p-2 text-gray-300 hover:text-red-500" aria-label="삭제"><Icon name="Delete" size={15} /></button>
                </div>
                <input value={s.desc} onChange={(e) => updateBenefitItem(i, "desc", e.target.value)}
                  placeholder="설명" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
              </div>
            ))}
          </div>
        </div>
        <SectionSaveButton saving={savingBenefits} label="얻는 것 저장"
          onClick={() => save(setSavingBenefits, { section: "benefits", benefitStats, benefitItems }, "바닐라폼로 얻는 것이 저장되었습니다.")} />
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Icon name="Chart" size={15} className="text-brand-600" /> 숫자로 보는 바닐라폼
          </h2>
          <button onClick={() => setStats((p) => [...p, { value: "", label: "" }])}
            className="text-xs flex items-center gap-1 text-brand-600 font-medium hover:underline">
            <Icon name="Plus" size={13} /> 항목 추가
          </button>
        </div>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={s.value} onChange={(e) => updateStat(i, "value", e.target.value)}
                placeholder="숫자 (예: 320억+)" className={w3Cls} />
              <input value={s.label} onChange={(e) => updateStat(i, "label", e.target.value)}
                placeholder="설명 (예: 누적 거래액)" className={inputCls} />
              <button onClick={() => setStats((p) => p.filter((_, idx) => idx !== i))}
                className="p-2 text-gray-300 hover:text-red-500" aria-label="삭제"><Icon name="Delete" size={15} /></button>
            </div>
          ))}
          {stats.length === 0 && <p className="text-xs text-gray-400 py-2">항목이 없습니다. 추가해주세요.</p>}
        </div>
        <SectionSaveButton saving={savingStats} label="숫자 저장"
          onClick={() => save(setSavingStats, { section: "stats", stats }, "숫자로 보는 바닐라폼가 저장되었습니다.")} />
      </section>

    </div>
  );
}
