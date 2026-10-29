import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings().catch(() => null);
  const name = settings?.businessName ?? "Tint Studio";
  return {
    name,
    short_name: name.split(" ")[0] ?? name,
    description: settings?.tagline ?? "Premium automotive window tint — book online",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    categories: ["business", "lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Book an appointment", url: "/book", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Get a free quote", url: "/quote", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My account", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
