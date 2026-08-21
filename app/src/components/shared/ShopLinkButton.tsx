"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
;

interface ShopLinkButtonProps {
  slug: string;
  className?: string;
}

export default function ShopLinkButton({ slug, className = "" }: ShopLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const shopUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shop/${slug}`
    : `/shop/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shopUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVisit = () => {
    window.open(`/shop/${slug}`, "_blank");
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={handleVisit}
        className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        <Icon name="ArrowRight" size={14} strokeWidth={1.5} />
        SHOP 바로가기
      </button>
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          copied
            ? "bg-green-100 text-green-700 border border-green-200"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
        }`}
      >
        {copied ? <Icon name="Check" size={14} strokeWidth={2} /> : <Icon name="Copy" size={14} strokeWidth={1.5} />}
        {copied ? "복사됨!" : "링크 복사"}
      </button>
    </div>
  );
}
