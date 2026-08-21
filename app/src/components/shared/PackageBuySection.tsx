"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2, Plus, Minus } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAppDialog } from "@/components/shared/AppDialog";

interface Props {
  packageId: string;
  packageName: string;
  packagePrice: number;
  stock: number;
  isLoggedIn: boolean;
}

export default function PackageBuySection({
  packageId,
  packageName,
  packagePrice,
  stock,
  isLoggedIn,
}: Props) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    buyerName: "",
    buyerPhone: "",
    buyerAddress: "",
    buyerMemo: "",
  });

  const handleOrder = async () => {
    if (!isLoggedIn) {
      await appAlert("로그인 후 구매할 수 있습니다.");
      router.push("/auth/login");
      return;
    }

    if (!form.buyerName || !form.buyerPhone || !form.buyerAddress) {
      await appAlert("배송 정보를 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/package-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          quantity,
          ...form,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        await appAlert(err.error || "주문에 실패했습니다.");
        return;
      }

      await appAlert(
        `주문이 접수됐습니다!\n\n${packageName} ${quantity}개\n총 ${formatPrice(packagePrice * quantity)}원\n\n담당자 확인 후 안내드리겠습니다.`
      );
      router.push("/packages");
    } catch {
      await appAlert("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (stock <= 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-6 pt-3 bg-white border-t border-gray-100 shadow-lg">
        <button disabled className="w-full py-3.5 bg-gray-200 text-gray-400 text-sm font-bold rounded-xl cursor-not-allowed">
          품절
        </button>
      </div>
    );
  }

  return (
    <>
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-2xl px-5 py-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">배송 정보 입력</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">받는 분 이름</label>
                <input
                  type="text"
                  value={form.buyerName}
                  onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">연락처</label>
                <input
                  type="tel"
                  value={form.buyerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">배송 주소</label>
                <input
                  type="text"
                  value={form.buyerAddress}
                  onChange={(e) => setForm((f) => ({ ...f, buyerAddress: e.target.value }))}
                  placeholder="서울시 강남구..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">배송 메모 (선택)</label>
                <input
                  type="text"
                  value={form.buyerMemo}
                  onChange={(e) => setForm((f) => ({ ...f, buyerMemo: e.target.value }))}
                  placeholder="문 앞에 놔주세요"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-t border-gray-100 mt-2">
                <span className="text-sm text-gray-600">수량</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-base font-bold w-6 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm font-bold text-gray-900">
                <span>총 결제금액</span>
                <span className="text-base text-brand-700">{formatPrice(packagePrice * quantity)}원</span>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleOrder}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-bold bg-brand-500 text-black rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "주문 중..." : "주문하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pb-6 pt-3 bg-white border-t border-gray-100 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">{packageName}</span>
          <span className="text-sm font-bold text-gray-900">{formatPrice(packagePrice)}원</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3.5 bg-brand-500 text-black text-sm font-bold rounded-xl hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingBag size={16} />
          패키지 구매하기
        </button>
      </div>
    </>
  );
}
