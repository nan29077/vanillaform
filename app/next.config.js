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
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    "*.sandbox.novita.ai",
    "*.sandbox.gensparksite.com",
    "*.e2b.dev",
  ],
  poweredByHeader: false,
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
