/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    unoptimized: true,
    minimumCacheTTL: 86400,
  },
  // 빌드 안전망 — 타입/린트 에러를 무시하지 않는다.
  // 무시 설정이 켜져 있으면 컴파일이 안 되는 코드가 그대로 배포되어,
  // 런타임에서야 터진다(권한 분기 오타 같은 것도 빌드가 잡아주지 못한다).
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  allowedDevOrigins: [
    "*.sandbox.novita.ai",
    "*.sandbox.gensparksite.com",
    "*.e2b.dev",
  ],
  poweredByHeader: false,
  // output file tracing 비활성화.
  // @vercel/nft 가 Prisma 런타임 추적 중 Windows 레거시 정션(Application Data 등)에서 EPERM 발생.
  // standalone 미사용 환경이므로 트레이싱 결과물이 필요 없다.
  outputFileTracing: false,
  compress: true,
  reactStrictMode: false,
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ["date-fns", "@prisma/client"],
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

module.exports = nextConfig;
