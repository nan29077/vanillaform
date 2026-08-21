import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NodeSettingsClient from "@/components/node/NodeSettingsClient";

export const dynamic = "force-dynamic";

export default async function NodeSettingsPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "NODE") redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    select: { name: true, email: true, avatar: true },
  });
  if (!user) redirect("/auth/login");

  return (
    <div className="animate-fade-in">
      <NodeSettingsClient
        initialName={user.name}
        initialEmail={user.email}
        initialAvatar={user.avatar}
      />
    </div>
  );
}
