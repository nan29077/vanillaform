"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
;

interface ShopThemeColorPickerProps {
  currentColor: string;
  className?: string;
}

const PRESET_COLORS = [
  { name: "바닐라", value: "#377255" },
  { name: "핑크", value: "#ec4899" },
  { name: "로즈", value: "#f43f5e" },
  { name: "바이올렛", value: "#8b5cf6" },
  { name: "블루", value: "#3b82f6" },
  { name: "스카이", value: "#0ea5e9" },
  { name: "민트", value: "#14b8a6" },
  { name: "그린", value: "#22c55e" },
  { name: "옐로우", value: "#eab308" },
  { name: "오렌지", value: "#f97316" },
  { name: "그레이", value: "#6b7280" },
  { name: "블랙", value: "#1f2937" },
  { name: "브라운", value: "#92400e" },
];

export default function ShopThemeColorPicker({ currentColor, className = "" }: ShopThemeColorPickerProps) {
  const [selected, setSelected] = useState(currentColor || "#377255");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/sellers/shop-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopThemeColor: selected }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Color" size={18} strokeWidth={1.5} className="text-gray-500" />
        <h3 className="text-sm font-bold text-gray-900">샵 테마 색상</h3>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => setSelected(color.value)}
            className={`relative w-7 h-7 rounded-full transition-all flex-shrink-0 ${
              selected === color.value
                ? "ring-2 ring-offset-1 ring-gray-900 scale-110"
                : "hover:scale-105"
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {selected === color.value && (
              <Icon name="Check" size={10} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: selected }} />
          <input
            type="text"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input-field text-sm py-1.5 font-mono flex-1"
            placeholder="#000000"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-green-100 text-green-700"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {saving ? "저장중..." : saved ? "저장됨!" : "적용"}
        </button>
      </div>
    </div>
  );
}
