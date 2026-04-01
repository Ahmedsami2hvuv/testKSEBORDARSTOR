import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** صور الطلبات والمندوب — تتجاوز عادةً 3 ميجابايت */
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
