"use client";

import { Icon } from '@/components/shared/Icon';
import { useRouter } from "next/navigation";
import {} from "lucide-react";

interface Props {
  shopSlug?: string | null;
}

export default function ProductBackButton({ shopSlug }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (shopSlug) {
      router.push(`/shop/${shopSlug}`);
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="text-gray-900 hover:opacity-60 transition-opacity"
      aria-label="뒤로가기"
    >
      <Icon name="ArrowRight" size={22} strokeWidth={1.5} className="rotate-180" />
    </button>
  );
}
