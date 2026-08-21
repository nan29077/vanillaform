import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminAlimtalkClient from "./AdminAlimtalkClient";

export default async function AdminAlimtalkPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "MIDDLE_ADMIN") redirect("/admin");
  return <AdminAlimtalkClient />;
}
