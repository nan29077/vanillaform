import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/shared/Providers";
import NavigationProgress from "@/components/shared/NavigationProgress";
import { getFeatureFlags } from "@/lib/settings";
import ThemeEffect from "@/components/shared/ThemeEffect";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "바닐라폼",
  description: "취향과 사람을 연결하는 바닐라폼 커머스 플랫폼",
  keywords: ["바닐라폼", "공동구매", "라이브커머스", "셀러", "커머스"],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "바닐라폼 | 취향을 연결하는 커머스 플랫폼",
    description: "취향과 사람을 연결하는 바닐라폼 커머스 플랫폼",
    siteName: "바닐라폼",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "바닐라폼 | 취향을 연결하는 커머스 플랫폼",
    description: "취향과 사람을 연결하는 바닐라폼 커머스 플랫폼",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await getFeatureFlags();
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <Providers flags={flags}>
          <ThemeEffect flags={flags} />
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
