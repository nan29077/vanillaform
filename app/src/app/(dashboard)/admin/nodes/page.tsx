import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickRoleAvatar } from "@/lib/defaults";
import NodeManagementClient from "./NodeManagementClient";

export const dynamic = "force-dynamic";

export default async function AdminNodesPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") redirect("/");

  const nodes = await prisma.user.findMany({
    where: { role: "NODE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      gender: true,
      createdAt: true,
      avatar: true,
    },
  });

  const serialized = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    email: n.email,
    isActive: n.isActive,
    gender: n.gender,
    createdAt: n.createdAt.toISOString(),
    avatar: n.avatar || pickRoleAvatar(n.id, "NODE"),
  }));

  return (
    <div className="animate-fade-in">
      <NodeManagementClient nodes={serialized} />
    </div>
  );
}
