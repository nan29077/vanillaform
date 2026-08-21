"use client";

import { useState } from "react";
import { Loader2, Database } from "lucide-react";
import { useAppDialog } from "@/components/shared/AppDialog";

export default function SeedDataButton() {
  const [loading, setLoading] = useState(false);
  const { appConfirm, appAlert } = useAppDialog();

  const handleSeed = async () => {
    if (!await appConfirm("더미 주문/정산 데이터를 생성하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seed-data", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await appAlert({ message: `${data.message}\n주문 ${data.orders}건, 정산 ${data.settlements}건 생성됨`, type: "success" });
        window.location.reload();
      } else {
        appAlert({ message: data.error || "생성 실패", type: "warning" });
      }
    } catch {
      appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSeed} disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
      {loading ? "생성 중..." : "더미 데이터 생성"}
    </button>
  );
}
