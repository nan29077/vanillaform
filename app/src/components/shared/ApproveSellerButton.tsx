"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";

interface ApproveSellerButtonProps {
  sellerId: string;
}

export default function ApproveSellerButton({ sellerId }: ApproveSellerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { appConfirm, appAlert } = useAppDialog();

  const handleApprove = async () => {
    if (!await appConfirm("이 라이브 셀러를 승인하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sellers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        appAlert({ message: "승인에 실패했습니다.", type: "warning" });
      }
    } catch {
      appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
    >
      {loading ? "처리중..." : "승인"}
    </button>
  );
}
