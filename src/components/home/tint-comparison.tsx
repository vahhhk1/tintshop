"use client";

import * as React from "react";
import Image from "next/image";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const SHADES = [
  { vlt: 5, name: "Limo", note: "Maximum privacy. Very dark at night — typically legal on rear windows only, where allowed." },
  { vlt: 15, name: "Dark", note: "Strong privacy with a sleek blacked-out look. Popular for rear windows and SUVs." },
  { vlt: 20, name: "Popular dark", note: "Our most requested shade: dark and private while keeping reasonable night visibility." },
  { vlt: 35, name: "Balanced", note: "A classy factory-plus look with good privacy and excellent visibility." },
  { vlt: 50, name: "Light", note: "Subtle tint that still cuts glare and, with ceramic, rejects serious heat." },
  { vlt: 70, name: "Clear", note: "Nearly invisible. Ideal for windshields and front windows in strict states (ceramic recommended)." },
];

const PHOTO = { src: "/images/demo/sedan-hyundai.jpg", width: 1600, height: 1067 };

/** The car's glass in PHOTO (pixel coordinates), so the tint lands on the windows only. */
const GLASS = [
  // Windshield
  "737,220 760,214 1000,211 1150,213 1157,218 1140,270 1118,330 1100,370 1092,377 800,378 560,381 533,380 560,350 610,300 680,250 720,228",
  // Front door, rear door and rear quarter windows
  "1205,228 1247,226 1291,360 1155,378 1158,340 1166,300 1180,255 1192,237",
  "1265,227 1300,234 1335,255 1340,265 1372,346 1302,362",
  "1352,274 1392,318 1394,338 1381,345",
];
/** The side mirror sits in front of the front door glass. */
const MIRROR = "1188,382 1203,332 1245,330 1284,342 1305,359 1307,375 1284,386 1207,388";

/** Interactive visible-light-transmission (VLT) comparison. */
export function TintComparison() {
  const [selected, setSelected] = React.useState(2);
  const shade = SHADES[selected]!;
  const darkness = 1 - shade.vlt / 100;
  const id = React.useId().replace(/[^\w-]/g, "");

  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/10">
        <Image src={PHOTO.src} alt="Black sedan whose windows preview the selected tint" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
        {/* Same framing as object-cover, so the traced glass lines up at any size. */}
        <svg viewBox={`0 0 ${PHOTO.width} ${PHOTO.height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <filter id={`${id}-soft`}>
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
            <mask id={`${id}-glass`}>
              <g filter={`url(#${id}-soft)`}>
                {GLASS.map((points) => (
                  <polygon key={points} points={points} fill="white" />
                ))}
                <polygon points={MIRROR} fill="black" />
              </g>
            </mask>
            <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.16" />
              <stop offset="0.45" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g mask={`url(#${id}-glass)`}>
            <rect
              width={PHOTO.width}
              height={PHOTO.height}
              fill="rgb(8 8 10)"
              className="transition-opacity duration-500"
              style={{ opacity: Math.min(0.95, darkness * 0.92) }}
            />
            {/* A faint reflection keeps dark film reading as glass. */}
            <rect width={PHOTO.width} height={PHOTO.height} fill={`url(#${id}-sheen)`} />
          </g>
        </svg>
        <div className="absolute bottom-4 left-4 flex items-baseline gap-2 rounded-2xl bg-black/70 px-4 py-2.5">
          <span className="font-display text-3xl font-semibold text-primary tabular-nums">{shade.vlt}%</span>
          <span className="text-sm text-foreground/80">{shade.name}</span>
        </div>
      </div>

      <div>
        <div role="radiogroup" aria-label="Tint percentage" className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
          {SHADES.map((s, i) => (
            <button
              key={s.vlt}
              type="button"
              role="radio"
              aria-checked={i === selected}
              onClick={() => setSelected(i)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-3 text-left transition-colors",
                i === selected ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/25",
              )}
            >
              <span className="mb-3 block h-10 rounded-lg border border-white/10" style={{ background: `linear-gradient(135deg, rgb(255 255 255 / ${(s.vlt / 100) * 0.9}), rgb(10 10 12 / ${1 - s.vlt / 100}))` }} aria-hidden />
              <span className="block font-display text-lg font-semibold tabular-nums">{s.vlt}%</span>
              <span className="block text-xs text-muted-foreground">{s.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 min-h-[3.5rem] text-[15px] leading-relaxed text-foreground/80" aria-live="polite">
          <strong className="text-foreground">{shade.vlt}% VLT</strong> lets {shade.vlt}% of visible light through. {shade.note}
        </p>
        <p className="mt-5 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Tint laws vary by state and country and differ for front, rear and windshield glass. Always verify your local tint regulations before choosing a shade — we’re happy to help.
        </p>
      </div>
    </div>
  );
}
