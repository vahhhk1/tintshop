import { ImageResponse } from "next/og";
import { IconArt } from "@/components/pwa/icon-art";

const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

/** PWA icons generated from the brand mark (no binary assets to maintain). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const icon = ICONS[file];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={icon.size} padding={icon.maskable ? 0.28 : 0.16} rounded={!icon.maskable} />, {
    width: icon.size,
    height: icon.size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
