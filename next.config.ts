import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Service worker Nakhoda ditulis tangan di public/sw.js, bukan hasil generate.
  // Header di bawah memastikan browser selalu mengambil versi terbaru service
  // worker itu, kalau tidak app shell bisa nyangkut di versi lama berhari-hari.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
