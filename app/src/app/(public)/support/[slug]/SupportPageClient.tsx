"use client";

import { Icon } from '@/components/shared/Icon';
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hexagon} from 'lucide-react';

interface Section { heading: string; body: string; }
interface FaqItem { q: string; a: string; }

function parseContent(content: string): any {
  try { return JSON.parse(content); } catch { return { type: "text", text: content }; }
}

function SectionsBody({ sections, footer }: { sections: Section[]; footer?: string }) {
  return (
    <div className="space-y-5 text-[13px] text-gray-700 leading-relaxed">
      {sections.map((s, i) => (
        <section key={i}>
          <h3 className="font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            {s.heading}
          </h3>
          <p className="text-gray-600">{s.body}</p>
        </section>
      ))}
      {footer && <p className="text-gray-400 text-xs border-t border-amber-100 pt-3">{footer}</p>}
    </div>
  );
}

function FaqBody({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-amber-100 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-white hover:bg-amber-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-[13px] font-semibold text-gray-900 pr-4">{item.q}</span>
            {open === i
              ? <Icon name="ChevronDown" size={16} className="text-amber-400 flex-shrink-0 rotate-180" />
              : <Icon name="ChevronDown" size={16} className="text-amber-400 flex-shrink-0" />}
          </button>
          {open === i && (
            <div className="px-4 pb-4 bg-amber-50">
              <p className="text-[13px] text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContactBody() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("문의가 접수되었습니다. 영업일 기준 1~2일 내에 답변드리겠습니다.");
    setForm({ name: "", email: "", message: "" });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">이름</label>
        <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
          placeholder="이름을 입력하세요"
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">이메일</label>
        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
          placeholder="email@example.com"
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">문의 내용</label>
        <textarea required value={form.message} onChange={e => setForm({...form, message: e.target.value})}
          placeholder="문의 내용을 입력하세요"
          rows={6}
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 resize-none" />
      </div>
      <button type="submit"
        className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors">
        문의 접수하기
      </button>
    </form>
  );
}

function SellerGuideBody({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <h3 className="font-bold text-amber-800 text-[13px]">{s.heading}</h3>
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed ml-8">{s.body}</p>
        </div>
      ))}
      <a href="/seller-apply"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors mt-2">
        <Icon name="Store" size={15} strokeWidth={1.5} />
        라이브 셀러 신청하기
      </a>
    </div>
  );
}

const SLUG_ICONS: Record<string, string> = {
  "seller-guide": "⬡",
  contact: "📬",
  faq: "❓",
  shipping: "🚚",
  terms: "📄",
  privacy: "🔒",
};

export default function SupportPageClient({
  slug, title, content,
}: {
  slug: string; title: string; content: string;
}) {
  const router = useRouter();
  const parsed = parseContent(content);

  function renderBody() {
    if (parsed.type === "faq") return <FaqBody items={parsed.items ?? []} />;
    if (parsed.type === "contact") return <ContactBody />;
    if (parsed.type === "seller-guide") return <SellerGuideBody sections={parsed.sections ?? []} />;
    if (parsed.type === "sections") return <SectionsBody sections={parsed.sections ?? []} footer={parsed.footer} />;
    // 일반 텍스트 / HTML fallback
    return (
      <div
        className="text-[13px] text-gray-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parsed.text ?? content }}
      />
    );
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-gradient-to-b from-amber-50 to-white pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-amber-50/90 backdrop-blur-sm border-b border-amber-100 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="p-1.5 text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="뒤로가기"
        >
          <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
        </button>
        <span className="text-lg">{SLUG_ICONS[slug] ?? "📄"}</span>
        <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
      </div>

      {/* 플라워 장식 헤더 영역 */}
      <div className="px-4 pt-5 pb-4 bg-gradient-to-b from-amber-100/60 to-transparent">
        <div className="flex items-center gap-2 text-amber-600 mb-1">
          <Hexagon size={16} className="fill-amber-200 stroke-amber-400" />
          <span className="text-xs font-medium">바닐라폼 고객센터</span>
        </div>
        <p className="text-xl font-bold text-gray-900">{title}</p>
      </div>

      {/* 본문 */}
      <div className="px-4 pt-2">
        {renderBody()}
      </div>
    </div>
  );
}
