"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo, useEffect } from "react";
import {X} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface Inquiry {
  id: string; name: string; email: string; category: string;
  message: string; reply: string | null; status: "pending" | "replied";
  createdAt: string;
}

// Dummy data for inquiries
const DUMMY_INQUIRIES: Inquiry[] = [
  { id: "1", name: "김민지", email: "minji@example.com", category: "배송", message: "주문한 상품이 아직 배송되지 않았습니다. 주문번호 ORD-2024-001입니다.", reply: "안녕하세요, 김민지님. 해당 주문은 현재 배송 준비 중이며, 내일 출고 예정입니다.", status: "replied", createdAt: "2024-03-25T10:30:00Z" },
  { id: "2", name: "이수호", email: "suho@example.com", category: "상품", message: "상품 사이즈가 맞지 않아 교환하고 싶습니다.", reply: null, status: "pending", createdAt: "2024-03-26T14:20:00Z" },
  { id: "3", name: "박서연", email: "seoyeon@example.com", category: "결제", message: "결제가 두 번 되었습니다. 확인 부탁드립니다.", reply: null, status: "pending", createdAt: "2024-03-26T16:45:00Z" },
  { id: "4", name: "정우진", email: "woojin@example.com", category: "기타", message: "라이브 셀러 등록 절차에 대해 알고 싶습니다.", reply: "안녕하세요! 라이브 셀러 등록은 회원가입 후 라이브 셀러 신청을 통해 진행됩니다. 사업자등록증과 기본 정보를 입력하시면 됩니다.", status: "replied", createdAt: "2024-03-24T09:00:00Z" },
  { id: "5", name: "최하은", email: "haeun@example.com", category: "환불", message: "구매한 상품의 환불을 요청합니다. 상품에 하자가 있습니다.", reply: null, status: "pending", createdAt: "2024-03-27T08:15:00Z" },
];

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(DUMMY_INQUIRIES);
  const [searchQuery, setSearchQuery] = useState("");

  // 실제 접수된 1:1 문의를 불러와 앞쪽(최신순)에 병합. 실패 시 더미 유지.
  useEffect(() => {
    fetch("/api/public/inquiry")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Inquiry[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setInquiries([...data, ...DUMMY_INQUIRIES]);
        }
      })
      .catch(() => {});
  }, []);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "replied">("all");

  const filtered = useMemo(() => {
    let result = inquiries;
    if (filter !== "all") result = result.filter(i => i.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q) || i.message.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return result;
  }, [inquiries, searchQuery, filter]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const handleReply = (id: string) => {
    const text = replyText[id]?.trim();
    if (!text) return;
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, reply: text, status: "replied" as const } : i));
    setReplyText(prev => ({ ...prev, [id]: "" }));
  };

  const pendingCount = inquiries.filter(i => i.status === "pending").length;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Message" size={20} className="text-brand-500" /> 문의 관리
          </h1>
          <p className="text-sm text-gray-500">총 {inquiries.length}건 · 미답변 {pendingCount}건</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일, 내용 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "replied"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {f === "all" ? "전체" : f === "pending" ? "미답변" : "답변완료"}
            </button>
          ))}
        </div>
      </div>

      {/* Inquiry List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Icon name="Message" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{searchQuery ? "검색 결과가 없습니다." : "문의 내역이 없습니다."}</p>
          </div>
        ) : pageItems.map((inquiry) => (
          <div key={inquiry.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${inquiry.status === "pending" ? "bg-orange-500" : "bg-green-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{inquiry.category}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${inquiry.status === "pending" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
                    {inquiry.status === "pending" ? "미답변" : "답변완료"}
                  </span>
                </div>
                <p className="text-sm text-gray-900 truncate">{inquiry.message}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                  <span className="flex items-center gap-0.5"><Icon name="MyPage" size={10} /> {inquiry.name}</span>
                  <span className="flex items-center gap-0.5"><Icon name="Mail" size={10} /> {inquiry.email}</span>
                  <span className="flex items-center gap-0.5"><Icon name="Clock" size={10} /> {new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
              {expandedId === inquiry.id ? <Icon name="ChevronDown" size={16} className="text-gray-400 rotate-180" /> : <Icon name="ChevronDown" size={16} className="text-gray-400" />}
            </button>

            {expandedId === inquiry.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                  <p className="text-sm text-gray-800 bg-white rounded-lg p-3 border border-gray-100">{inquiry.message}</p>
                </div>
                {inquiry.reply && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1"><Icon name="Check" size={12} /> 답변</p>
                    <p className="text-sm text-gray-800 bg-green-50 rounded-lg p-3 border border-green-100">{inquiry.reply}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">{inquiry.reply ? "추가 답변" : "답변 작성"}</p>
                  <div className="flex gap-2">
                    <textarea value={replyText[inquiry.id] || ""} onChange={(e) => setReplyText(prev => ({ ...prev, [inquiry.id]: e.target.value }))}
                      placeholder="답변을 입력하세요..." className="flex-1 text-sm border border-gray-200 rounded-lg p-2.5 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <button onClick={() => handleReply(inquiry.id)} disabled={!replyText[inquiry.id]?.trim()}
                    className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Icon name="Share" size={12} /> 답변 전송
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
