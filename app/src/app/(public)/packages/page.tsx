import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import SafeImage from "@/components/shared/SafeImage";
import { Package, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const packages = await prisma.packageProduct.findMany({
    where: { status: "APPROVED", stock: { gt: 0 } },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              brand: { select: { brandName: true } },
            },
          },
        },
        take: 3,
      },
      _count: { select: { packageOrderItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[480px] mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Package size={20} className="text-brand-600" />
          <h1 className="text-lg font-bold text-gray-900">패키지 상품</h1>
        </div>
        <p className="text-sm text-gray-500">여러 브랜드 상품을 한번에! 특가 패키지</p>
      </div>

      {packages.length === 0 ? (
        <div className="py-20 text-center">
          <Package size={48} className="mx-auto mb-4 opacity-20 text-gray-400" />
          <p className="text-sm text-gray-400">현재 판매 중인 패키지 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => {
            const totalUnitPrice = pkg.items.reduce((sum, item) => sum + Number(item.unitPrice), 0);
            const discount = totalUnitPrice > 0 ? Math.round((1 - Number(pkg.packagePrice) / totalUnitPrice) * 100) : 0;

            return (
              <Link
                key={pkg.id}
                href={`/packages/${pkg.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 패키지 이미지 */}
                <div className="w-full h-48 bg-gray-100 overflow-hidden relative">
                  {pkg.imageUrl ? (
                    <SafeImage
                      src={pkg.imageUrl}
                      alt={pkg.name}
                      width={480}
                      height={192}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Package size={48} className="text-gray-300" />
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {discount}% 할인
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <h2 className="text-sm font-bold text-gray-900 mb-1">{pkg.name}</h2>
                  {pkg.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{pkg.description}</p>
                  )}

                  {/* 구성 상품 미리보기 */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {pkg.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0"
                        title={item.product.name}
                      >
                        {item.product.thumbnail ? (
                          <SafeImage
                            src={item.product.thumbnail}
                            alt={item.product.name}
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={14} className="m-auto mt-2.5 text-gray-300" />
                        )}
                      </div>
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                      외 {pkg.items.length}종 구성
                    </span>
                  </div>

                  {/* 가격 & 버튼 */}
                  <div className="flex items-center justify-between">
                    <div>
                      {discount > 0 && (
                        <p className="text-xs text-gray-400 line-through">{formatPrice(totalUnitPrice)}원</p>
                      )}
                      <p className="text-base font-bold text-gray-900">
                        {formatPrice(Number(pkg.packagePrice))}원
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-brand-600 font-medium">
                      구매하기 <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
