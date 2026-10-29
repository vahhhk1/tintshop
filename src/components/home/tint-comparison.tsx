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

/** Interactive visible-light-transmission (VLT) comparison. */
export function TintComparison() {
  const [selected, setSelected] = React.useState(2);
  const shade = SHADES[selected]!;
  const darkness = 1 - shade.vlt / 100;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/10">
        <Image src="/images/demo/sedan-hyundai.jpg" alt="View through a car window" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
        {/* Window "glass" with the selected tint applied */}
        <div
          className="absolute inset-[8%_10%_14%_10%] rounded-[38%_42%_10%_10%/55%_55%_8%_8%] border-[6px] border-black/80 shadow-[inset_0_0_60px_rgb(0_0_0/0.6)] transition-[background-color] duration-500"
          style={{ backgroundColor: `rgb(8 8 10 / ${Math.min(0.95, darkness * 0.92).toFixed(2)})` }}
          aria-hidden
        >
          <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/15 via-transparent to-transparent" />
        </div>
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
