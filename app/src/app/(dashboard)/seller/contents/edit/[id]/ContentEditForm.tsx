"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {X, Loader2, Hash, Save} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface ShoppingTagData {
  id: string;
  productId: string;
  productName: string;
  productThumbnail: string | null;
  imageIndex: number;
  posX: number;
  posY: number;
  label: string;
}

interface PostData {
  id: string;
  title: string;
  content: string;
  images: string[];
  category: string;
  hashtags: string[];
  isPublished: boolean;
  shoppingTags: ShoppingTagData[];
}

const CONTENT_CATEGORIES = ["패션", "뷰티", "라이프스타일", "홈리빙", "푸드", "디지털", "여행", "키즈"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGES = 10;

export default function ContentEditForm({ post }: { post: PostData }) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [category, setCategory] = useState(post.category);
  const [images, setImages] = useState<string[]>(post.images);
  const [hashtags, setHashtags] = useState<string[]>(post.hashtags);
  const [hashtagInput, setHashtagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const [uploadProgress, setUploadProgress] = useState("");

  // 단일 파일 업로드 (재시도 포함)
  const uploadSingleFile = async (file: File, retries = 2): Promise<string | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const formData = new FormData();
        formData.append("files", file, file.name || "photo.jpg");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          if (attempt < retries) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
          return null;
        }
        const data = await res.json();
        return data.urls?.[0] || null;
      } catch {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        return null;
      }
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (fileRef.current) fileRef.current.value = "";
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setUploadError(null);
    setUploadProgress("");

    try {
      const currentImages = imagesRef.current;
      const remaining = MAX_IMAGES - currentImages.length;
      if (remaining <= 0) {
        setUploadError(`최대 ${MAX_IMAGES}장까지 업로드 가능합니다`);
        return;
      }

      const fileList = Array.from(files).slice(0, remaining);
      let successCount = 0;
      const failedNames: string[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(`${i + 1}/${fileList.length} 업로드 중...`);
        const url = await uploadSingleFile(file);
        if (url) {
          setImages(prev => prev.includes(url) ? prev : [...prev, url]);
          successCount++;
        } else {
          failedNames.push(file.name || `사진 ${i + 1}`);
        }
      }

      if (successCount === 0 && failedNames.length > 0) {
        setUploadError("사진 업로드에 실패했습니다. 다시 시도해 주세요.");
      } else if (failedNames.length > 0) {
        setUploadError(`${successCount}장 성공, ${failedNames.length}장 실패`);
      }
    } catch {
      setUploadError("업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      setUploadProgress("");
      uploadingRef.current = false;
    }
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const addHashtag = () => {
    let tag = hashtagInput.trim();
    if (!tag) return;
    if (!tag.startsWith("#")) tag = "#" + tag;
    tag = tag.replace(/\s+/g, "");
    if (tag.length <= 1) return;
    if (hashtags.includes(tag)) { setHashtagInput(""); return; }
    if (hashtags.length >= 10) { appAlert("해시태그는 최대 10개까지 입력 가능합니다"); return; }
    setHashtags([...hashtags, tag]);
    setHashtagInput("");
  };

  const removeHashtag = (idx: number) => setHashtags(hashtags.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!title || images.length === 0) { appAlert("제목과 이미지는 필수입니다"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/content-posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          title,
          content,
          images,
          category: category || null,
          hashtags,
        }),
      });
      if (res.ok) {
        appAlert({ message: "수정되었습니다", type: "success" });
        router.push("/seller/contents");
        router.refresh();
      } else {
        const d = await res.json();
        appAlert({ message: d.error || "수정 실패", type: "warning" });
      }
    } catch { appAlert({ message: "오류 발생", type: "warning" }); }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-400 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} className="rotate-180" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">콘텐츠 수정</h1>
            <p className="text-xs text-gray-400">사진과 정보를 수정하세요</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || !title || images.length === 0}
          className="btn-primary text-sm flex items-center gap-1.5 !px-4 !py-2 disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          저장
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 space-y-4">
        {/* 제목 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">제목 *</label>
          <input
            type="text"
            className="input-field text-sm"
            placeholder="오늘의 스트릿 룩"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">설명</label>
          <textarea
            className="input-field h-24 resize-none text-sm"
            placeholder="착용 아이템 소개..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">카테고리</label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(category === cat ? "" : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === cat ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 해시태그 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            <Hash size={12} className="inline mr-0.5" />해시태그 ({hashtags.length}/10)
          </label>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              className="input-field flex-1 text-sm !py-2.5"
              placeholder="#봄코디 (Enter로 추가)"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === ",") { e.preventDefault(); addHashtag(); }
              }}
            />
            <button type="button" onClick={addHashtag} className="px-3 py-2 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 flex-shrink-0">
              추가
            </button>
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-medium">
                  {tag}
                  <button type="button" onClick={() => removeHashtag(idx)} className="text-brand-400 hover:text-brand-700"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 사진 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            사진 * ({images.length}/{MAX_IMAGES})
          </label>

          {uploadError && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">
              <Icon name="Warning" size={12} className="flex-shrink-0" />
              <span>{uploadError}</span>
              <button type="button" onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={10} /></button>
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
              {images.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group border border-gray-200">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {idx === 0 && (
                    <span className="absolute top-0 left-0 px-1.5 py-0.5 bg-brand-500 text-white text-[8px] rounded-br font-bold">대표</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <Icon name="Delete" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length < MAX_IMAGES && (
            <div>
              <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.avif,.raw,.cr2,.nef,.arw,.dng,.raf,.psd,.webp,.bmp,.tiff,.svg,.jfif" multiple onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => { if (!uploading) { setUploadError(null); fileRef.current?.click(); } }}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 size={18} className="animate-spin" />{uploadProgress || "업로드 중..."}</>
                ) : (
                  <><Icon name="Camera" size={18} />사진 추가 (최대 20MB)</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 쇼핑 태그 정보 (읽기 전용) */}
        {post.shoppingTags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">쇼핑 태그 ({post.shoppingTags.length}개)</label>
            <div className="space-y-1.5">
              {post.shoppingTags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {tag.productThumbnail && <img src={tag.productThumbnail} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="text-xs text-gray-700 truncate">{tag.productName}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">사진 {tag.imageIndex + 1}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">* 쇼핑 태그는 새 콘텐츠 등록 시에만 설정 가능합니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
