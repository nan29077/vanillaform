"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";
import { Icon } from "@/components/shared/Icon";
import { Power, UserCheck, UserX, X } from "lucide-react";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface NodeUser {
  id: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  gender: string | null;
  createdAt: string;
  avatar: string;
}

export default function NodeManagementClient({ nodes }: { nodes: NodeUser[] }) {
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(
      (n) =>
        n.name?.toLowerCase().includes(q) ||
        n.email?.toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const handleToggle = async (node: NodeUser) => {
    const nextActive = !node.isActive;
    const confirmed = await appConfirm({
      message: nextActive
        ? `${node.name || node.email} 계정을 활성화하시겠습니까?`
        : `${node.name || node.email} 계정을 비활성화하시겠습니까?`,
      type: nextActive ? "confirm" : "warning",
    });
    if (!confirmed) return;

    setLoadingId(node.id);
    try {
      const res = await fetch(`/api/admin/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        appAlert({ message: data.error || "처리에 실패했습니다.", type: "warning" });
      }
    } catch {
      appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">노드 계정 관리</h1>
          <p className="text-sm text-gray-500">총 {nodes.length}개 노드 계정</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Icon
              name="Network"
              size={40}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-gray-300"
            />
            <p className="text-sm text-gray-500">
              {searchQuery ? "검색 결과가 없습니다." : "등록된 노드 계정이 없습니다."}
            </p>
          </div>
        ) : (
          pageItems.map((node) => (
            <div
              key={node.id}
              className="bg-white rounded-xl border border-gray-100 p-4"
            >
              <div className="flex items-center gap-3">
                {/* 프로필 아바타 */}
                <img
                  src={node.avatar}
                  alt={node.name || "노드"}
                  className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-gray-100"
                />

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {node.name || "(이름 없음)"}
                    </span>
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        node.isActive
                          ? "bg-green-50 text-green-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {node.isActive ? "활성" : "비활성"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {node.email}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    가입일: {new Date(node.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>

                {/* 토글 버튼 */}
                <button
                  onClick={() => handleToggle(node)}
                  disabled={loadingId === node.id}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                    node.isActive
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  }`}
                >
                  {loadingId === node.id ? (
                    <Power size={13} className="animate-spin" />
                  ) : node.isActive ? (
                    <UserX size={13} />
                  ) : (
                    <UserCheck size={13} />
                  )}
                  {node.isActive ? "비활성화" : "활성화"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
