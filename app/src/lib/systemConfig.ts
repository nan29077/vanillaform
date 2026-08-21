// 시스템 전역 스위치(SystemConfig) 서버 전용 액세스 레이어.
// - 노드(NODE) 시스템 ON/OFF 스위치(nodeEnabled)를 DB(SystemConfig id=1)에서 읽고 씁니다.
// - sellerOnlyFee: true 이면 플랫폼 수수료 전액을 셀러가 부담 (공급자 수수료 없음).
// - prisma 를 import 하므로 서버 컴포넌트 / route handler 에서만 사용하세요.

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const DEFAULT_NODE_ENABLED = true;
export const DEFAULT_SELLER_ONLY_FEE = false;

// 단일 레코드(id=1) 를 보장하며 조회. 없으면 기본값으로 생성.
async function getOrCreateConfig() {
  return (prisma as any).systemConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nodeEnabled: DEFAULT_NODE_ENABLED, sellerOnlyFee: DEFAULT_SELLER_ONLY_FEE },
  });
}

// 한 요청 안에서 조회 1회로 묶음(React cache).
export const getNodeEnabled = cache(async (): Promise<boolean> => {
  try {
    const cfg = await getOrCreateConfig();
    return cfg.nodeEnabled;
  } catch {
    return DEFAULT_NODE_ENABLED;
  }
});

// sellerOnlyFee 조회 (React cache — 요청당 1회)
export const getSellerOnlyFee = cache(async (): Promise<boolean> => {
  try {
        const cfg = await getOrCreateConfig();
    return cfg.sellerOnlyFee;
  } catch {
    return DEFAULT_SELLER_ONLY_FEE;
  }
});

export async function setNodeEnabled(value: boolean): Promise<boolean> {
  await (prisma as any).systemConfig.upsert({
    where: { id: 1 },
    update: { nodeEnabled: value },
    create: { id: 1, nodeEnabled: value, sellerOnlyFee: DEFAULT_SELLER_ONLY_FEE },
  });
  return value;
}

export async function setSellerOnlyFee(value: boolean): Promise<boolean> {
  await (prisma as any).systemConfig.upsert({
    where: { id: 1 },
    update: { sellerOnlyFee: value },
    create: { id: 1, nodeEnabled: DEFAULT_NODE_ENABLED, sellerOnlyFee: value },
  });
  return value;
}
