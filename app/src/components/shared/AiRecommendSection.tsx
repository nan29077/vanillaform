"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import Link from "next/link";
import {Sparkles} from 'lucide-react';
import SafeImage from "./SafeImage";
import WishlistButton from "./WishlistButton";
import ProductBadges from "./ProductBadges";

interface AiProduct {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  brandName: string | null;
  sellerName: string | null;
  soldCount: number;
  badges: string | null;
}

interface AiRecommendSectionProps {
  products: AiProduct[];
}

const RECENTLY_VIEWED_KEY = "sb_recently_viewed";
const MAX_RECENT = 10;

function getRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
  } catch {
    return [];
  }
}

function getRecommendations(allProducts: AiProduct[], recentIds: string[]): AiProduct[] {
  if (recentIds.length === 0) {
    // No browsing history: recommend top sellers (popularity-based)
    return shuffleArray(allProducts).slice(0, 6);
  }

  // Find recently viewed products
  const recentProducts = recentIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as AiProduct[];

  // Collect preferred categories and brands
  const categoryWeights: Record<string, number> = {};
  const brandWeights: Record<string, number> = {};

  recentProducts.forEach((p, idx) => {
    const weight = recentProducts.length - idx; // More recent = higher weight
    if (p.categoryId) {
      categoryWeights[p.categoryId] = (categoryWeights[p.categoryId] || 0) + weight;
    }
    if (p.brandName) {
      brandWeights[p.brandName] = (brandWeights[p.brandName] || 0) + weight;
    }
  });

  // Score each product
  const recentIdSet = new Set(recentIds);
  const scored = allProducts
    .filter((p) => !recentIdSet.has(p.id))
    .map((p) => {
      let score = 0;
      if (p.categoryId && categoryWeights[p.categoryId]) {
        score += categoryWeights[p.categoryId] * 3;
      }
      if (p.brandName && brandWeights[p.brandName]) {
        score += brandWeights[p.brandName] * 2;
      }
      score += Math.min(p.soldCount, 100) / 20; // Popularity bonus (max 5)
      score += Math.random() * 2; // Random factor for variety
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 6);
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function AiRecommendSection({ products }: AiRecommendSectionProps) {
  const [recommendations, setRecommendations] = useState<AiProduct[]>([]);
  const [hasHistory, setHasHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const recent = getRecentlyViewed();
    setHasHistory(recent.length > 0);
    setRecommendations(getRecommendations(products, recent));
  }, [products]);

  // Track product views: listen for product detail page visits
  useEffect(() => {
    const trackView = () => {
      // Check URL for product page pattern
      const match = window.location.pathname.match(/^\/products\/(.+)$/);
      if (match) {
        const productId = match[1];
        const recent = getRecentlyViewed();
        const filtered = recent.filter((id) => id !== productId);
        filtered.unshift(productId);
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
      }
    };

    // Track initial load
    trackView();

    // Listen for navigation changes
    window.addEventListener("popstate", trackView);
    return () => window.removeEventListener("popstate", trackView);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    const recent = getRecentlyViewed();
    setRecommendations(getRecommendations(products, recent));
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (recommendations.length === 0) return null;

  return (
    <section className="py-5 bg-gradient-to-b from-violet-50/50 to-white">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 rounded-full">
            <Sparkles size={12} className="text-violet-600" />
            <span className="text-[10px] font-bold text-violet-700">AI</span>
          </div>
          <h2 className="text-sm font-bold text-gray-900">맞춤 추천</h2>
          {hasHistory && (
            <span className="text-[9px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">
              <Icon name="Eye" size={9} className="inline mr-0.5" />
              최근 관심 기반
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition-colors"
        >
          <Icon name="Reorder" size={12} className={isRefreshing ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {!hasHistory && (
        <p className="text-[10px] text-gray-400 px-4 -mt-1 mb-2">
          상품을 탐색하면 더 정확한 추천을 받을 수 있어요
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 px-4">
        {recommendations.map((product) => (
          <div key={product.id} className="flex flex-col">
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-50 mb-1.5">
              <Link href={`/products/${product.id}`}>
                <SafeImage
                  src={product.thumbnail}
                  alt={product.name}
                  width={130}
                  height={173}
                  fallbackText={product.name}
                  className="w-full h-full object-cover"
                />
              </Link>
              <WishlistButton productId={product.id} />
              <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-600/80 backdrop-blur-sm text-white text-[8px] font-medium rounded-full">
                <Sparkles size={8} /> AI
              </span>
              <ProductBadges badges={product.badges} className="absolute bottom-1.5 left-1.5" />
            </div>
            <Link href={`/products/${product.id}`} className="flex-1 flex flex-col">
              {product.sellerName && (
                <p className="text-[9px] text-gray-400 truncate">{product.sellerName}</p>
              )}
              <p className="text-[11px] text-gray-800 truncate leading-tight mt-0.5">{product.name}</p>
              <p className="text-xs font-bold text-gray-900 mt-0.5">{formatPrice(product.basePrice)}</p>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
