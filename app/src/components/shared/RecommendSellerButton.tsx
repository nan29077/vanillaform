"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
;

export default function RecommendSellerButton({
  sellerId,
  initialRecommended,
}: {
  sellerId: string;
  initialRecommended: boolean;
}) {
  const [isRecommended, setIsRecommended] = useState(initialRecommended);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sellers/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsRecommended(data.isRecommended);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-full transition-all ${
        isRecommended
          ? "bg-purple-500 text-white shadow-sm"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      } ${loading ? "opacity-50 cursor-wait" : ""}`}
      title={isRecommended ? "추천 해제" : "추천 설정"}
    >
      <Icon name="Star" size={12} className={isRecommended ? "fill-white" : ""} />
      {isRecommended ? "추천 ON" : "추천 OFF"}
    </button>
  );
}
