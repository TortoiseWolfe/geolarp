import type { NextConfig } from "next";
const withSerwist = require("@serwist/next").default;

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isProd ? '/geolarp' : '',
  assetPrefix: isProd ? '/geolarp/' : '',
  images: {
    unoptimized: true,
  },
  experimental: {
    turbo: {
      // Turbopack configuration
    }
  }
};

export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
