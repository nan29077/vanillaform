"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {Loader2, X} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import ProductChatPanel from "@/components/shared/ProductChatPanel";
import { useAppDialog } from "@/components/shared/AppDialog";
import RejectReasonModal from "@/components/shared/RejectReasonModal";

interface PendingApp {
  id: string;
  productId: string;
  productName: string;
  productThumbnail: string | null;
  sellerShopName: string;
  sellerShopLogo: string | null;
  sellerPrice?: number | null;
  createdAt?: string;
  brandName?: string | null;
}

interface Props {
  applications: PendingApp[];
  currentUserId: string;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function PendingSellerApproval({ applications, currentUserId }: Props) {
  const { appAlert } = useAppDialog();
  const [loading, setLoading] = useState<string | null>(null);
  // 반려 사유 입력 대상 신청
  const [rejectTarget, setRejectTarget] = useState<PendingApp | null>(null);

  const approve = async (shopProductId: string) => {
    setLoading(shopProductId);
    try {
      const res = await fetch("/api/seller-products/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopProductId, action: "approve" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        await appAlert(data.error || "처리 실패");
      }
    } catch {
      appAlert("오류가 발생했습니다.");
    }
    setLoading(null);
  };

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return;
    const shopProductId = rejectTarget.id;
    setLoading(shopProductId);
    try {
      const res = await fetch("/api/seller-products/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopProductId, action: "reject", rejectionReason: reason }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        await appAlert(data.error || "처리 실패");
        setLoading(null);
      }
    } catch {
      appAlert("오류가 발생했습니다.");
      setLoading(null);
    }
  };

  if (applications.length === 0) return null;

  return (
    <div className="bg-yellow-50 rounded-xl border border-yellow-100 overflow-hidden divide-y divide-yellow-100">
      {applications.map((app) => (
        <div key={app.id} className="flex items-center gap-3 p-3 sm:p-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            <SafeImage src={app.productThumbnail} alt={app.productName} width={40} height={40} fallbackText="P" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{app.productName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100">
                  <SafeImage src={app.sellerShopLogo} alt="" width={16} height={16} fallbackText={app.sellerShopName.charAt(0)} />
                </div>
                <span className="text-[10px] text-blue-600 font-medium">{app.sellerShopName}</span>
              </div>
              {app.brandName && (
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{app.brandName}</span>
              )}
              {app.sellerPrice != null && (
                <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">판매가 {formatPrice(app.sellerPrice)}</span>
              )}
              {app.createdAt && (
                <span className="text-[10px] text-gray-400">{new Date(app.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => window.open(`/products/${app.productId}`, "_blank")}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
              title="상품 상세 보기"
            >
              <Icon name="ArrowRight" size={12} className="shrink-0" /> 상품 상세 보기
            </button>
            <ProductChatPanel
              productId={app.productId}
              productName={app.productName}
              currentUserId={currentUserId}
            />
            <button
              type="button"
              onClick={() => approve(app.id)}
              disabled={loading === app.id}
              className="flex items-center gap-1 text-[10px] px-3 py-1.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading === app.id ? <Loader2 size={12} className="animate-spin" /> : <><Icon name="Check" size={12} className="shrink-0" /> 승인</>}
            </button>
            <button
              type="button"
              onClick={() => setRejectTarget(app)}
              disabled={loading === app.id}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg font-bold hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <X size={12} className="shrink-0" /> 반려
            </button>
          </div>
        </div>
      ))}

      {rejectTarget && (
        <RejectReasonModal
          productName={rejectTarget.productName}
          loading={loading === rejectTarget.id}
          onCancel={() => setRejectTarget(null)}
          onConfirm={confirmReject}
        />
      )}
    </div>
  );
}
