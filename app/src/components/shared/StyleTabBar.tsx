"use client";

import { useState } from "react";
import Link from "next/link";

const TABS = [
  { label: "전체", href: "/search" },
  { label: "여성", href: "/search?style=women" },
  { label: "남성", href: "/search?style=men" },
  { label: "스트릿", href: "/search?style=street" },
  { label: "미니멀", href: "/search?style=minimal" },
  { label: "캐주얼", href: "/search?style=casual" },
  { label: "러블리", href: "/search?style=lovely" },
  { label: "빈티지", href: "/search?style=vintage" },
  { label: "시크", href: "/search?style=chic" },
  { label: "스포티", href: "/search?style=sporty" },
  { label: "럭셔리", href: "/search?style=luxury" },
  { label: "에코", href: "/search?style=eco" },
  { label: "키즈", href: "/search?style=kids" },
  { label: "테크", href: "/search?style=tech" },
];

export default function StyleTabBar() {
  const [active, setActive] = useState(0);

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex overflow-x-auto scrollbar-hide">
        {TABS.map((tab, idx) => (
          <Link
            key={tab.label}
            href={tab.href}
            onClick={() => setActive(idx)}
            className={`flex-shrink-0 px-3.5 py-2.5 text-[12px] whitespace-nowrap transition-colors relative ${
              idx === active
                ? "text-gray-900 font-semibold"
                : "text-gray-400"
            }`}
          >
            {tab.label}
            {idx === active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-gray-900 rounded-full" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
