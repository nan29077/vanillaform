import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminTaxClient, { type TaxRecord } from "@/components/admin/AdminTaxClient";

export const dynamic = "force-dynamic";

// 세무 관리 — 회원별 출금(지급) 완료 내역을 원천징수/부가세 관점으로 집계
export default async function AdminTaxPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") redirect("/");

  // ── 셀러 출금 (지급완료된 PayoutRequest) ──
  let payouts: any[] = [];
  try {
    payouts = await prisma.payoutRequest.findMany({
      where: { status: "PAID" },
      include: {
        seller: {
          select: {
            shopName: true,
            representativeName: true,
            businessRegistrationNo: true,
          },
        },
      },
      orderBy: { processedAt: "desc" },
    });
  } catch {
    // ignore
  }

  const sellerBusiness: TaxRecord[] = [];
  const sellerNonBusiness: TaxRecord[] = [];
  for (const p of payouts) {
    const rec: TaxRecord = {
      id: p.id,
      name: p.companyName || p.seller?.shopName || "라이브 셀러",
      bizNumber: p.bizNumber || p.seller?.businessRegistrationNo || "",
      repName: p.seller?.representativeName || p.accountHolder || "",
      amount: Number(p.amount),
      date: (p.processedAt ?? p.updatedAt ?? p.requestedAt).toISOString(),
    };
    if (p.isBusiness) sellerBusiness.push(rec);
    else sellerNonBusiness.push(rec);
  }

  // ── 브랜드 정산 (지급완료된 BrandSettlement) ──
  let brands: TaxRecord[] = [];
  try {
    const rows = await (prisma as any).brandSettlement.findMany({
      where: { isPaid: true },
      include: {
        brand: {
          select: {
            brandName: true,
            representativeName: true,
            businessRegistrationNo: true,
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });
    brands = rows.map((s: any) => ({
      id: s.id,
      name: s.brand?.brandName || "브랜드",
      bizNumber: s.brand?.businessRegistrationNo || "",
      repName: s.brand?.representativeName || "",
      amount: Number(s.totalSupply),
      date: (s.paidAt ?? s.updatedAt ?? s.createdAt).toISOString(),
    }));
  } catch {
    // ignore
  }

  // ── 중간관리자 정산 (지급완료된 MiddleAdminSettlement) ──
  let middleAdmins: TaxRecord[] = [];
  try {
    const rows = await (prisma as any).middleAdminSettlement.findMany({
      where: { status: "PAID" },
      include: {
        middleAdmin: {
          select: { name: true, companyName: true, bizNumber: true },
        },
      },
      orderBy: { paidAt: "desc" },
    });
    middleAdmins = rows.map((s: any) => ({
      id: s.id,
      name: s.middleAdmin?.companyName || s.middleAdmin?.name || "중간관리자",
      bizNumber: s.middleAdmin?.bizNumber || "",
      repName: s.middleAdmin?.name || "",
      amount: Number(s.settlementAmount),
      date: (s.paidAt ?? s.updatedAt ?? s.createdAt).toISOString(),
    }));
  } catch {
    // ignore
  }

  return (
    <div className="animate-fade-in">
      <AdminTaxClient
        sellerBusiness={sellerBusiness}
        sellerNonBusiness={sellerNonBusiness}
        brands={brands}
        middleAdmins={middleAdmins}
      />
    </div>
  );
}
