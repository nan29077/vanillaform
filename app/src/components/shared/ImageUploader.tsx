"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useRef, useCallback } from "react";
import {X, Loader2, ImagePlus} from 'lucide-react';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
  compact?: boolean;
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  label = "이미지",
  compact = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const imagesRef = useRef(images);
  imagesRef.current = images;

  // 파일 크기 제한 없음 - 모든 파일 허용

  // 단일 파일 업로드 (재시도 포함)
  const uploadSingleFile = async (file: File, retries = 2): Promise<string | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const formData = new FormData();
        formData.append("files", file, file.name || "photo.jpg");
        
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "서버 오류" }));
          console.warn(`[Upload] Server error for ${file.name}: ${errData.error} (attempt ${attempt + 1})`);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          return null;
        }

        const data = await res.json();
        if (data.urls && data.urls.length > 0) {
          return data.urls[0];
        }
        return null;
      } catch (err) {
        console.warn(`[Upload] Network error for ${file.name} (attempt ${attempt + 1}):`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ★ FileList 는 input 에 살아있는 참조라 input.value="" 하면 length 가 0 이 됩니다.
    //   먼저 실배열로 복사해 둔 뒤 input 을 초기화해야 업로드 루프가 정상 동작합니다.
    const picked = e.target.files ? Array.from(e.target.files) : [];
    if (picked.length === 0) return;

    // Reset the file input IMMEDIATELY to prevent double-fire
    const inputEl = fileRef.current;
    if (inputEl) inputEl.value = "";

    // Prevent double upload via ref
    if (uploadingRef.current) return;
    uploadingRef.current = true;

    setUploading(true);
    setError(null);
    setProgress("");

    try {
      const currentImages = imagesRef.current;
      const remaining = maxImages - currentImages.length;
      if (remaining <= 0) {
        setError(`최대 ${maxImages}장까지 업로드 가능합니다`);
        return;
      }

      const fileList = picked.slice(0, remaining);
      let successCount = 0;
      const failedNames: string[] = [];

      // 파일을 한 장씩 순차적으로 업로드 (안정성 최우선)
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setProgress(`${i + 1}/${fileList.length} 업로드 중...`);

        const url = await uploadSingleFile(file);
        if (url) {
          const latestImages = imagesRef.current;
          if (!latestImages.includes(url)) {
            onChange([...latestImages, url]);
          }
          successCount++;
        } else {
          failedNames.push(file.name || `사진 ${i + 1}`);
        }
      }

      if (successCount === 0 && failedNames.length > 0) {
        setError("사진 업로드에 실패했습니다. 다시 시도해 주세요.");
      } else if (failedNames.length > 0) {
        setError(`${successCount}장 성공, ${failedNames.length}장 실패`);
      }
    } catch (err) {
      setError("업로드 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
      setProgress("");
      uploadingRef.current = false;
    }
  }, [maxImages, onChange]);

  const addUrl = () => {
    const url = urlInput.trim();
    if (url && images.length < maxImages) {
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
        if (images.includes(url)) {
          setError("이미 추가된 이미지입니다");
          return;
        }
        onChange([...images, url]);
        setUrlInput("");
        setError(null);
      } else {
        setError("올바른 URL을 입력해주세요 (http:// 또는 https://)");
      }
    }
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
    setError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-600">
          {label} ({images.length}/{maxImages})
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setMode("file"); setError(null); }}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              mode === "file" 
                ? "bg-gray-900 text-white" 
                : "bg-gray-100 text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon name="Upload" size={9} className="inline mr-0.5" />파일
          </button>
          <button
            type="button"
            onClick={() => { setMode("url"); setError(null); }}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              mode === "url" 
                ? "bg-gray-900 text-white" 
                : "bg-gray-100 text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon name="LinkShorten_icon" size={9} className="inline mr-0.5" />URL
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">
          <Icon name="Warning" size={12} className="flex-shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={10} />
          </button>
        </div>
      )}

      {/* 이미지 미리보기 - 모바일 최적화 */}
      {images.length > 0 && (
        <div className={`flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide ${compact ? "" : "flex-wrap"}`}>
          {images.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 group border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {idx === 0 && (
                <span className="absolute top-0 left-0 px-1 py-0.5 bg-brand-500 text-white text-[7px] rounded-br font-bold">대표</span>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      {images.length < maxImages && (
        mode === "url" ? (
          <div className="flex gap-1.5">
            <input
              type="url"
              className="input-field flex-1 text-sm !py-2 !px-3"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
            />
            <button type="button" onClick={addUrl} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0">
              추가
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.heic,.heif,.raw,.cr2,.nef,.arw,.dng,.webp,.avif,.svg,.bmp,.tiff,.gif"
              multiple
              capture={undefined}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (!uploading) {
                  setError(null);
                  fileRef.current?.click();
                }
              }}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors active:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {progress || "업로드 중..."}
                </>
              ) : (
                <>
                  <Icon name="Camera" size={16} />
                  사진 추가
                </>
              )}
            </button>
          </div>
        )
      )}
    </div>
  );
}
