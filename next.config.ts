import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O service worker precisa ser sempre buscado de novo, senão os aparelhos
  // ficam presos numa versão antiga.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
