"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { AlertTriangle, CheckCircle, Info, AlertCircle, Zap } from "lucide-react";

// ─── Types ───
type DialogType = "confirm" | "alert" | "success" | "warning" | "honeybee" | "error";

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

// 사유 입력형 다이얼로그(appPrompt) 전용 옵션
interface PromptOptions extends DialogOptions {
  placeholder?: string;
  // true면 값을 입력해야만 확인 버튼이 활성화된다 (반려 사유처럼 필수 입력일 때)
  required?: boolean;
  maxLength?: number;
}

interface DialogState extends PromptOptions {
  isOpen: boolean;
  isPrompt?: boolean;
  resolve: ((value: any) => void) | null;
}

interface DialogContextType {
  appConfirm: (options: DialogOptions | string) => Promise<boolean>;
  appAlert: (options: DialogOptions | string) => Promise<boolean>;
  // 확인 시 입력값(trim), 취소 시 null 반환
  appPrompt: (options: PromptOptions | string) => Promise<string | null>;
}

// ─── Context ───
const DialogContext = createContext<DialogContextType | null>(null);

export function useAppDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useAppDialog must be used within AppDialogProvider");
  return ctx;
}

// ─── Provider ───
export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    message: "",
    resolve: null,
  });

  const resolveRef = useRef<((value: any) => void) | null>(null);
  // 입력형(appPrompt) 여부 — 닫을 때 boolean이 아닌 입력값을 돌려줘야 하므로 ref로 들고 있는다
  const isPromptRef = useRef(false);
  // 입력형 다이얼로그의 현재 입력값
  const [promptValue, setPromptValue] = useState("");

  const openDialog = useCallback((options: DialogOptions, isConfirm: boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      isPromptRef.current = false;
      setDialog({
        isOpen: true,
        ...options,
        type: options.type || (isConfirm ? "confirm" : "alert"),
        resolve,
      });
    });
  }, []);

  const appConfirm = useCallback((options: DialogOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return openDialog({ ...opts, type: opts.type || "confirm" }, true);
  }, [openDialog]);

  const appAlert = useCallback((options: DialogOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return openDialog({ ...opts, type: opts.type || "alert" }, false);
  }, [openDialog]);

  // 사유 입력 다이얼로그 — 확인 시 입력값(trim), 취소/백드롭 클릭 시 null
  const appPrompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
    const opts = typeof options === "string" ? { message: options } : options;
    setPromptValue("");
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
      isPromptRef.current = true;
      setDialog({
        isOpen: true,
        isPrompt: true,
        ...opts,
        type: opts.type || "confirm",
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (resolveRef.current) {
      // 입력형이면 boolean 대신 입력값(취소는 null)을 돌려준다
      resolveRef.current(
        isPromptRef.current ? (result ? promptValue.trim() : null) : result,
      );
      resolveRef.current = null;
    }
    isPromptRef.current = false;
    setDialog((prev) => ({ ...prev, isOpen: false, isPrompt: false, resolve: null }));
  }, [promptValue]);

  const iconConfig = {
    confirm: { icon: AlertTriangle, bgColor: "bg-amber-50", iconColor: "text-amber-500" },
    alert: { icon: Info, bgColor: "bg-amber-50", iconColor: "text-amber-500" },
    success: { icon: CheckCircle, bgColor: "bg-green-50", iconColor: "text-green-500" },
    warning: { icon: AlertTriangle, bgColor: "bg-red-50", iconColor: "text-red-500" },
    error: { icon: AlertCircle, bgColor: "bg-red-50", iconColor: "text-red-500" },
    honeybee: { icon: Zap, bgColor: "bg-amber-50", iconColor: "text-amber-500" },
  };

  const type = dialog.type || "alert";
  const config = iconConfig[type];
  const IconComponent = config.icon;
  const isPrompt = !!dialog.isPrompt;
  // 입력형은 항상 취소 버튼이 필요하므로 confirm 계열로 취급한다
  const isConfirm = isPrompt || type === "confirm" || type === "warning" || type === "error";
  const isHoneybee = type === "honeybee";
  // 필수 입력인데 아직 비어 있으면 확인 버튼 비활성화
  const promptBlocked = isPrompt && !!dialog.required && promptValue.trim().length === 0;

  return (
    <DialogContext.Provider value={{ appConfirm, appAlert, appPrompt }}>
      {children}

      {/* Dialog Overlay */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4" style={{ WebkitBackfaceVisibility: "hidden" }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
            onClick={() => handleClose(false)}
          />

          {/* Dialog Card */}
          <div className={`relative w-full max-w-[320px] rounded-2xl shadow-2xl overflow-hidden animate-[dialogIn_200ms_ease-out] ${isHoneybee ? "bg-amber-50" : "bg-white"}`}>
            {/* Top accent line */}
            <div className={`h-1.5 ${
              type === "honeybee" ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400"
              : type === "warning" || type === "error" ? "bg-gradient-to-r from-red-400 to-rose-400"
              : type === "confirm" ? "bg-gradient-to-r from-amber-400 to-orange-400"
              : type === "success" ? "bg-gradient-to-r from-green-400 to-emerald-400"
              : "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400"
            }`} />

            {/* Content */}
            <div className="px-6 pt-6 pb-2 text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${config.bgColor} flex items-center justify-center`}>
                <IconComponent size={26} className={config.iconColor} />
              </div>
              {dialog.title && (
                <h3 className={`text-[15px] font-bold mb-1.5 ${isHoneybee || type === "alert" ? "text-amber-800" : "text-gray-900"}`}>{dialog.title}</h3>
              )}
              <p className={`text-[13px] leading-relaxed whitespace-pre-line ${isHoneybee || type === "alert" ? "text-amber-700" : "text-gray-500"}`}>
                {dialog.message}
              </p>

              {/* 사유 입력 (appPrompt 전용) */}
              {isPrompt && (
                <div className="mt-4 text-left">
                  <textarea
                    autoFocus
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={dialog.placeholder || "내용을 입력해 주세요."}
                    maxLength={dialog.maxLength ?? 500}
                    rows={3}
                    className="w-full text-[13px] rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent placeholder:text-gray-300"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">
                      {dialog.required ? "필수 입력" : ""}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {promptValue.length}/{dialog.maxLength ?? 500}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className={`p-4 pt-5 ${isConfirm ? "flex gap-2.5" : ""}`}>
              {isConfirm ? (
                <>
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 py-3 text-[13px] font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all"
                  >
                    {dialog.cancelText || "취소"}
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    disabled={promptBlocked}
                    className={`flex-1 py-3 text-[13px] font-bold text-white rounded-xl active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                      type === "warning" || type === "error"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-amber-500 hover:bg-amber-600"
                    }`}
                  >
                    {dialog.confirmText || "확인"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleClose(true)}
                  className="w-full py-3 text-[13px] font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all shadow-sm"
                >
                  {dialog.confirmText || "확인"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </DialogContext.Provider>
  );
}
