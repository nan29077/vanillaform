"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useRef } from "react";
import {X, Loader2} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";

interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Seller {
  id: string;
  shopName: string;
  shopLogo: string | null;
  isActive?: boolean;
}

interface Props {
  productId: string;
  productName: string;
  currentUserId: string;
  sellers: Seller[];
  className?: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SUPER_ADMIN: { bg: "bg-red-50", text: "text-red-600", label: "관리자" },
  BRAND_ADMIN: { bg: "bg-purple-50", text: "text-purple-600", label: "브랜드" },
  SELLER: { bg: "bg-blue-50", text: "text-blue-600", label: "라이브 셀러" },
};

export default function ProductSellerChatPanel({ productId, productName, currentUserId, sellers, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch unread count on mount
  useEffect(() => {
    fetch(`/api/products/chat?productId=${productId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages) {
          const unread = data.messages.filter(
            (m: ChatMessage) => !m.isRead && m.senderId !== currentUserId
          ).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
  }, [productId, currentUserId]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/products/chat?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const unread = (data.messages || []).filter(
          (m: ChatMessage) => !m.isRead && m.senderId !== currentUserId
        ).length;
        setUnreadCount(unread);
      }
    } catch {}
  };

  useEffect(() => {
    if (selectedSeller) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));
      intervalRef.current = setInterval(fetchMessages, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedSeller, productId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/products/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, message: input.trim() }),
      });
      if (res.ok) {
        setInput("");
        await fetchMessages();
      }
    } catch {} finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedSeller(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleBack = () => {
    setSelectedSeller(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <>
      {/* Single Chat Button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
        className={className || "flex items-center gap-1 text-[10px] py-1.5 px-2.5 bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors"}
      >
        <Icon name="Message" size={10} />
        채팅
        {unreadCount > 0 && (
          <span className="w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold ml-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {!selectedSeller ? (
              /* ── Seller List View ── */
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="Message" size={16} className="text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{productName}</p>
                      <p className="text-[10px] text-gray-400">판매자 선택 후 채팅</p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[50vh]">
                  {sellers.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Icon name="MyPage" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">등록된 판매자가 없습니다</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {sellers.map((seller) => (
                        <button
                          key={seller.id}
                          onClick={() => setSelectedSeller(seller)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <SafeImage src={seller.shopLogo} alt={seller.shopName} width={40} height={40} fallbackText={seller.shopName.charAt(0)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{seller.shopName}</p>
                            <p className="text-[10px] text-gray-400">
                              {seller.isActive !== undefined
                                ? (seller.isActive ? "판매중" : "대기중")
                                : "라이브 셀러"}
                            </p>
                          </div>
                          <Icon name="ChevronDown" size={16} className="text-gray-300 flex-shrink-0 -rotate-90" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Chat View (with selected seller) ── */
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={handleBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 flex-shrink-0">
                      <Icon name="ArrowRight" size={16} className="rotate-180" />
                    </button>
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      <SafeImage src={selectedSeller.shopLogo} alt={selectedSeller.shopName} width={28} height={28} fallbackText={selectedSeller.shopName.charAt(0)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{selectedSeller.shopName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{productName}</p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[50vh]">
                  {loading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Icon name="Message" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">아직 대화가 없습니다</p>
                      <p className="text-[10px] mt-1">메시지를 보내 대화를 시작하세요</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.senderId === currentUserId;
                      const roleConfig = ROLE_COLORS[msg.senderRole] || ROLE_COLORS.SELLER;
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"}`}>
                            {!isMine && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className={`w-5 h-5 rounded-full ${roleConfig.bg} flex items-center justify-center`}>
                                  <Icon name="MyPage" size={10} className={roleConfig.text} />
                                </div>
                                <span className="text-[10px] font-medium text-gray-600">{msg.senderName}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${roleConfig.bg} ${roleConfig.text}`}>{roleConfig.label}</span>
                              </div>
                            )}
                            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMine ? "bg-purple-500 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                              {msg.message}
                            </div>
                            <p className={`text-[9px] text-gray-400 mt-0.5 ${isMine ? "text-right" : "text-left"}`}>
                              {new Date(msg.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="메시지를 입력하세요..." className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white" disabled={sending} />
                    <button onClick={handleSend} disabled={!input.trim() || sending}
                      className="w-10 h-10 flex items-center justify-center bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors flex-shrink-0">
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Icon name="Share" size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
