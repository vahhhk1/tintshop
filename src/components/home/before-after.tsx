"use client";

import * as React from "react";
import Image from "next/image";
import { MoveHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Draggable before/after comparison. Pointer, touch and keyboard accessible —
 * the handle is a native range input so screen readers announce the position.
 */
export function BeforeAfterSlider({
  before,
  after,
  alt,
  className,
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  before: string;
  after: string;
  alt: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pos, setPos] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const update = React.useCallback((clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative aspect-[3/2] w-full touch-pan-y overflow-hidden rounded-2xl border border-white/10 select-none", className)}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <Image src={after} alt={`${alt} — ${afterLabel.toLowerCase()}`} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={before} alt={`${alt} — ${beforeLabel.toLowerCase()}`} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" draggable={false} />
      </div>

      <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold tracking-wider uppercase">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute top-4 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-wider text-primary-foreground uppercase">
        {afterLabel}
      </span>

      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }} aria-hidden>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_20px_rgb(0_0_0/0.6)]" />
        <div className="absolute top-1/2 left-0 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/65 text-white shadow-xl">
          <MoveHorizontal className="size-5" />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Comparison slider: drag to compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 focus-visible:opacity-0"
      />
    </div>
  );
}
