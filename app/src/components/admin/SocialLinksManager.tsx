"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Save, Loader2, Instagram, Youtube, Mail} from 'lucide-react';
import type { SocialLinks } from "@/lib/featureFlags";
import { useAppDialog } from "@/components/shared/AppDialog";
import SavedPopup from "@/components/shared/SavedPopup";

export default function SocialLinksManager({ initialLinks }: { initialLinks: SocialLinks }) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [links, setLinks] = useState<SocialLinks>(initialLinks);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const handleToggle = (key: "instagramEnabled" | "youtubeEnabled" | "emailEnabled") => {
    setSaved(false);
    setLinks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUrl = (key: "instagramUrl" | "youtubeUrl" | "emailUrl", value: string) => {
    setSaved(false);
    setLinks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(links),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다");
        return;
      }
      const data = await res.json();
      setLinks(data.socialLinks);
      setSaved(true);
      setShowSavedPopup(true);
      router.refresh();
    } catch {
      await appAlert("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const socials = [
    {
      key: "instagram" as const,
      label: "인스타그램",
      icon: Instagram,
      placeholder: "https://instagram.com/...",
      color: "text-pink-500",
      bg: "bg-pink-50",
    },
    {
      key: "youtube" as const,
      label: "유튜브",
      icon: Youtube,
      placeholder: "https://youtube.com/@...",
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      key: "email" as const,
      label: "이메일 / 문의",
      icon: Mail,
      placeholder: "mailto:contact@example.com",
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ] as const;

  return (
    <div className="space-y-4">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-[11px] text-gray-400 mb-4">
          활성화된 소셜 링크만 Footer에 아이콘으로 노출됩니다. URL을 입력하지 않으면 표시되지 않습니다.
        </p>
        <div className="space-y-4">
          {socials.map(({ key, label, icon: Icon, placeholder, color, bg }) => {
            const enabledKey = `${key}Enabled` as "instagramEnabled" | "youtubeEnabled" | "emailEnabled";
            const urlKey = `${key}Url` as "instagramUrl" | "youtubeUrl" | "emailUrl";
            const isEnabled = links[enabledKey];
            return (
              <div key={key} className="rounded-xl border border-gray-100 p-3.5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className={color} strokeWidth={1.5} />
                    </span>
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => handleToggle(enabledKey)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      isEnabled ? "bg-brand-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        isEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <input
                  type="text"
                  value={links[urlKey]}
                  onChange={(e) => handleUrl(urlKey, e.target.value)}
                  placeholder={placeholder}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400/30 placeholder:text-gray-300"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          저장
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Icon name="Check" size={14} /> 저장되었습니다
          </span>
        )}
      </div>
    </div>
  )
}
