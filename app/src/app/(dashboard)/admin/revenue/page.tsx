import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPlatformRevenue } from "@/lib/revenue";
import AdminRevenueClient from "./AdminRevenueClient";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const period = searchParams.period || "this_month";

  // 기간 필터 계산
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (period === "this_month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }
  // "all"이면 startDate/endDate = null (전체)

  const dateFilter =
    startDate && endDate
      ? { createdAt: { gte: startDate, lte: endDate } }
      : {};

  // 수익 집계는 settlement.ts 와 동일한 규칙(스냅샷 기준)으로 계산한다.
  // 셀러 몫에는 셀러 요율, 공급가(브랜드/중간관리자 몫)에는 공급자 요율을 적용하며,
  // 주문 수 제한 없이 전체를 집계한다. (lib/revenue.ts)
  const revenue = await getPlatformRevenue({ dateFilter });

  return (
    <div className="animate-fade-in">
      <AdminRevenueClient revenue={revenue} period={period} />
    </div>
  );
}
