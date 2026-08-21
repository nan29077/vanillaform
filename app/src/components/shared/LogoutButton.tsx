"use client";

import { Icon } from '@/components/shared/Icon';
import { signOut } from "next-auth/react";
;

interface LogoutButtonProps {
  variant?: "sidebar" | "mobile" | "icon";
  className?: string;
}

export default function LogoutButton({ variant = "sidebar", className = "" }: LogoutButtonProps) {
  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = window.location.origin + "/";
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleLogout}
        className={`p-2 text-gray-400 hover:text-red-500 transition-colors ${className}`}
        title="로그아웃"
      >
        <Icon name="Logout" size={18} strokeWidth={1.5} />
      </button>
    );
  }

  if (variant === "mobile") {
    return (
      <button
        onClick={handleLogout}
        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition-colors ${className}`}
      >
        로그아웃
      </button>
    );
  }

  // sidebar variant
  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-2 px-3 py-2 mt-1 text-xs text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors w-full ${className}`}
    >
      <Icon name="Logout" size={14} strokeWidth={1.5} />
      로그아웃
    </button>
  );
}
