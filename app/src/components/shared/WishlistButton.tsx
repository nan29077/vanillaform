"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
;

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: number;
  initialLiked?: boolean;
}

export default function WishlistButton({ 
  productId, 
  className,
  size = 14,
  initialLiked = false,
}: WishlistButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check initial like status
  useEffect(() => {
    if (!session || initialLiked) return;
    const checkLiked = async () => {
      try {
        const res = await fetch("/api/wishlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: [productId] }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.likedIds?.includes(productId)) {
            setLiked(true);
          }
        }
      } catch {
        // silent fail
      }
    };
    checkLiked();
  }, [session, productId, initialLiked]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (loading) return;
    setLoading(true);
    setAnimating(true);

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={className || "absolute top-1.5 right-1.5 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-all"}
      aria-label={liked ? "위시리스트에서 제거" : "위시리스트에 추가"}
    >
      <Icon name="Wishlist"
        size={size}
        strokeWidth={1.5}
        className={`transition-all duration-200 ${
          liked
            ? "fill-rose-500 text-rose-500"
            : "fill-none text-gray-500 hover:text-rose-400"
        } ${animating ? "scale-125" : "scale-100"}`}
      />
    </button>
  );
}
