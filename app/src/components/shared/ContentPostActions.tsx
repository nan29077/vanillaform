"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface Props {
  postId: string;
  status: "pending" | "published" | "draft";
  isAdmin?: boolean;
}

export default function ContentPostActions({ postId, status, isAdmin }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      if (action === "delete") {
        if (!await appConfirm({ message: "정말 삭제하시겠습니까?", type: "warning", confirmText: "삭제" })) {
          setLoading(false);
          return;
        }
        const endpoint = isAdmin ? `/api/admin/contents?id=${postId}` : `/api/content-posts?id=${postId}`;
        await fetch(endpoint, { method: "DELETE" });
      } else if (action === "edit") {
        // Navigate to content edit page
        router.push(`/seller/contents/edit/${postId}`);
        setShowMenu(false);
        setLoading(false);
        return;
      } else {
        const endpoint = isAdmin ? "/api/admin/contents" : "/api/content-posts";
        await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: postId, action }),
        });
      }
      window.location.reload();
    } catch {
      appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    }
    setLoading(false);
    setShowMenu(false);
  };

  if (loading) {
    return <Loader2 size={16} className="animate-spin text-gray-400" />;
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Icon name="Menu" size={16} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 min-w-[140px]">
            {/* Admin actions for pending */}
            {isAdmin && status === "pending" && (
              <>
                <button
                  onClick={() => handleAction("approve")}
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs text-green-600 hover:bg-green-50 transition-colors"
                >
                  <Icon name="Eye" size={14} />
                  승인 (공개)
                </button>
                <button
                  onClick={() => handleAction("reject")}
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Icon name="Eye" size={14} />
                  거부
                </button>
              </>
            )}
            {/* Seller actions for pending */}
            {!isAdmin && status === "pending" && (
              <button
                onClick={() => handleAction("unpublish")}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-yellow-600 hover:bg-yellow-50 transition-colors"
              >
                <Icon name="Lock" size={14} />
                비공개 전환
              </button>
            )}
            {/* Published -> unpublish */}
            {status === "published" && (
              <button
                onClick={() => handleAction("unpublish")}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-yellow-600 hover:bg-yellow-50 transition-colors"
              >
                <Icon name="Eye" size={14} />
                비공개 전환
              </button>
            )}
            {/* Draft -> publish */}
            {status === "draft" && (
              <button
                onClick={() => handleAction("publish")}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-green-600 hover:bg-green-50 transition-colors"
              >
                <Icon name="Eye" size={14} />
                공개 전환
              </button>
            )}
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => handleAction("delete")}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <Icon name="Delete" size={14} />
              삭제
            </button>
            {/* 수정 버튼 */}
            <button
              onClick={() => handleAction("edit")}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Icon name="Edit" size={14} />
              수정
            </button>
          </div>
        </>
      )}
    </div>
  );
}
