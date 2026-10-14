import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8005/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:8005/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
