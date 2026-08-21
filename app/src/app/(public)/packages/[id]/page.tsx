import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import SafeImage from "@/components/shared/SafeImage";
import PackageBuySection from "@/components/shared/PackageBuySection";
import Link from "next/link";
import { Package, ChevronLeft, ShoppingBag } from "lucide-react";
// ShoppingBag used in section header

export const dynamic = "force-dynamic";

export default async function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  const pkg = await prisma.packageProduct.findUnique({
    where: { id: params.id, status: "APPROVED" },
    include: {
      creator: { select: { name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              description: true,
              basePrice: true,
              supplyPrice: true,
              brand: { select: { brandName: true } },
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!pkg) notFound();

  const totalUnitPrice = pkg.items.reduce((sum, item) => sum + Number(item.unitPrice), 0);
  const discount =
    totalUnitPrice > 0
      ? Math.round((1 - Number(pkg.packagePrice) / totalUnitPrice) * 100)
      : 0;

  return (
    <div className="max-w-[480px] mx-auto">
      {/* 뒤로가기 */}
      <div className="px-4 pt-4 pb-2">
        <Link href="/packages" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft size={16} />
          패키지 상품 목록
        </Link>
      </div>

      {/* 대표 이미지 */}
      <div className="w-full h-64 bg-gray-100 overflow-hidden relative">
        {pkg.imageUrl ? (
          <SafeImage src={pkg.imageUrl} alt={pkg.name} width={480} height={256} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package size={64} className="text-gray-300" />
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-4 right-4 bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">
            {discount}% 할인
          </div>
        )}
      </div>

      {/* 패키지 정보 */}
      <div className="px-4 py-5">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h1>
        {pkg.description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{pkg.description}</p>
        )}

        {/* 가격 */}
        <div className="bg-brand-50 rounded-xl p-4 mb-5">
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(Number(pkg.packagePrice))}원
            </span>
            {discount > 0 && (
              <>
                <span className="text-sm text-gray-400 line-through mb-1">
                  {formatPrice(totalUnitPrice)}원
                </span>
                <span className="text-sm font-bold text-red-500 mb-1">-{discount}%</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">잔여 재고 {pkg.stock}개</p>
        </div>

        {/* 구성 상품 목록 */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <ShoppingBag size={15} className="text-brand-600" />
            구성 상품 ({pkg.items.length}종)
          </h2>
          <div className="space-y-3">
            {pkg.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.product.thumbnail ? (
                    <SafeImage
                      src={item.product.thumbnail}
                      alt={item.product.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={24} className="m-auto mt-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400">{item.product.brand?.brandName}</p>
                  {item.product.category && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      {item.product.category.name}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">
                    {formatPrice(Number(item.unitPrice))}원
                  </p>
                  <p className="text-[10px] text-gray-400">개별 단가</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 구매 섹션 */}
      <PackageBuySection
        packageId={pkg.id}
        packageName={pkg.name}
        packagePrice={Number(pkg.packagePrice)}
        stock={pkg.stock}
        isLoggedIn={!!session?.user}
      />
    </div>
  );
}
