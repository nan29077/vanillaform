import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PaginatedVerificationList from "./PaginatedVerificationList";

export const dynamic = "force-dynamic";

export default async function AdminChannelVerificationsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const verifications = await prisma.channelVerification.findMany({
    include: {
      buyer: {
        include: {
          user: { select: { name: true, email: true, avatar: true } },
        },
      },
      seller: {
        select: { id: true, shopName: true, shopLogo: true, slug: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const pending = verifications.filter((v) => v.status === "PENDING");
  const approved = verifications.filter((v) => v.status === "APPROVED");
  const rejected = verifications.filter((v) => v.status === "REJECTED");

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon name="Certified" size={22} className="text-brand-500" />
          SNS구독 승인 관리
        </h1>
        <p className="text-sm text-gray-500 mt-1">구매자의 라이브 셀러 채널 구독 인증 요청을 관리합니다</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-orange-200 p-4 text-center">
          <Icon name="Clock" size={20} className="mx-auto text-orange-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{pending.length}</p>
          <p className="text-xs text-gray-500">승인 대기</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 text-center">
          <Icon name="Check" size={20} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{approved.length}</p>
          <p className="text-xs text-gray-500">승인 완료</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <Icon name="Close" size={20} className="mx-auto text-red-400 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{rejected.length}</p>
          <p className="text-xs text-gray-500">거부</p>
        </div>
      </div>

      {/* 승인 대기 목록 */}
      <div className="bg-white rounded-xl border border-orange-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-orange-100 bg-orange-50">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Clock" size={14} className="text-orange-500" />
            승인 대기 ({pending.length})
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="Check" size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">대기 중인 인증 요청이 없습니다</p>
          </div>
        ) : (
          <PaginatedVerificationList items={pending} variant="pending" />
        )}
      </div>

      {/* 처리 완료 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">처리 완료 ({approved.length + rejected.length})</h2>
        </div>
        {approved.length + rejected.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">처리된 인증 요청이 없습니다</p>
          </div>
        ) : (
          <PaginatedVerificationList items={[...approved, ...rejected]} variant="completed" />
        )}
      </div>
    </div>
  );
}
