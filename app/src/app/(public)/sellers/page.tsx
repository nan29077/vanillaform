import { Icon } from '@/components/shared/Icon';
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import {} from "lucide-react";
import SellerSearchClient from "@/components/shared/SellerSearchClient";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SellersPage() {
  const { seller: FEATURE_SELLER } = await getFeatureFlags();
  if (!FEATURE_SELLER) notFound();

  const sellers = await prisma.sellerProfile.findMany({
    where: { isApproved: true },
    include: {
      user: { select: { name: true } },
      _count: { select: { campaigns: true, shopProducts: true, fans: true } },
      // 현재 라이브 중인지 확인
      liveStreams: {
        where: { status: "LIVE" },
        select: { id: true, title: true, shareCode: true, viewerCount: true },
        take: 1,
      },
      // 셀러가 판매하는 상품 이미지를 가져옴
      shopProducts: {
        where: { isActive: true },
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              basePrice: true,
              slug: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
      },
      // 콘텐츠 포스트 이미지도 가져옴
      contentPosts: {
        where: { isPublished: true },
        take: 6,
        orderBy: { createdAt: "desc" },
        select: { images: true },
      },
    },
    orderBy: { totalFans: "desc" },
  });

  const serialized = sellers.map((s) => {
    // 상품 이미지 수집
    const productImages = s.shopProducts
      .map((sp) => sp.product.thumbnail || sp.product.images[0]?.url || null)
      .filter(Boolean) as string[];

    // 콘텐츠 이미지 수집
    const contentImages = s.contentPosts
      .flatMap((cp) => parseJsonArray(cp.images))
      .filter(Boolean);

    // 합쳐서 최대 6개
    const allImages = [...new Set([...contentImages, ...productImages])].slice(0, 6);

    // 상품 정보
    const products = s.shopProducts.map((sp) => ({
      id: sp.product.id,
      name: sp.product.name,
      thumbnail: sp.product.thumbnail || sp.product.images[0]?.url || null,
      basePrice: Number(sp.product.basePrice),
      slug: sp.product.slug,
    }));

    // 해시태그 생성 (카테고리, 무드 기반)
    const tags: string[] = [];
    if (s.user.name) tags.push(`#${s.user.name}`);
    if (s.category) tags.push(`#${s.category}`);
    if (s.mood) {
      s.mood.split(/[,\s]+/).filter(Boolean).forEach((m) => {
        if (!m.startsWith("#")) tags.push(`#${m}`);
        else tags.push(m);
      });
    }

    return {
      slug: s.slug,
      shopName: s.shopName,
      shopLogo: s.shopLogo,
      shopBanner: s.shopBanner,
      shopDescription: s.shopDescription,
      category: s.category,
      mood: s.mood,
      totalFans: s.totalFans,
      _count: {
        campaigns: s._count.campaigns,
        shopProducts: s._count.shopProducts,
        fans: s._count.fans,
      },
      displayImages: allImages,
      products,
      tags,
      isNew: s.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일 이내 신규
      isLive: s.liveStreams.length > 0,
      liveInfo: s.liveStreams[0] ? { 
        shareCode: s.liveStreams[0].shareCode,
        title: s.liveStreams[0].title,
        viewerCount: s.liveStreams[0].viewerCount,
      } : null,
    };
  });

  return (
    <div className="min-h-screen bg-white animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="p-1 -ml-1 text-gray-600 hover:text-gray-900 transition-colors">
              <Icon name="ChevronDown" size={22} strokeWidth={1.5} className="rotate-90" />
            </Link>
            <h1 className="text-base font-bold text-gray-900">라이브 셀러</h1>
          </div>
          <span className="text-xs text-gray-400 font-medium">{serialized.length}명</span>
        </div>
      </div>

      {/* Seller List */}
      <SellerSearchClient sellers={serialized} />
    </div>
  );
}
