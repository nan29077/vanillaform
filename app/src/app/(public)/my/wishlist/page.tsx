import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import {} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import { NO_IMAGE } from "@/lib/defaults";
import WishlistButton from "@/components/shared/WishlistButton";
import ProductBadges from "@/components/shared/ProductBadges";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await requireBuyerSession();

  const wishlists = await prisma.wishlist.findMany({
    where: { userId: session.user!.id },
    include: {
      product: {
        include: {
          brand: true,
          sellerProducts: {
            where: { isActive: true },
            include: { seller: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="animate-fade-in pb-20 bg-white">
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/my" className="text-gray-900 hover:opacity-60 transition-opacity">
            <Icon name="ArrowRight" size={22} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <p className="text-sm font-medium text-gray-900">찜한 상품</p>
          <div className="w-[22px]" />
        </div>
      </div>

      {/* 찜 개수 */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-xs text-gray-500">
          총 <span className="font-bold text-gray-900">{wishlists.length}</span>개의 상품
        </p>
      </div>

      {wishlists.length > 0 ? (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            {wishlists.map((wish) => {
              const p = wish.product;
              const discountPercent = p.comparePrice && Number(p.comparePrice) > Number(p.basePrice)
                ? Math.round((1 - Number(p.basePrice) / Number(p.comparePrice)) * 100)
                : 0;
              const badges = p.badges || null;

              return (
                <div key={wish.id} className="relative group">
                  <Link href={`/products/${p.id}`}>
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
                      <SafeImage
                        src={p.thumbnail}
                        placeholder={NO_IMAGE}
                        alt={p.name}
                        width={220}
                        height={220}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallbackText={p.name.charAt(0)}
                      />
                      {badges && (
                        <div className="absolute bottom-1.5 left-1.5">
                          <ProductBadges badges={badges} maxShow={2} />
                        </div>
                      )}
                    </div>
                    <div className="px-0.5">
                      <p className="text-[10px] text-gray-400 truncate">
                        {p.sellerProducts[0]?.seller?.shopName || p.brand?.brandName || ""}
                      </p>
                      <p className="text-xs font-medium text-gray-900 truncate mt-0.5">{p.name}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        {discountPercent > 0 && (
                          <span className="text-xs font-bold text-red-500">{discountPercent}%</span>
                        )}
                        <span className="text-sm font-bold text-gray-900">
                          {formatPrice(Number(p.basePrice))}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <WishlistButton
                    productId={p.id}
                    initialLiked={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Wishlist" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">찜한 상품이 없습니다</p>
          <p className="text-xs text-gray-400 mb-4">마음에 드는 상품을 찜해보세요!</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-white bg-black px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Icon name="Cart" size={14} />
             쇼핑하러 가기
          </Link>
        </div>
      )}
    </div>
  );
}
