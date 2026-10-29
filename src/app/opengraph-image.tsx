import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";

export const alt = "Premium automotive window tint";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const settings = await getSettings().catch(() => null);
  const name = settings?.businessName ?? "Tint Studio";
  const headline = settings?.heroHeadline ?? "Premium Window Tint. Built for Your Drive.";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(80% 90% at 85% 10%, #3a2a0e 0%, #0a0a0b 60%)",
          color: "#f5f5f4",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#f8cf7a,#c98a1c)" }} />
          {name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, maxWidth: 980 }}>{headline}</div>
          <div style={{ fontSize: 30, color: "#f5b544" }}>Ceramic · Carbon · Dyed · PPF · Ceramic Coating</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>Instant quotes · Online booking · Lifetime warranty</div>
      </div>
    ),
    size,
  );
}
