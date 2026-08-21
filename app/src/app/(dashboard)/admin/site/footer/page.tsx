"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import {FileText, Save, X} from 'lucide-react';

const SLUG_META: Record<string, { label: string; emoji: string }> = {
  "seller-guide": { label: "라이브 셀러 신청 안내", emoji: "⬡" },
  contact:        { label: "1대1 문의",       emoji: "📬" },
  faq:            { label: "자주 묻는 질문",  emoji: "❓" },
  shipping:       { label: "배송 안내",       emoji: "🚚" },
  terms:          { label: "이용약관",        emoji: "📄" },
  privacy:        { label: "개인정보처리방침", emoji: "🔒" },
};

interface FooterItem {
  id?: string;
  slug: string;
  title: string;
  content: string;
  updatedAt?: string;
}

export default function AdminFooterPage() {
  const [items, setItems] = useState<FooterItem[]>([]);
  const [editing, setEditing] = useState<FooterItem | null>(null);
  const [adding, setAdding] = useState<FooterItem | null>(null);
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/footer-content");
      const data = await res.json();
      const dbList = data as FooterItem[];
      const dbMap = Object.fromEntries(dbList.map((d) => [d.slug, d]));
      const baseSlugs = Object.keys(SLUG_META);
      const baseRows = baseSlugs.map(
        (slug) => dbMap[slug] ?? { slug, title: SLUG_META[slug].label, content: "" }
      );
      const customRows = dbList.filter((d) => !SLUG_META[d.slug]);
      setItems([...baseRows, ...customRows]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch("/api/admin/footer-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: editing.slug, title: editing.title, content: editing.content }),
      });
      await load();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!adding) return;
    setAddError("");
    const slug = adding.slug.trim().toLowerCase();
    if (!slug || !adding.title.trim()) {
      setAddError("슬러그와 제목은 필수입니다.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setAddError("슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.");
      return;
    }
    if (items.some((it) => it.slug === slug)) {
      setAddError("이미 존재하는 슬러그입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/footer-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title: adding.title.trim(), content: adding.content }),
      });
      if (!res.ok) {
        setAddError("저장에 실패했습니다.");
        return;
      }
      await load();
      setAdding(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("이 콘텐츠를 삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/footer-content/${slug}`, { method: "DELETE" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">푸터 콘텐츠 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">지원 페이지(이용약관, FAQ, 배송안내 등)의 내용을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700">
            <Icon name="Reorder" size={16} />
          </button>
          {!editing && !adding && (
            <button
              onClick={() => {
                setAddError("");
                setAdding({ slug: "", title: "", content: "" });
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg px-3 py-2 hover:bg-amber-600 transition-colors"
            >
              <Icon name="Plus" size={14} /> 콘텐츠 추가
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : adding ? (
        <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-amber-700">📄 새 콘텐츠 추가</h2>
            <button onClick={() => setAdding(null)} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              슬러그 <span className="font-normal text-gray-400">(URL 경로 · 영문 소문자/숫자/하이픈)</span>
            </label>
            <input
              value={adding.slug}
              onChange={(e) => setAdding({ ...adding, slug: e.target.value })}
              placeholder="예: refund-policy"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-400"
            />
            {adding.slug.trim() && (
              <p className="text-[11px] text-gray-400 mt-1">
                페이지 주소: <span className="font-mono text-amber-600">/support/{adding.slug.trim().toLowerCase()}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목</label>
            <input
              value={adding.title}
              onChange={(e) => setAdding({ ...adding, title: e.target.value })}
              placeholder="예: 환불 정책"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              내용 <span className="font-normal text-gray-400">(HTML 또는 텍스트)</span>
            </label>
            <textarea
              value={adding.content}
              onChange={(e) => setAdding({ ...adding, content: e.target.value })}
              rows={16}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 resize-y"
              placeholder="내용을 입력하세요..."
            />
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={14} />
              {saving ? "저장 중..." : "추가"}
            </button>
          </div>
        </div>
      ) : editing ? (
        <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-amber-700">
              {SLUG_META[editing.slug]?.emoji} {editing.title} 편집
            </h2>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목</label>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              내용 <span className="font-normal text-gray-400">(HTML 또는 텍스트)</span>
            </label>
            <textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              rows={16}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-400 resize-y"
              placeholder="내용을 입력하세요..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={14} />
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.slug} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between hover:border-amber-200 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{SLUG_META[item.slug]?.emoji ?? "📄"}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.id
                      ? `마지막 수정: ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ko-KR") : "-"}`
                      : <span className="text-amber-500">기본값 사용 중 (DB 미저장)</span>
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditing({ ...item })}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition-colors"
                >
                  <Icon name="Edit" size={12} /> 편집
                </button>
                {!SLUG_META[item.slug] && item.id && (
                  <button
                    onClick={() => handleDelete(item.slug)}
                    className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors"
                  >
                    <Icon name="Delete" size={12} /> 삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
