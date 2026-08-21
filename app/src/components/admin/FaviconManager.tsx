"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function FaviconManager() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/site-config?key=site.faviconUrl")
      .then((r) => r.json())
      .then((d) => { if (d.value) setCurrentUrl(d.value); });
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("이미지 파일만 업로드 가능합니다."); return; }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) { setError("업로드에 실패했습니다."); return; }
      const data = await res.json();
      const url = data.url || data.filePath;
      if (!url) { setError("URL을 받지 못했습니다."); return; }
      // 설정 저장
      await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "site.faviconUrl", value: url }),
      });
      setCurrentUrl(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleReset() {
    if (!confirm("기본 파비콘으로 되돌리겠습니까?")) return;
    await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "site.faviconUrl", value: "" }),
    });
    setCurrentUrl(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
        {/* 현재 파비콘 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">현재 파비콘</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
              {currentUrl ? (
                <Image src={currentUrl} alt="파비콘" width={48} height={48} className="object-contain" unoptimized />
              ) : (
                <Image src="/favicon.svg" alt="기본 파비콘" width={48} height={48} className="object-contain" unoptimized />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {currentUrl ? "커스텀 파비콘 적용 중" : "기본 파비콘 사용 중"}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {currentUrl ? currentUrl.split("/").pop() : "favicon.svg"}
              </p>
            </div>
          </div>
        </div>

        {/* 업로드 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">파비콘 교체</p>
          <p className="text-[11px] text-gray-400 mb-3">PNG, ICO, SVG 형식 권장 · 32×32 또는 64×64px 최적</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            id="favicon-upload"
          />
          <label
            htmlFor="favicon-upload"
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
              uploading
                ? "border-gray-200 text-gray-300 cursor-not-allowed"
                : "border-amber-300 text-amber-600 hover:bg-amber-50"
            }`}
          >
            <Icon name="Upload" size={16} />
            {uploading ? "업로드 중..." : "이미지 선택하여 업로드"}
          </label>
        </div>

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <Icon name="Warning" size={12} /> {error}
          </p>
        )}

        {saved && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <Icon name="Check" size={12} /> 저장되었습니다. 페이지 새로고침 시 반영됩니다.
          </p>
        )}

        {currentUrl && (
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <Icon name="Close" size={12} /> 기본 파비콘으로 초기화
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-3 px-1">
        * 파비콘은 브라우저 탭, 북마크 등에 표시됩니다. 변경 후 새로고침하면 확인할 수 있습니다.
      </p>
    </div>
  );
}
