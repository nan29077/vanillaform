import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminPasswordForm from "@/components/admin/AdminPasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">내 계정</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          로그인 비밀번호를 변경합니다. (최고관리자 전용)
        </p>
      </div>
      <AdminPasswordForm email={session.user.email ?? ""} />
    </div>
  );
}
