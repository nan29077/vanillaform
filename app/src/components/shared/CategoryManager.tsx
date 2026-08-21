"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {X, Save, Loader2, // 카테고리 아이콘 모음 (50개+)
  Shirt, Palette, Leaf, Gem, Home as HomeIcon, Laptop, Baby, Dumbbell, Plane, Dog, BookOpen, Headphones, Camera, Coffee, Utensils, Heart, Tag, ShoppingBag, Music, Gamepad2, Car, Bike, Flower2, Scissors, Watch, Glasses, Wine, Cake, Pizza, IceCream, Apple, Carrot, Fish, Stethoscope, Pill, Gift, Sparkles, Sun, Moon, Umbrella, Tent, Mountain, Waves, Paintbrush, Brush, Wrench, Hammer, Lightbulb, Smartphone, Tv, Monitor, Printer, Wifi, Footprints, Crown, Ribbon, Star, Zap, Theater, Clapperboard, Mic, Radio, Globe, Map, Compass, Anchor, Rocket, Flag, Trophy, type LucideIcon} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

// ─── 아이콘 레지스트리: name → Component ───
const ICON_REGISTRY: Record<string, LucideIcon> = {
  Shirt, Palette, Leaf, Gem, HomeIcon, Laptop, Baby, Dumbbell, Plane, Dog, BookOpen,
  Headphones, Camera, Coffee, Utensils, Heart, Tag, ShoppingBag, Music, Gamepad2, Car, Bike,
  Flower2, Scissors, Watch, Glasses, Wine, Cake, Pizza, IceCream, Apple, Carrot, Fish,
  Stethoscope, Pill, Gift, Sparkles, Sun, Moon, Umbrella, Tent, Mountain, Waves,
  Paintbrush, Brush, Wrench, Hammer, Lightbulb, Smartphone, Tv, Monitor, Printer, Wifi,
  Footprints, Crown, Ribbon, Star, Zap, Theater, Clapperboard, Mic, Radio, Globe,
  Map, Compass, Anchor, Rocket, Flag, Trophy,
};

// ─── 슬러그 키워드 → 아이콘 자동 매핑 ───
const SLUG_TO_ICON: Record<string, string> = {
  fashion: "Shirt", beauty: "Palette", lifestyle: "Leaf", accessories: "Gem",
  "home-living": "HomeIcon", food: "Utensils", digital: "Laptop", kids: "Baby",
  sports: "Dumbbell", travel: "Plane", pet: "Dog", books: "BookOpen",
  audio: "Headphones", photo: "Camera", cafe: "Coffee", health: "Stethoscope",
  art: "Paintbrush", car: "Car", game: "Gamepad2", outdoor: "Tent",
  music: "Music", flower: "Flower2", wine: "Wine", dessert: "Cake",
  jewelry: "Crown", watch: "Watch", glasses: "Glasses", shoe: "Footprints",
  bag: "ShoppingBag", cosmetic: "Sparkles", skincare: "Heart",
  supplement: "Pill", gift: "Gift", interior: "Lightbulb",
  electronics: "Smartphone", tv: "Tv", bike: "Bike", swim: "Waves",
  camping: "Mountain", fishing: "Fish", cooking: "Utensils",
  stationery: "Pencil", instrument: "Mic", movie: "Clapperboard",
  perfume: "Flower2", organic: "Apple", baby: "Baby", kitchen: "Utensils",
  bath: "Umbrella", diy: "Hammer", tech: "Monitor", mobile: "Smartphone",
  yoga: "Leaf", fitness: "Dumbbell", running: "Footprints", golf: "Flag",
  ski: "Mountain", surf: "Waves", diet: "Carrot",
};

// ─── 이름 키워드 → 아이콘 자동 매핑 (한국어) ───
const NAME_TO_ICON: Record<string, string> = {
  "패션": "Shirt", "의류": "Shirt", "옷": "Shirt", "뷰티": "Palette", "화장품": "Palette",
  "메이크업": "Sparkles", "스킨케어": "Heart", "향수": "Flower2",
  "라이프": "Leaf", "생활": "Leaf", "리빙": "HomeIcon", "홈": "HomeIcon", "인테리어": "Lightbulb",
  "액세서리": "Gem", "주얼리": "Crown", "시계": "Watch", "안경": "Glasses",
  "가방": "ShoppingBag", "신발": "Footprints", "슈즈": "Footprints",
  "음식": "Utensils", "푸드": "Utensils", "식품": "Apple", "건강식품": "Pill",
  "디지털": "Laptop", "전자": "Smartphone", "테크": "Monitor", "가전": "Tv",
  "키즈": "Baby", "유아": "Baby", "아동": "Baby",
  "스포츠": "Dumbbell", "운동": "Dumbbell", "피트니스": "Dumbbell", "요가": "Leaf",
  "여행": "Plane", "캠핑": "Tent", "아웃도어": "Mountain",
  "반려": "Dog", "펫": "Dog", "동물": "Dog",
  "도서": "BookOpen", "책": "BookOpen",
  "음악": "Music", "악기": "Mic", "오디오": "Headphones",
  "사진": "Camera", "카메라": "Camera",
  "카페": "Coffee", "커피": "Coffee", "차": "Coffee",
  "건강": "Stethoscope", "의약": "Pill", "영양": "Apple",
  "미술": "Paintbrush", "공예": "Scissors", "DIY": "Hammer",
  "자동차": "Car", "바이크": "Bike",
  "게임": "Gamepad2", "완구": "Gamepad2",
  "꽃": "Flower2", "식물": "Leaf", "가드닝": "Flower2",
  "와인": "Wine", "주류": "Wine",
  "디저트": "Cake", "베이커리": "Cake", "아이스크림": "IceCream",
  "피자": "Pizza", "요리": "Utensils", "주방": "Utensils",
  "선물": "Gift", "기프트": "Gift",
  "영화": "Clapperboard", "공연": "Theater", "문화": "Globe",
  "낚시": "Fish", "수영": "Waves", "서핑": "Waves",
  "목욕": "Umbrella", "욕실": "Umbrella",
};

// 아이콘 카테고리별 그룹핑
const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "패션/뷰티", icons: ["Shirt", "Palette", "Gem", "Crown", "Ribbon", "Watch", "Glasses", "Footprints", "ShoppingBag", "Scissors", "Sparkles"] },
  { label: "푸드/음료", icons: ["Utensils", "Coffee", "Wine", "Cake", "Pizza", "IceCream", "Apple", "Carrot", "Fish"] },
  { label: "라이프/홈", icons: ["HomeIcon", "Leaf", "Lightbulb", "Flower2", "Sun", "Moon", "Umbrella", "Gift", "Heart"] },
  { label: "디지털/테크", icons: ["Laptop", "Smartphone", "Tv", "Monitor", "Printer", "Wifi", "Headphones", "Camera"] },
  { label: "스포츠/아웃도어", icons: ["Dumbbell", "Bike", "Mountain", "Waves", "Tent", "Compass", "Flag", "Trophy", "Anchor"] },
  { label: "엔터테인먼트", icons: ["Music", "Gamepad2", "Clapperboard", "Theater", "Mic", "Radio", "BookOpen", "Star", "Zap"] },
  { label: "건강/뷰티케어", icons: ["Stethoscope", "Pill", "Heart", "Paintbrush", "Brush", "Baby"] },
  { label: "여행/모빌리티", icons: ["Plane", "Car", "Globe", "Map", "Rocket", "Dog"] },
  { label: "기타", icons: ["Tag", "Wrench", "Hammer", "Package"] },
];

interface SubCategory {
  id: string; name: string; slug: string; icon: string | null; image: string | null;
  description: string | null; sortOrder: number; isActive: boolean; productCount: number; parentId: string | null;
}

interface Category {
  id: string; name: string; slug: string; icon: string | null; image: string | null;
  description: string | null; sortOrder: number; isActive: boolean; productCount: number;
  children?: SubCategory[];
}

// 아이콘 이름으로 컴포넌트 가져오기
export function getIconComponent(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Tag;
  return ICON_REGISTRY[iconName] || Tag;
}

// 슬러그/이름으로 아이콘 자동 추천
function suggestIcon(slug: string, name: string): string {
  // 1) 슬러그 매칭
  if (SLUG_TO_ICON[slug]) return SLUG_TO_ICON[slug];
  // 슬러그 부분 매칭
  for (const [key, icon] of Object.entries(SLUG_TO_ICON)) {
    if (slug.includes(key)) return icon;
  }
  // 2) 이름 매칭 (한국어)
  for (const [keyword, icon] of Object.entries(NAME_TO_ICON)) {
    if (name.includes(keyword)) return icon;
  }
  return "Tag";
}

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { appConfirm, appAlert } = useAppDialog();
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parentIdForNew, setParentIdForNew] = useState(null as string | null);
  const [expandedCats, setExpandedCats] = useState(() => new Set(initialCategories.map(c => c.id)));

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("Tag");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  const resetForm = () => {
    setName(""); setSlug(""); setIcon("Tag"); setDescription(""); setSortOrder(0); setIsActive(true);
    setEditing(null); setShowForm(false); setShowIconPicker(false); setIconSearch("");
    setParentIdForNew(null);
  };

  const openNew = (parentId: string | null = null) => {
    resetForm();
    setParentIdForNew(parentId);
    if (parentId) {
      const parent = categories.find(c => c.id === parentId);
      const subs = parent?.children || [];
      setSortOrder(subs.length > 0 ? Math.max(...subs.map(c => c.sortOrder)) + 1 : 0);
    } else {
      setSortOrder(categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 0);
    }
    setShowForm(true);
  };

  const openEdit = (cat: any) => {
    setName(cat.name); setSlug(cat.slug); setIcon(cat.icon || "Tag"); setDescription(cat.description || "");
    setSortOrder(cat.sortOrder); setIsActive(cat.isActive);
    setParentIdForNew(cat.parentId || null);
    setEditing(cat); setShowForm(true);
  };

  const handleAutoSlug = (val: string) => {
    setName(val);
    if (!editing) {
      const newSlug = val.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      setSlug(newSlug);
      // 아이콘 자동 추천
      const suggested = suggestIcon(newSlug, val);
      setIcon(suggested);
    }
  };

  const handleSlugChange = (val: string) => {
    setSlug(val);
    if (!editing) {
      const suggested = suggestIcon(val, name);
      if (suggested !== "Tag") setIcon(suggested);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) { appAlert("이름과 슬러그는 필수입니다"); return; }
    setLoading(true);
    try {
      if (editing) {
        const res = await fetch("/api/admin/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, name, slug, icon, description: description || null, sortOrder, isActive }),
        });
        if (res.ok) {
          const { category } = await res.json();
          // Update in place - could be top or sub category
          setCategories(prev => prev.map(c => {
            if (c.id === editing.id) return { ...c, ...category };
            if (c.children) {
              return { ...c, children: c.children.map(sub => sub.id === editing.id ? { ...sub, ...category } : sub).sort((a, b) => a.sortOrder - b.sortOrder) };
            }
            return c;
          }).sort((a, b) => a.sortOrder - b.sortOrder));
          resetForm();
        } else {
          const d = await res.json(); appAlert({ message: d.error || "수정 실패", type: "warning" });
        }
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug, icon, description: description || null, sortOrder, isActive, parentId: parentIdForNew }),
        });
        if (res.ok) {
          const { category } = await res.json();
          if (parentIdForNew) {
            setCategories(prev => prev.map(c => c.id === parentIdForNew ? { ...c, children: [...(c.children || []), { ...category, productCount: 0, parentId: parentIdForNew }].sort((a, b) => a.sortOrder - b.sortOrder) } : c));
          } else {
            setCategories(prev => [...prev, { ...category, productCount: 0, children: [] }].sort((a, b) => a.sortOrder - b.sortOrder));
          }
          resetForm();
        } else {
          const d = await res.json(); appAlert({ message: d.error || "생성 실패", type: "warning" });
        }
      }
    } catch { appAlert({ message: "오류 발생", type: "warning" }); }
    setLoading(false);
  };

  const handleDelete = async (cat: Category) => {
    if (cat.productCount > 0) { appAlert({ message: `이 카테고리에 연결된 상품이 ${cat.productCount}개 있어 삭제할 수 없습니다.`, type: "honeybee" }); return; }
    if (!await appConfirm({ message: `'${cat.name}' 카테고리를 삭제하시겠습니까?`, type: "warning", confirmText: "삭제" })) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/categories?id=${cat.id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== cat.id));
      } else {
        const d = await res.json(); appAlert({ message: d.error || "삭제 실패", type: "warning" });
      }
    } catch { appAlert({ message: "오류 발생", type: "warning" }); }
    setLoading(false);
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id, isActive: !cat.isActive }),
      });
      if (res.ok) {
        setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isActive: !c.isActive } : c));
      }
    } catch {}
  };

  const handleMoveOrder = async (cat: Category, direction: string) => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const swapCat = sorted[swapIdx];
    const tempOrder = cat.sortOrder;

    try {
      await Promise.all([
        fetch("/api/admin/categories", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cat.id, sortOrder: swapCat.sortOrder }),
        }),
        fetch("/api/admin/categories", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: swapCat.id, sortOrder: tempOrder }),
        }),
      ]);
      setCategories(prev =>
        prev.map(c => {
          if (c.id === cat.id) return { ...c, sortOrder: swapCat.sortOrder };
          if (c.id === swapCat.id) return { ...c, sortOrder: tempOrder };
          return c;
        }).sort((a, b) => a.sortOrder - b.sortOrder)
      );
    } catch {}
  };

  const activeCount = categories.filter(c => c.isActive).length;

  // 아이콘 피커 필터
  const filteredIconGroups = useMemo(() => {
    if (!iconSearch.trim()) return ICON_GROUPS;
    const q = iconSearch.toLowerCase();
    return ICON_GROUPS.map(g => ({
      ...g,
      icons: g.icons.filter(ic => ic.toLowerCase().includes(q)),
    })).filter(g => g.icons.length > 0);
  }, [iconSearch]);

  const SelectedIcon = getIconComponent(icon);

  return (
    <div>
      {/* 통계 + 추가 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] text-gray-400">상단 카테고리</p>
            <p className="text-lg font-bold text-gray-900">{categories.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] text-gray-400">하단 카테고리</p>
            <p className="text-lg font-bold text-emerald-600">{categories.reduce((sum, c) => sum + (c.children?.length || 0), 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] text-gray-400">활성</p>
            <p className="text-lg font-bold text-blue-600">{activeCount}</p>
          </div>
        </div>
        <button onClick={() => openNew(null)} className="btn-primary flex items-center gap-1.5 !px-4 !py-2.5 text-sm whitespace-nowrap">
          <Icon name="Plus" size={16} /> 상단 카테고리 추가
        </button>
      </div>

      {/* 카테고리 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="Package" size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 카테고리가 없습니다</p>
            <p className="text-xs mt-1">메인 페이지에 표시할 카테고리를 추가하세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {categories.map((cat, idx) => {
              const CatIcon = getIconComponent(cat.icon);
              return (
                <div key={cat.id}>
                  <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors ${!cat.isActive ? "opacity-50" : ""}`}>
                  {/* 순서 컨트롤 */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={() => handleMoveOrder(cat, "up")} disabled={idx === 0}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed">
                      <Icon name="ArrowRight" size={12} className="-rotate-90" />
                    </button>
                    <button onClick={() => handleMoveOrder(cat, "down")} disabled={idx === categories.length - 1}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed">
                      <Icon name="ArrowRight" size={12} className="rotate-90" />
                    </button>
                  </div>

                  {/* 아이콘 */}
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 flex-shrink-0 border border-gray-100">
                    <CatIcon size={18} strokeWidth={1.5} />
                  </div>

                  {/* 순서 번호 */}
                  <span className="w-6 h-6 rounded bg-gray-100 text-[10px] font-bold text-gray-400 flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>

                  {/* 카테고리 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{cat.slug}</span>
                      {cat.icon && <span className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{cat.icon}</span>}
                      {!cat.isActive && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">비활성</span>}
                    </div>
                    {cat.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{cat.description}</p>}
                    <p className="text-[10px] text-gray-300 mt-0.5">상품 {cat.productCount}개 · 하위 {cat.children?.length || 0}개</p>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openNew(cat.id)} className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="하단 카테고리 추가">
                      <Icon name="Plus" size={16} />
                    </button>
                    <button onClick={() => handleToggleActive(cat)} className={`p-1.5 rounded-lg transition-colors ${cat.isActive ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-300 hover:bg-gray-100"}`}
                      title={cat.isActive ? "비활성화" : "활성화"}>
                      {cat.isActive ? <Icon name="Eye" size={16} /> : <Icon name="Eye" size={16} />}
                    </button>
                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                      <Icon name="Edit" size={16} />
                    </button>
                    <button onClick={() => handleDelete(cat)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={cat.productCount > 0 ? "연결된 상품이 있어 삭제 불가" : "삭제"}>
                      <Icon name="Delete" size={16} />
                    </button>
                  </div>
                </div>
                {/* Sub-categories */}
                {cat.children && cat.children.length > 0 && expandedCats.has(cat.id) && (
                  <div className="ml-12 border-l-2 border-gray-100">
                    {cat.children!.map((sub) => {
                      const SubIcon = getIconComponent(sub.icon);
                      return (
                        <div key={sub.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors ${!sub.isActive ? "opacity-50" : ""}`}>
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0 border border-gray-100">
                            <SubIcon size={14} strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-gray-700">{sub.name}</p>
                              <span className="text-[9px] text-gray-400 bg-gray-50 px-1 py-0.5 rounded">{sub.slug}</span>
                            </div>
                            <p className="text-[9px] text-gray-300">상품 {sub.productCount}개</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => openEdit(sub)} className="p-1 rounded text-gray-300 hover:text-brand-600"><Icon name="Edit" size={12} /></button>
                            <button onClick={() => handleDelete(sub as any)} className="p-1 rounded text-gray-300 hover:text-red-500"><Icon name="Delete" size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 생성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">{editing ? "카테고리 수정" : parentIdForNew ? "하단 카테고리 추가" : "상단 카테고리 추가"}</h3>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">카테고리 이름 *</label>
                <input type="text" className="input-field mt-1 text-sm" placeholder="패션" value={name} onChange={e => handleAutoSlug(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">슬러그 (URL) *</label>
                <input type="text" className="input-field mt-1 text-sm" placeholder="fashion" value={slug} onChange={e => handleSlugChange(e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">영문 소문자, 숫자, 하이픈만 사용</p>
              </div>

              {/* ─── 아이콘 선택 ─── */}
              <div>
                <label className="text-xs font-medium text-gray-600">아이콘</label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50 flex-1"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600">
                      <SelectedIcon size={18} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{icon}</span>
                    <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">변경</span>
                  </button>
                </div>

                {/* 자동 추천 안내 */}
                {!editing && (
                  <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                    <Sparkles size={10} /> 이름/슬러그에 따라 아이콘이 자동 추천됩니다
                  </p>
                )}

                {/* 아이콘 피커 */}
                {showIconPicker && (
                  <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
                          placeholder="아이콘 이름 검색..."
                          value={iconSearch}
                          onChange={e => setIconSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-2 space-y-2">
                      {filteredIconGroups.map(group => (
                        <div key={group.label}>
                          <p className="text-[10px] text-gray-400 font-medium mb-1 px-1">{group.label}</p>
                          <div className="grid grid-cols-6 gap-1">
                            {group.icons.map(iconName => {
                              const Ic = ICON_REGISTRY[iconName];
                              if (!Ic) return null;
                              return (
                                <button
                                  key={iconName}
                                  type="button"
                                  onClick={() => { setIcon(iconName); setShowIconPicker(false); setIconSearch(""); }}
                                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[8px] transition-all
                                    ${icon === iconName
                                      ? "bg-blue-50 text-blue-600 ring-1 ring-blue-300"
                                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                    }`}
                                  title={iconName}
                                >
                                  <Ic size={18} strokeWidth={1.5} />
                                  <span className="truncate max-w-full leading-none">{iconName.replace(/([A-Z])/g, ' $1').trim().split(' ')[0]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">설명</label>
                <input type="text" className="input-field mt-1 text-sm" placeholder="패션 관련 상품 카테고리" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">순서</label>
                  <input type="number" className="input-field mt-1 text-sm" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">상태</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`mt-1 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}
                  >
                    {isActive ? "활성" : "비활성"}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={resetForm} className="btn-outline flex-1 !py-2.5 text-sm">취소</button>
              <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 !py-2.5 text-sm flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editing ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
