import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminUsersTabsClient from "@/components/admin/AdminUsersTabsClient";
import { getAdminSellers } from "@/lib/adminSellers";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const [usersRaw, sellers, middleAdmins] = await Promise.all([
    prisma.user.findMany({
      include: {
        _count: { select: { orders: true, reviews: true } },
        sellerProfile: { select: { id: true, commissionRate: true } },
        accounts: { select: { provider: true } }, // 소셜 가입 제공자(카카오·네이버·구글) 판별용
      },
      orderBy: { createdAt: "desc" },
    }),
    getAdminSellers(),
    prisma.middleAdminProfile.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const users = usersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    gender: u.gender,
    birthday: u.birthday,
    role: u.role,
    isActive: u.isActive,
    orderCount: u._count.orders,
    reviewCount: u._count.reviews,
    createdAt: u.createdAt.toISOString(),
    sellerId: u.sellerProfile?.id ?? null,
    commissionRate: u.sellerProfile?.commissionRate != null ? Number(u.sellerProfile.commissionRate) : null,
    // 소셜 가입 제공자 목록(중복 제거). OAuth 계정이 없으면 이메일(비밀번호) 가입.
    authProviders: [...new Set(u.accounts.map((a) => a.provider))],
  }));

  const serializedMiddleAdmins = middleAdmins.map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <AdminUsersTabsClient
      users={users}
      sellers={sellers}
      middleAdmins={serializedMiddleAdmins}
    />
  );
}
