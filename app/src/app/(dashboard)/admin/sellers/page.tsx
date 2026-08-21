import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSellersClient from "@/components/admin/AdminSellersClient";
import { getAdminSellers } from "@/lib/adminSellers";

export const dynamic = "force-dynamic";

export default async function AdminSellersPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const [serialized, middleAdmins] = await Promise.all([
    getAdminSellers(),
    prisma.middleAdminProfile.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedMiddleAdmins = middleAdmins.map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="animate-fade-in">
      <AdminSellersClient sellers={serialized} middleAdmins={serializedMiddleAdmins} />
    </div>
  );
}
