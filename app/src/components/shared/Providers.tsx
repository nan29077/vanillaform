"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { AppDialogProvider } from "@/components/shared/AppDialog";
import { FeatureFlagsProvider } from "@/components/shared/FeatureFlagsProvider";
import { FEATURE_DEFAULTS, type FeatureFlags } from "@/lib/featureFlags";

export default function Providers({
  children,
  flags = FEATURE_DEFAULTS,
}: {
  children: React.ReactNode;
  flags?: FeatureFlags;
}) {
  return (
    <SessionProvider>
      <FeatureFlagsProvider flags={flags}>
        <AppDialogProvider>
          {children}
        </AppDialogProvider>
      </FeatureFlagsProvider>
    </SessionProvider>
  );
}
