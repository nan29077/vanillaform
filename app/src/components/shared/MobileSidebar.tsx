"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {Menu, X} from 'lucide-react';
import LogoutButton from "@/components/shared/LogoutButton";
import SafeImage from "@/components/shared/SafeImage";
import NotificationBell from "@/components/shared/NotificationBell";

interface NavItem {
  href: string;
  iconName: string;
  label: string;
  group?: string;
}

interface MobileSidebarProps {
  items: NavItem[];
  roleConfig: { label: string; color: string };
  user: { name?: string | null; email?: string | null; nameInitial: string; avatar?: string | null };
}

export default function MobileSidebar({ items, roleConfig, user }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Group items
  const groups: { name: string; items: NavItem[] }[] = [];
  items.forEach((item) => {
    const groupName = item.group || "";
    const existing = groups.find((g) => g.name === groupName);
    if (existing) existing.items.push(item);
    else groups.push({ name: groupName, items: [item] });
  });

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="p-1.5 -ml-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <Link href="/" className="flex items-center">
              <img src="/logo.svg" alt="바닐라폼" className="h-7 w-auto object-contain" />
            </Link>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleConfig.color}`}>
              {roleConfig.label}
            </span>
          </div>
          <div className="flex items-center">
            {/* 대시보드 알림(출금 반려 등) — /my/* 는 구매자 전용이라 "전체 보기"는 숨긴다 */}
            <NotificationBell size={18} className="text-gray-400 hover:text-gray-600" buttonClassName="p-2" allHref={null} />
            <Link href="/?main=1" className="p-2 text-gray-400 hover:text-gray-600">
              <Icon name="Home" size={18} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in Sidebar */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <img src="/logo.svg" alt="바닐라폼" className="h-7 w-auto object-contain" />
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
              <SafeImage
                src={user.avatar}
                alt={user.name || "프로필"}
                width={36}
                height={36}
                fallbackText={user.nameInitial}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group.name || gi} className={gi > 0 ? "mt-3" : ""}>
              {group.name && gi > 0 && (
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider px-3 mb-1.5">
                  {group.name}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isDashboardRoot = ["/admin", "/seller", "/brand", "/middle"].includes(item.href);
                  const isActive = isDashboardRoot
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                        isActive
                          ? "bg-brand-500 text-black font-bold"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      <Icon name={item.iconName} size={16} className={isActive ? "" : "opacity-60"} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <Link
            href="/?main=1"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Icon name="Home" size={16} strokeWidth={1.5} />
            메인으로
          </Link>
          <LogoutButton variant="sidebar" />
        </div>
      </div>
    </>
  );
}
