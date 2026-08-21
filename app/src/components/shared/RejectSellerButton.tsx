"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";

interface RejectSellerButtonProps {
  sellerId: string;
  sellerName?: string;
}

export default function RejectSellerButton({ sellerId, sellerName }: RejectSellerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { appConfirm, appAlert } = useAppDialog();

  const handleReject = async () => {
    const ok = await appConfirm({
      message: `${sellerName ? `'${sellerName}' ` : ""}라이브 셀러 입점 신청을 거절하시겠습니까?\n신청 계정이 삭제됩니다.`,
      type: "warning",
      confirmText: "거절",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sellers/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        appAlert({ message: data.error || "거절에 실패했습니다.", type: "warning" });
      }
    } catch {
      appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReject}
      disabled={loading}
      className="text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {loading ? "처리중..." : "거절"}
    </button>
  );
}
