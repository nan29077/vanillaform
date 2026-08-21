"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useRef, useCallback } from "react";
import {X, Loader2, Sparkles, Hash, Upload, Image as ImageIcon} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface Product { id: string; name: string; thumbnail: string | null; basePrice: number; }
interface ShoppingTagData {
  productId: string; productName: string; productThumbnail: string | null;
  imageIndex: number; posX: number; posY: number; label: string;
}

export default function ContentPostForm() {
    const { appConfirm, appAlert } = useAppDialog();
const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [shoppingTags, setShoppingTags] = useState<ShoppingTagData[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [showTagMode, setShowTagMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pendingTag, setPendingTag] = useState<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState<"info" | "tag">("info");
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

  // Image upload states - completely new approach
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_IMAGES = 10;

  useEffect(() => {
    if (showForm) {
      fetch("/api/seller/available-products")
        .then(r => r.json())
        .then(d => setProducts(d.products || []))
        .catch(() => {});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  // Upload a single file with retries - completely rewritten for reliability
  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Create a fresh FormData for each attempt
        const fd = new FormData();
        // Use 'files' key as expected by the upload API
        fd.append("files", file);
        
        const response = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          // Do NOT set Content-Type header - browser will auto-set with boundary
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[ContentUpload] Attempt ${attempt + 1} failed:`, response.status, errorData);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          return null;
        }

        const data = await response.json();

        if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
          return data.urls[0];
        }
        
        console.error("[ContentUpload] No URLs in response:", data);
        return null;
      } catch (error) {
        console.error(`[ContentUpload] Attempt ${attempt + 1} error:`, error);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  }, []);

  // Handle file selection - completely rewritten
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Immediately clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Prevent concurrent uploads
    if (uploading) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress("");

    try {
      // Get current image count at this moment
      const currentCount = images.length;
      const remaining = MAX_IMAGES - currentCount;
      
      if (remaining <= 0) {
        setUploadError(`최대 ${MAX_IMAGES}장까지 업로드 가능합니다`);
        setUploading(false);
        return;
      }

      // Convert FileList to array and limit
      const files = Array.from(fileList).slice(0, remaining);
      
      // Validate files first
      const validFiles: File[] = [];
      for (const file of files) {
        if (file.size === 0) {
          console.warn("[ContentUpload] Skipping empty file:", file.name);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setUploadError(`${file.name}: 파일 크기가 20MB를 초과합니다`);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        setUploadError("유효한 이미지 파일이 없습니다");
        setUploading(false);
        return;
      }

      const uploadedUrls: string[] = [];
      const failedFiles: string[] = [];

      // Upload one by one
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress(`${i + 1}/${validFiles.length} 업로드 중...`);
        
        const url = await uploadFile(file);
        
        if (url) {
          uploadedUrls.push(url);
          // Update images state immediately after each successful upload
          setImages(prev => {
            // Prevent duplicates
            if (prev.includes(url)) return prev;
            return [...prev, url];
          });
        } else {
          failedFiles.push(file.name);
        }
      }

      // Show result
      if (uploadedUrls.length === 0 && failedFiles.length > 0) {
        setUploadError("이미지 업로드에 실패했습니다. 다시 시도해 주세요.");
      } else if (failedFiles.length > 0) {
        setUploadError(`${uploadedUrls.length}장 성공, ${failedFiles.length}장 실패`);
      } else {
        // All successful - clear any previous error
        setUploadError(null);
      }
    } catch (err) {
      console.error("[ContentUpload] Unexpected error:", err);
      setUploadError("업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }, [images.length, uploading, uploadFile]);

  const removeImage = (idx: number) => {
    const newImgs = images.filter((_, i) => i !== idx);
    setImages(newImgs);
    setShoppingTags(shoppingTags.filter(t => t.imageIndex !== idx).map(t => t.imageIndex > idx ? { ...t, imageIndex: t.imageIndex - 1 } : t));
    if (activeImageIdx >= newImgs.length) setActiveImageIdx(Math.max(0, newImgs.length - 1));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTagMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingTag({ x, y }); setShowProductPicker(true); setProductSearch("");
  };

  const handleImageTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!showTagMode) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    setPendingTag({ x, y }); setShowProductPicker(true); setProductSearch("");
  };

  const selectProductForTag = (product: Product) => {
    if (!pendingTag) return;
    setShoppingTags([...shoppingTags, {
      productId: product.id, productName: product.name, productThumbnail: product.thumbnail,
      imageIndex: activeImageIdx, posX: pendingTag.x, posY: pendingTag.y, label: product.name,
    }]);
    setPendingTag(null); setShowProductPicker(false); setProductSearch("");
  };

  const removeTag = (idx: number) => setShoppingTags(shoppingTags.filter((_, i) => i !== idx));
  const currentImageTags = shoppingTags.filter(t => t.imageIndex === activeImageIdx);
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const CONTENT_CATEGORIES = ["패션", "뷰티", "라이프스타일", "홈리빙", "푸드", "디지털", "여행", "키즈"];

  const addHashtag = () => {
    let tag = hashtagInput.trim();
    if (!tag) return;
    if (!tag.startsWith("#")) tag = "#" + tag;
    tag = tag.replace(/\s+/g, "");
    if (tag.length <= 1) return;
    if (hashtags.includes(tag)) { setHashtagInput(""); return; }
    if (hashtags.length >= 10) { appAlert("해시태그는 최대 10개까지 입력 가능합니다"); return; }
    setHashtags([...hashtags, tag]); setHashtagInput("");
  };
  const removeHashtag = (idx: number) => setHashtags(hashtags.filter((_, i) => i !== idx));
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") { e.preventDefault(); addHashtag(); }
  };

  const handleSubmit = async () => {
    if (!title || images.length === 0) { appAlert("제목과 이미지를 입력해 주세요"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/content-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, content, images, category: category || null,
          hashtags: hashtags.length > 0 ? hashtags : [],
          shoppingTags: shoppingTags.map(t => ({ productId: t.productId, imageIndex: t.imageIndex, posX: t.posX, posY: t.posY, label: t.label })),
          isPublished: true,
        }),
      });
      if (res.ok) { reset(); window.location.reload(); }
      else { const d = await res.json(); await appAlert(d.error || "등록 실패"); }
    } catch { appAlert("오류 발생"); }
    setLoading(false);
  };

  const reset = () => {
    setShowForm(false); setTitle(""); setContent(""); setCategory(""); setImages([]); setShoppingTags([]);
    setStep("info"); setShowTagMode(false); setPendingTag(null); setShowProductPicker(false);
    setHashtags([]); setHashtagInput(""); setUploadError(null); setUploadProgress("");
  };

  return (
    <>
      <button onClick={() => setShowForm(true)} className="btn-outline text-sm flex items-center gap-1.5 !px-3 !py-2 sm:!px-4 sm:!py-2.5 whitespace-nowrap">
        <Sparkles size={14} /> <span>콘텐츠 등록</span>
      </button>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={reset} />

          {/* Modal Container */}
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:mx-4 bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
            
            {/* Header - clean, minimal */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={step === "tag" ? () => setStep("info") : reset}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <Icon name="ChevronDown" size={20} className="rotate-90" />
                </button>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {step === "info" ? "새 콘텐츠" : "쇼핑 태그"}
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                    {step === "info" ? "사진과 정보를 입력하세요" : "상품을 사진에 태그하세요"}
                  </p>
                </div>
              </div>
              <button onClick={reset} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 px-4 sm:px-5 py-2 bg-gray-50/80 border-b border-gray-100 flex-shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${step === "info" ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">1</span>
                정보 입력
              </div>
              <div className="w-6 h-px bg-gray-200 mx-1" />
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${step === "tag" ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">2</span>
                쇼핑 태그
              </div>
            </div>

            {/* Body - scrollable with proper spacing */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
              {step === "info" ? (
                <div className="p-4 sm:p-5 space-y-5 pb-6">
                  
                  {/* 사진 업로드 - moved to top for emphasis */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-2">
                      <Icon name="Camera" size={13} className="text-brand-500" />
                      사진 <span className="text-brand-500">*</span>
                      <span className="text-gray-400 font-normal ml-auto">{images.length}/{MAX_IMAGES}</span>
                    </label>

                    {uploadError && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                        <Icon name="Warning" size={14} className="flex-shrink-0" />
                        <span className="flex-1">{uploadError}</span>
                        <button type="button" onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 p-0.5">
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {/* Image preview grid */}
                    {images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {images.map((url, idx) => (
                          <div key={`img-${idx}-${url.slice(-10)}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group border border-gray-200 hover:border-brand-300 transition-colors">
                            <img 
                              src={url} 
                              alt={`사진 ${idx + 1}`} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                el.style.display = "none";
                              }}
                            />
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-brand-500 text-white text-[8px] rounded-md font-bold">대표</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload button */}
                    {images.length < MAX_IMAGES && (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff,image/svg+xml,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.bmp,.tiff,.svg,.jfif"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!uploading && fileInputRef.current) {
                              setUploadError(null);
                              fileInputRef.current.click();
                            }
                          }}
                          disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/30 transition-all active:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploading ? (
                            <>
                              <Loader2 size={18} className="animate-spin text-brand-500" />
                              <span className="text-brand-600 font-medium">{uploadProgress || "업로드 중..."}</span>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <Icon name="Camera" size={16} className="text-gray-400" />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-medium text-gray-600">사진 추가</p>
                                <p className="text-[10px] text-gray-400">최대 {MAX_FILE_SIZE / 1024 / 1024}MB, {MAX_IMAGES}장</p>
                              </div>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 제목 */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-2">
                      제목 <span className="text-brand-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder-gray-400"
                      placeholder="오늘의 스트릿 룩"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>

                  {/* 설명 */}
                  <div>
                    <label className="text-xs font-bold text-gray-800 mb-2 block">설명</label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 h-24 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder-gray-400"
                      placeholder="착용 아이템 소개, 스타일링 팁 등..."
                      value={content}
                      onChange={e => setContent(e.target.value)}
                    />
                  </div>

                  {/* 카테고리 */}
                  <div>
                    <label className="text-xs font-bold text-gray-800 mb-2 block">카테고리</label>
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(category === cat ? "" : cat)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                            category === cat
                              ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 해시태그 */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-2">
                      <Hash size={12} className="text-gray-400" />
                      해시태그
                      <span className="text-gray-400 font-normal ml-auto">{hashtags.length}/10</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder-gray-400"
                        placeholder="#봄코디 (Enter로 추가)"
                        value={hashtagInput}
                        onChange={(e) => setHashtagInput(e.target.value)}
                        onKeyDown={handleHashtagKeyDown}
                      />
                      <button
                        type="button"
                        onClick={addHashtag}
                        className="px-4 py-2.5 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors flex-shrink-0"
                      >
                        추가
                      </button>
                    </div>
                    {hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {hashtags.map((tag, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-xl text-xs font-medium border border-brand-100">
                            {tag}
                            <button type="button" onClick={() => removeHashtag(idx)} className="text-brand-400 hover:text-brand-700 ml-0.5">
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Step 2: Shopping Tags */
                <div className="p-4 sm:p-5 space-y-4 pb-6">
                  {/* Image thumbnails */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {images.map((url, idx) => (
                      <button key={idx} onClick={() => setActiveImageIdx(idx)}
                        className={`relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${activeImageIdx === idx ? "border-brand-500 shadow-md scale-105" : "border-gray-200 hover:border-gray-300"}`}>
                        <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23f3f4f6'/%3E%3C/svg%3E"; }} />
                        {shoppingTags.filter(t => t.imageIndex === idx).length > 0 && (
                          <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-brand-500 text-white text-[8px] flex items-center justify-center font-bold shadow-sm">
                            {shoppingTags.filter(t => t.imageIndex === idx).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tag mode toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">사진 {activeImageIdx + 1}/{images.length}</p>
                    <button onClick={() => { setShowTagMode(!showTagMode); setShowProductPicker(false); setPendingTag(null); }}
                      className={`text-xs px-4 py-2 rounded-xl font-medium transition-all ${showTagMode ? "bg-brand-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      <Icon name="Tag" size={11} className="inline mr-1.5" />{showTagMode ? "태그 모드 ON" : "태그 추가"}
                    </button>
                  </div>

                  {showTagMode && !showProductPicker && (
                    <div className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 rounded-xl px-4 py-3 border border-brand-100">
                      <Icon name="Location" size={14} className="flex-shrink-0" />
                      <span>사진을 터치하면 해당 위치에 상품 태그를 추가합니다</span>
                    </div>
                  )}

                  {/* Main image with tags */}
                  <div ref={imageContainerRef}
                    className={`relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] max-h-[45vh] ${showTagMode ? "cursor-crosshair ring-2 ring-brand-200" : ""}`}
                    onClick={handleImageClick}
                    onTouchEnd={showTagMode ? handleImageTouch : undefined}>
                    <img src={images[activeImageIdx]} alt="Content" className="w-full h-full object-cover" />
                    {currentImageTags.map((tag, idx) => (
                      <div key={idx} className="absolute group" style={{ left: `${tag.posX}%`, top: `${tag.posY}%`, transform: "translate(-50%, -50%)" }}>
                        <div className="w-7 h-7 rounded-full bg-white/90 shadow-lg flex items-center justify-center border-2 border-brand-500">
                          <Icon name="Cart" size={11} className="text-brand-600" />
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-black/80 text-white text-[9px] px-2.5 py-1 rounded-lg whitespace-nowrap max-w-[120px] truncate shadow-lg">
                          {tag.productName}
                        </div>
                      </div>
                    ))}
                    {pendingTag && (
                      <div className="absolute w-8 h-8 rounded-full bg-brand-500/30 border-2 border-brand-500 animate-pulse"
                        style={{ left: `${pendingTag.x}%`, top: `${pendingTag.y}%`, transform: "translate(-50%, -50%)" }} />
                    )}
                    {images.length > 1 && (<>
                      <button onClick={e => { e.stopPropagation(); setActiveImageIdx(Math.max(0, activeImageIdx - 1)); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 backdrop-blur-sm">
                        <Icon name="ChevronDown" size={18} className="rotate-90" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setActiveImageIdx(Math.min(images.length - 1, activeImageIdx + 1)); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 backdrop-blur-sm">
                        <Icon name="ChevronDown" size={18} className="-rotate-90" />
                      </button>
                    </>)}
                  </div>

                  {/* Product picker */}
                  {showProductPicker && pendingTag && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Icon name="Search" size={14} className="text-gray-400 flex-shrink-0" />
                        <input type="text" className="w-full text-sm bg-transparent outline-none placeholder-gray-400"
                          placeholder="상품 검색..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus />
                      </div>
                      <div className="max-h-44 overflow-y-auto overscroll-contain">
                        {filteredProducts.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-6">등록된 상품이 없습니다</p>
                        ) : filteredProducts.slice(0, 10).map(p => (
                          <button key={p.id} onClick={() => selectProductForTag(p)}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 active:bg-gray-100 text-left transition-colors border-b border-gray-50 last:border-0">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                              {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="w-full h-full p-2 text-gray-300" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{formatPrice(p.basePrice)}</p>
                            </div>
                            <Icon name="Plus" size={16} className="text-brand-500 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setPendingTag(null); setShowProductPicker(false); }}
                        className="w-full px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100 text-center hover:bg-gray-50 transition-colors font-medium">취소</button>
                    </div>
                  )}

                  {/* Tag list */}
                  {shoppingTags.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-bold">쇼핑 태그 ({shoppingTags.length})</p>
                      {shoppingTags.map((tag, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                            {tag.productThumbnail ? <img src={tag.productThumbnail} alt="" className="w-full h-full object-cover" /> : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{tag.productName}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">사진 {tag.imageIndex + 1}</p>
                          </div>
                          <button onClick={() => removeTag(idx)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-full transition-colors"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer - fixed bottom with proper spacing */}
            <div className="flex-shrink-0 px-4 sm:px-5 py-3.5 border-t border-gray-100 bg-white" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}>
              {step === "info" ? (
                <div className="flex gap-3">
                  <button onClick={reset}
                    className="flex-1 py-3 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    취소
                  </button>
                  <button
                    onClick={() => images.length > 0 && title ? setStep("tag") : appAlert(!title ? "제목을 입력하세요" : "사진을 추가하세요")}
                    disabled={!title || images.length === 0}
                    className="flex-[2] py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    다음
                    <Icon name="ChevronDown" size={15} className="-rotate-90" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setStep("info")}
                    className="py-3 px-5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    이전
                  </button>
                  <button onClick={handleSubmit} disabled={loading || !title}
                    className="flex-1 py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" />등록 중...</>
                    ) : (
                      <><Icon name="Check" size={15} />콘텐츠 등록{shoppingTags.length > 0 ? ` (태그 ${shoppingTags.length}개)` : ""}</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
