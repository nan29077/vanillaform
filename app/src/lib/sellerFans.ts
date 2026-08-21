import { prisma } from "@/lib/prisma";

// 셀러 "팬" 수 실집계.
//
// SellerProfile.totalFans 는 시드 더미값(prisma/seed.ts)이 기준선으로 남아 있고
// 레퍼럴 가입 시에만 +1 되는 비정규화 컬럼이라, 실제 관계 테이블과 어긋난다.
// (운영 예: totalFans 15,434 인데 실제 팬은 6명)
//
// 팬 관리 화면이 목록으로 보여주는 모집단과 동일하게
//   팔로워(Pick) ∪ 추천인 유입 ∪ 주력팬
// 을 buyerId 기준으로 중복 제거해 센다.
//
// includeReferred: 추천인(레퍼럴) 기능 플래그가 꺼져 있으면 팬 관리 목록도
// 추천인 유입을 빼고 보여주므로, 카운트도 같은 기준을 따르도록 한다.
export async function getSellerFanCount(
  sellerId: string,
  includeReferred = true,
): Promise<number> {
  const [followers, referred, primary] = await Promise.all([
    prisma.sellerFollower.findMany({ where: { sellerId }, select: { buyerId: true } }),
    includeReferred
      ? prisma.buyerProfile.findMany({ where: { referredBySellerId: sellerId }, select: { id: true } })
      : Promise.resolve([] as { id: string }[]),
    prisma.buyerProfile.findMany({ where: { primarySellerId: sellerId }, select: { id: true } }),
  ]);

  const buyerIds = new Set<string>();
  for (const f of followers) buyerIds.add(f.buyerId);
  for (const b of referred) buyerIds.add(b.id);
  for (const b of primary) buyerIds.add(b.id);
  return buyerIds.size;
}

// 팬 관계가 바뀐 뒤 SellerProfile.totalFans 를 실제 값으로 다시 맞춘다.
//
// 이전에는 Pick/팔로우/레퍼럴 가입마다 { increment: 1 } 을 하고 해제 시 decrement 했는데,
// totalFans 가 "이벤트 수"라서 같은 사람이 레퍼럴로 가입(+1)한 뒤 Pick(+1) 하면 2명으로
// 세어졌다. 관계가 사라졌는데 차감되지 않는 경우(탈퇴 등)도 영구히 남았다.
// (운영 예: 천송이쇼핑 totalFans 134 vs 실제 105 — 중복 26 + 잔여 3)
//
// 증분 대신 매번 실집계로 덮어쓰면 중복이 구조적으로 불가능하고, 과거에 어긋난 값도
// 다음 이벤트에서 자동으로 교정된다(self-healing).
//
// 저장 값은 기능 플래그와 무관한 전체 팬 집합을 쓴다. 플래그에 따라 다르게 보여줘야 하는
// 화면은 getSellerFanCount 를 직접 호출한다.
export async function syncSellerFanCount(sellerId: string): Promise<number> {
  const count = await getSellerFanCount(sellerId);
  await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { totalFans: count },
  });
  return count;
}
