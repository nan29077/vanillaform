"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
;
import { useAppDialog } from "@/components/shared/AppDialog";

interface BuyNowButtonProps {
  productId: string;
  variantId?: string | null;
  sellerId: string;
  campaignId?: string | null;
  className?: string;
  label?: string;
  price?: string; // formatted price string e.g. "42,000원"
  disabled?: boolean;
  // 라이브 시청화면에서 진입한 경우 주문 페이지에도 from=live 를 전달해 헤더/하단바를 숨긴다
  fromLive?: boolean;
  hideIcon?: boolean;
}

export default function BuyNowButton({
  productId,
  variantId,
  sellerId,
  campaignId,
  className = "flex-1 h-12 bg-black text-white font-semibold text-sm rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5",
  label = "구매하기",
  price,
  disabled = false,
  fromLive = false,
  hideIcon = false,
}: BuyNowButtonProps) {
  const { appConfirm, appAlert } = useAppDialog();
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const handleBuyNow = () => {
    if (disabled) return;
    if (!session) {
      router.push("/auth/login");
      return;
    }

    const params = new URLSearchParams({
      productId,
      sellerId,
      quantity: "1",
    });
    if (variantId) params.set("variantId", variantId);
    if (campaignId) params.set("campaignId", campaignId);
    if (fromLive) params.set("from", "live");

    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <button
      onClick={handleBuyNow}
      disabled={loading || disabled}
      className={`${className} disabled:opacity-80`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="flex flex-col items-center justify-center leading-tight">
          <span className="flex items-center gap-1">
            {label}
          </span>
          {price && (
            <span className="text-[10px] font-normal opacity-80">{price}</span>
          )}
        </span>
      )}
    </button>
  );
}
