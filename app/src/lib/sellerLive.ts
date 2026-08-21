// 셀러 라이브 상태 판정 + 프로필 이미지 헬퍼 (서버/클라이언트 공용, prisma import 없음).
//
// 라이브 판정 우선순위:
//   1) 라이브 커머스 실제 방송 중 (status="LIVE" 라이브스트림 존재)
//   2) 샵 관리 "라이브 중 표시" 수동 스위치 (isManualLive)
//   → 둘 중 하나라도 true 이면 LIVE.

type LiveInput = {
  isManualLive?: boolean | null;
  liveStreams?: { id: string }[] | null;
};

export function isSellerLive(s: LiveInput | null | undefined): boolean {
  if (!s) return false;
  return !!s.isManualLive || (s.liveStreams?.length ?? 0) > 0;
}

type ImageInput = {
  shopLogo?: string | null;
  user?: { avatar?: string | null } | null;
};

// 실제 셀러 프로필 사진: 샵 로고 우선, 없으면 회원(성별 기반) 아바타.
export function sellerProfileImage(s: ImageInput | null | undefined): string | null {
  if (!s) return null;
  return s.shopLogo || s.user?.avatar || null;
}
