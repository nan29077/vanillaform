"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useRef, useCallback, useEffect } from "react";
import {} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductImageGallery({
  images,
  productName,
}: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isScrolling.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, images.length]);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (!scrollRef.current) return;
      isScrolling.current = true;
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.clientWidth,
        behavior: "smooth",
      });
      setCurrentIndex(index);
      setTimeout(() => {
        isScrolling.current = false;
      }, 400);
    },
    []
  );

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  }, [currentIndex, images.length, scrollToIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  }, [currentIndex, scrollToIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  if (images.length === 0) {
    return (
      <div className="aspect-[2/1] bg-gray-100 flex items-center justify-center">
        <span className="text-gray-300 text-lg font-medium">{productName}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Gallery */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide snap-x snap-mandatory flex"
        style={{ WebkitOverflowScrolling: "touch" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((url, idx) => (
          <div
            key={idx}
            className="w-full flex-shrink-0 snap-center aspect-[2/1] bg-gray-50"
          >
            <SafeImage
              src={url}
              alt={`${productName} ${idx + 1}`}
              width={480}
              height={640}
              fallbackText={productName}
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>

      {/* Left/Right Arrow Navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center transition-all ${
              currentIndex === 0
                ? "opacity-0 pointer-events-none"
                : "opacity-100 hover:bg-white active:scale-95"
            }`}
            aria-label="이전 이미지"
          >
            <Icon name="ChevronDown" size={20} strokeWidth={1.5} className="text-gray-700 rotate-90" />
          </button>
          <button
            onClick={goNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center transition-all ${
              currentIndex === images.length - 1
                ? "opacity-0 pointer-events-none"
                : "opacity-100 hover:bg-white active:scale-95"
            }`}
            aria-label="다음 이미지"
          >
            <Icon name="ChevronDown" size={20} strokeWidth={1.5} className="text-gray-700 -rotate-90" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-4 h-1.5 bg-black"
                  : "w-1.5 h-1.5 bg-white/60"
              }`}
            />
          ))}
        </div>
      )}

      {/* Counter Badge */}
      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 px-4 mt-3 overflow-x-auto scrollbar-hide">
          {images.map((url, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200 ${
                idx === currentIndex
                  ? "ring-2 ring-black ring-offset-1 opacity-100"
                  : "opacity-50 hover:opacity-80"
              }`}
            >
              <SafeImage
                src={url}
                alt={`Thumb ${idx + 1}`}
                width={56}
                height={56}
                fallbackText=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
