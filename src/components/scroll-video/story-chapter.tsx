import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { StoryChapterTiming } from "./story";

/**
 * A pinned section that scrubs one slice of the film (see ScrollVideoStage).
 * Without JS or with reduced motion it collapses to a normal section with a still.
 */
export function StoryChapter({
  chapter,
  label,
  index,
  total,
  children,
  className,
}: {
  chapter: StoryChapterTiming;
  label: string;
  index: number;
  total: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={chapter.id}
      aria-label={label}
      data-scrub-start={chapter.start}
      data-scrub-end={chapter.end}
      className={cn("story-chapter relative", className)}
      style={{ "--chapter-h": chapter.height } as React.CSSProperties}
    >
      <div className="story-sticky">
        <Image src={chapter.still} alt="" fill sizes="100vw" className="story-still object-cover" />
        <div className="story-still-shade" aria-hidden />
        <div className="container-page story-captions relative h-full">{children}</div>
        <div className="story-meta container-page pointer-events-none absolute inset-x-0 top-24 hidden items-center gap-3 text-[11px] font-semibold tracking-[0.24em] text-foreground/60 uppercase md:flex" aria-hidden>
          <span className="tabular-nums">
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="relative h-px w-24 overflow-hidden bg-white/15">
            <span data-chapter-progress className="story-progress absolute inset-0 origin-left bg-primary" />
          </span>
          <span>{label}</span>
        </div>
      </div>
    </section>
  );
}

/**
 * One caption inside a chapter, visible while the chapter's progress is between
 * `from` and `to` (0–1). The first step of a chapter starts visible for SSR.
 */
export function StoryStep({
  from,
  to,
  children,
  className,
  align = "bottom",
}: {
  from: number;
  to: number;
  children: React.ReactNode;
  className?: string;
  align?: "bottom" | "center";
}) {
  return (
    <div
      data-step-from={from}
      data-step-to={to}
      data-state={from === 0 ? "active" : "before"}
      className={cn("story-step", align === "center" ? "story-step-center" : "story-step-bottom", className)}
    >
      {children}
    </div>
  );
}

export function StoryCaption({ eyebrow, title, body, children }: { eyebrow: string; title: React.ReactNode; body?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="max-w-xl">
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className="text-4xl leading-[1.02] font-semibold text-balance sm:text-5xl lg:text-6xl">{title}</h2>
      {body && <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/75 sm:text-lg">{body}</p>}
      {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}

/** Opaque content band between chapters, with soft fades into the footage. */
export function StoryBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("story-band relative", className)}>{children}</div>;
}
