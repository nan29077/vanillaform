"use client"

import { useEffect } from "react"

interface SaveSuccessDialogProps {
  open: boolean
  onClose: () => void
  message?: string
}

export function SaveSuccessDialog({
  open,
  onClose,
  message = "저장 되었습니다.",
}: SaveSuccessDialogProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 w-72 text-center shadow-2xl border-2 border-amber-300"
        style={{
          animation: "beePopIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 메시지 */}
        <p className="text-lg font-bold text-gray-800 mb-1">{message}</p>
        <p className="text-xs text-amber-500 mb-5">Saved successfully</p>

        {/* 확인 버튼 */}
        <button
          onClick={onClose}
          className="w-full bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors shadow-md shadow-amber-200"
        >
          확인
        </button>
      </div>

      <style>{`
        @keyframes beePopIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
