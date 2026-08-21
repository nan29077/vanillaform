"use client";

import { Icon } from '@/components/shared/Icon';
import { signOut } from "next-auth/react";
import Link from "next/link";
export default function MyPageBottomMenu() {
  const menuItems = [
    { href: "/my/notifications", icon: "Notification", label: "알림", action: null },
    { href: "/my/settings", icon: "Settings", label: "설정", action: null },
    { href: "#", icon: "CustomerService", label: "고객센터", action: null },
  ];

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore
    }
    window.location.href = window.location.origin + "/";
  };

  return (
    <div className="px-4">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50"
          >
            <Icon name={item.icon} size={18} className="opacity-70" />
            <span className="text-sm text-gray-700 flex-1">{item.label}</span>
            <Icon name="ChevronDown" size={16} strokeWidth={1.5} className="text-gray-300 -rotate-90" />
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-left"
        >
          <Icon name="Logout" size={18} strokeWidth={1.5} className="text-red-400" />
          <span className="text-sm text-red-500 flex-1">로그아웃</span>
          <Icon name="ChevronDown" size={16} strokeWidth={1.5} className="text-gray-300 -rotate-90" />
        </button>
      </div>
    </div>
  );
}
