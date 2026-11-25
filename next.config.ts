import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components + Partial Prefetching: menu pages are rendered once and
  // served as static HTML; links prefetch only what's needed.
  cacheComponents: true,
  partialPrefetching: true,

  experimental: {
    // Diners scanning a QR code are first-time visitors on mobile networks:
    // putting our small Tailwind CSS (~6 KB gzipped) inside the HTML saves a
    // whole network round-trip before the menu can appear.
    inlineCss: true,
    // Dish photos and logos are shrunk in the browser first; 4 MB leaves room
    // under the 4.5 MB request limit of serverless hosting.
    serverActions: { bodySizeLimit: "4mb" },
  },

  // Allow testing `next dev` from a phone through a Cloudflare tunnel (see README).
  allowedDevOrigins: ["*.trycloudflare.com"],

  // Native/WASM packages used by the 3D model pipeline run as plain Node modules.
  serverExternalPackages: ["sharp", "draco3dgltf", "meshoptimizer"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        // Draco decoder (unpacks compressed 3D models): rarely changes.
        source: "/draco/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
