"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 공용 페이지네이션 컴포넌트.
 * 리스트를 페이지당 일정 개수(기본 20개)로 나눠 보여줄 때 사용한다.
 *
 * - 순수 표현용 컴포넌트: 현재 페이지 상태는 부모가 관리한다.
 * - 클라이언트 슬라이싱 방식이 필요하면 아래 usePagination 훅을 함께 사용한다.
 */
export interface PaginationProps {
  currentPage: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// 표시할 페이지 번호 목록 계산 (양 끝 + 현재 주변 + 말줄임표)
function buildPageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  items.push(1);
  if (left > 2) items.push("...");
  for (let p = left; p <= right; p++) items.push(p);
  if (right < total - 1) items.push("...");
  items.push(total);

  return items;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageItems = buildPageItems(currentPage, totalPages);
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <nav
      className={`flex items-center justify-center gap-1 py-4 select-none ${className}`}
      aria-label="페이지네이션"
    >
      <button
        type="button"
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        aria-label="이전 페이지"
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ChevronLeft size={16} />
      </button>

      {pageItems.map((item, idx) =>
        item === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex items-center justify-center w-9 h-9 text-gray-400 text-sm"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={`flex items-center justify-center min-w-9 h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
              item === currentPage
                ? "bg-gray-900 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => canNext && onPageChange(currentPage + 1)}
        disabled={!canNext}
        aria-label="다음 페이지"
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

/**
 * 클라이언트 슬라이싱 페이지네이션 훅.
 * 이미 전체 배열을 들고 있는 클라이언트 컴포넌트에서 페이지당 pageSize개씩 잘라 보여줄 때 사용.
 *
 * @example
 * const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);
 * // pageItems 를 map 으로 렌더링하고, 하단에 <Pagination .../> 렌더
 */
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // 목록 길이가 줄어 현재 페이지가 범위를 벗어나면 보정
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    pageItems,
    page: safePage,
    setPage,
    totalPages,
    pageSize,
    totalCount: items.length,
  };
}
