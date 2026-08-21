import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getFeatureFlags, getSettlementBusinessDays, getMiddleSettleDays, getBrandSettleDays,
  getRegisterFieldSettings,
  DEFAULT_SETTLEMENT_BUSINESS_DAYS,
} from "@/lib/settings";
import FeatureSettingsForm from "@/components/admin/FeatureSettingsForm";
import PlatformFeeSettingsForm from "@/components/admin/PlatformFeeSettingsForm";
import RegisterFieldSettingsForm from "@/components/admin/RegisterFieldSettingsForm";
import SettingsTabs from "@/components/admin/SettingsTabs";
import { getPlatformFees } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  const [flags, settlementBusinessDays, middleSettleDays, brandSettleDays, fees, registerFields] = await Promise.all([
    getFeatureFlags(),
    getSettlementBusinessDays(),
    getMiddleSettleDays(),
    getBrandSettleDays(),
    getPlatformFees(),
    getRegisterFieldSettings(),
  ]);

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">권한 설정</h1>
        <p className="text-xs text-gray-400 mt-0.5">주요 기능을 켜고 끄거나 정산일을 설정합니다. (최고관리자 전용)</p>
      </div>
      <SettingsTabs
        feeForm={<PlatformFeeSettingsForm initialFees={fees} />}
        featureForm={
          <FeatureSettingsForm
            initialFlags={flags}
            initialSettlementDays={settlementBusinessDays}
            initialMiddleSettleDays={middleSettleDays}
            initialBrandSettleDays={brandSettleDays}
            defaultSettlementDays={DEFAULT_SETTLEMENT_BUSINESS_DAYS}
          />
        }
        registerForm={<RegisterFieldSettingsForm initialFields={registerFields} />}
      />
    </div>
  );
}
