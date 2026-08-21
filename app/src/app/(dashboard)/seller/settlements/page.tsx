import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerSettlementSummary, getPlatformFees } from "@/lib/settlement";
import { getPayoutFeeRate } from "@/lib/settings";
import SellerSettlementClient from "@/components/seller/SellerSettlementClient";

export const dynamic = "force-dynamic";

export default async function SellerSettlementsPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/auth/login");
  }
  if (session?.user?.role !== "SELLER") redirect("/");

  let seller;
  try {
    seller = await prisma.sellerProfile.findUnique({
      where: { userId: session!.user!.id },
      // 정산 계좌는 SellerProfile이 아니라 User에 저장된다(설정 > 정산 계좌)
      include: {
        user: { select: { bankName: true, bankAccount: true, bankHolder: true } },
      },
    });
  } catch {
    redirect("/");
  }
  if (!seller) redirect("/");

  // 주문 데이터에서 영업일+N 규칙으로 정산 가능/예정 금액을 집계 (역할별 플랫폼 수수료 반영)
  const [fees, payoutFeeRate] = await Promise.all([getPlatformFees(), getPayoutFeeRate()]);
  const summary = await getSellerSettlementSummary(seller.id, fees);

  return (
    <div className="animate-fade-in">
      <SellerSettlementClient
        summary={summary}
        shopName={seller.shopName}
        defaultAccountHolder={seller.user.bankHolder || seller.representativeName || seller.shopName}
        defaultIsBusiness={seller.isBusinessOperator || seller.businessType === "business"}
        defaultCompanyName={seller.shopName}
        defaultBizNumber={seller.businessRegistrationNo || ""}
        defaultBankName={seller.user.bankName || ""}
        defaultAccountNumber={seller.user.bankAccount || ""}
        payoutFeeRate={payoutFeeRate}
      />
    </div>
  );
}
