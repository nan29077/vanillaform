import { ImageIcon } from "lucide-react";

interface AvatarPickerProps {
  currentAvatar?: string | null;
}

export default function AvatarPicker({ currentAvatar }: AvatarPickerProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-800">프로필 아바타</p>
      </div>

      {/* 현재 아바타 미리보기 + 안내 문구 */}
      <div className="flex items-center gap-3 px-4 py-4">
        {currentAvatar ? (
          <img
            src={currentAvatar}
            alt="프로필 아바타"
            className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-200 ring-offset-2 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center ring-2 ring-gray-200 ring-offset-2 flex-shrink-0">
            <ImageIcon size={22} strokeWidth={1.5} className="text-gray-400" />
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-gray-700">가입 시 자동 부여된 아바타입니다.</p>
          <p className="text-[11px] text-gray-400 mt-0.5">프로필 사진을 업로드하면 변경됩니다.</p>
        </div>
      </div>
    </div>
  );
}
