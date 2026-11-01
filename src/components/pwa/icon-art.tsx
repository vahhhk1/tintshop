import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The logo's round emblem (white), inlined for next/og. */
const EMBLEM = `data:image/png;base64,${readFileSync(join(process.cwd(), "public/brand/emblem-white.png")).toString("base64")}`;

/** Brand mark rendered by next/og ImageResponse for favicons and PWA icons. */
export function IconArt({ size, padding = 0.18, rounded = true }: { size: number; padding?: number; rounded?: boolean }) {
  const inner = Math.round(size * (1 - padding * 2));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0b",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og */}
      <img src={EMBLEM} width={inner} height={inner} alt="" />
    </div>
  );
}
