"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";

export default function ScreenshotThumbnail({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium hover:underline"
      >
        <ImageIcon size={12} /> 캡쳐
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center z-10"
            >
              <X size={16} />
            </button>
            <img
              src={src}
              alt="구독 인증 캡쳐"
              className="rounded-xl shadow-2xl max-w-[90vw] max-h-[85vh] object-contain bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
