import type { NextConfig } from "next";

type RemotePattern = { protocol: "http" | "https"; hostname: string };

const remotePatterns: RemotePattern[] = [
  { protocol: "https", hostname: "res.cloudinary.com" },
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
];

// Allow the public bucket/CDN host used by the S3 storage driver.
if (process.env.STORAGE_PUBLIC_URL) {
  try {
    const url = new URL(process.env.STORAGE_PUBLIC_URL);
    remotePatterns.push({ protocol: url.protocol === "http:" ? "http" : "https", hostname: url.hostname });
  } catch {
    // ignore malformed value; uploads will still work, just without optimisation
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Don't echo Server Action arguments (passwords, personal details) to the dev terminal.
  logging: { serverFunctions: false },
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Scroll-film assets (re-encode under a new file name to bust caches).
        source: "/video/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }],
      },
      {
        source: "/images/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
