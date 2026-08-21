"use client";

import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
;
import { useSearchParams } from "next/navigation";

export default function ProductNotFound() {
  const searchParams = useSearchParams();
  const refSlug = searchParams?.get("ref") ?? null;
  const shopHref = refSlug ? `/shop/${refSlug}` : null;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 pt-10 pb-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
              <Icon name="Package" size={28} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">상품을 찾을 수 없습니다</h2>
            <p className="text-sm text-gray-500 text-center px-6">
              요청하신 상품이 존재하지 않거나<br/>삭제된 상품입니다.
            </p>
          </div>
          <div className="p-5 space-y-2.5">
            {shopHref ? (
              <Link
                href={shopHref}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Icon name="Store" size={16} />
                샵 홈으로
              </Link>
            ) : (
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Icon name="Store" size={16} />
                홈으로
              </Link>
            )}
            <Link
              href="/search"
              className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Icon name="Search" size={16} />
              상품 검색
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
