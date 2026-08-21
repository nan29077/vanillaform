"use client";

import { createContext, useContext } from "react";
import { FEATURE_DEFAULTS, type FeatureFlags } from "@/lib/featureFlags";

const FeatureFlagsContext = createContext<FeatureFlags>(FEATURE_DEFAULTS);

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: FeatureFlags;
  children: React.ReactNode;
}) {
  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// 클라이언트 컴포넌트에서 런타임 기능 토글 값을 읽습니다.
export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
