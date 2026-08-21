import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import {} from 'lucide-react';

export const dynamic = "force-dynamic";

export default async function MyReviewsPage() {
  const session = await requireBuyerSession();

  const reviews = await prisma.review.findMany({
    where: { userId: session.user!.id },
    include: {
      product: { select: { name: true, thumbnail: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="animate-fade-in pb-4">
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-gray-500 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <h1 className="text-base font-bold text-gray-900">내 리뷰</h1>
          <span className="text-xs text-gray-400">{reviews.length}개</span>
        </div>
      </div>

      <div className="px-4 pt-4">
        {reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Message" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">작성한 리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {review.product.thumbnail ? (
                      <img
                        src={review.product.thumbnail}
                        alt={review.product.name}
                        className="w-full h-full object-cover"
                        onError={(e: any) => { e.target.src = 'https://placehold.co/48x48/f5f5f5/999?text=No+Img'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Icon name="Star" size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{review.product.name}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icon name="Star"
                          key={i}
                          size={12}
                          strokeWidth={1.5}
                          className={i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{review.content}</p>
                {parseJsonArray(review.images).length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {parseJsonArray(review.images).map((img, idx) => (
                      <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                        <img src={img} alt="" className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none'; }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
