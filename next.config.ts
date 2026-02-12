import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://cdn.instadapp.io/**')],
  },
};

export default nextConfig;
