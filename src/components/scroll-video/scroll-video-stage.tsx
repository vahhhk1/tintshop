"use client";

import * as React from "react";
import { createDecodedFilm, createSeekingFilm, type Film } from "./film";
import { STORY_VIDEO } from "./story";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface ChapterBox {
  el: HTMLElement;
  start: number;
  end: number;
  top: number;
  range: number;
  /** Last progress written to the progress bars, to skip redundant style writes. */
  shown: string;
  bars: HTMLElement[];
  steps: { el: HTMLElement; from: number; to: number }[];
}

/**
 * Fixed full-viewport film scrubbed by page scroll, from the hero to the footer.
 *
 * Timeline: chapters (`data-scrub-start` / `data-scrub-end`, seconds) anchor film time to
 * their pinned scroll range; between anchors, time is interpolated linearly, so the
 * footage keeps moving under the content sections too. Scrolling down plays forward,
 * scrolling up reverses, and stopping holds the exact frame.
 *
 * Responsiveness:
 *  - one requestAnimationFrame tick per frame reads the scroll position and maps it
 *    straight to a film frame (no easing); nothing goes through React state;
 *  - the film is downloaded once and decoded with WebCodecs onto a canvas, ahead of the
 *    scroll (see createDecodedFilm), so the frame is drawn in the same animation frame as
 *    the scroll that asked for it. Without WebCodecs it seeks a <video> instead;
 *  - all per-frame DOM writes are skipped when their value hasn't changed.
 *
 * Hard cuts in the footage get a short dip to black, and until the film is ready,
 * cross-fading stills stand in, so no frame is ever blank.
 *
 * Reduced motion: returns before downloading anything; CSS shows static chapters.
 */
export function ScrollVideoStage() {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stillARef = React.useRef<HTMLImageElement>(null);
  const stillBRef = React.useRef<HTMLImageElement>(null);
  const dipRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stillA = stillARef.current;
    const stillB = stillBRef.current;
    const dip = dipRef.current;
    if (!stage || !video || !canvas || !stillA || !stillB || !dip) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    // Lets page chrome (e.g. the header's frosted glass) switch to cheaper styles.
    const root = document.documentElement;
    root.dataset.film = "on";

    const { fps, duration: maxTime } = STORY_VIDEO;
    const lastFrame = Math.round(maxTime * fps);
    let chapters: ChapterBox[] = [];
    /** Scroll position → film time anchors, sorted by scroll position. */
    let anchors: { y: number; t: number }[] = [];
    let film: Film | null = null;
    /** Frame the scroll position asks for. */
    let wantFrame = 0;
    let raf = 0;
    let dipShown = -1;
    let objectUrl: string | null = null;
    let cancelled = false;

    const measure = () => {
      chapters = [...document.querySelectorAll<HTMLElement>("[data-scrub-start]")]
        .map((el) => ({
          el,
          start: Number(el.dataset.scrubStart),
          end: Number(el.dataset.scrubEnd),
          top: el.getBoundingClientRect().top + window.scrollY,
          // The sticky child pins for exactly this long. Its height is in svh, so a phone's
          // collapsing address bar doesn't shift the timeline (window.innerHeight would).
          range: Math.max(1, el.offsetHeight - (el.querySelector<HTMLElement>(".story-sticky")?.offsetHeight ?? window.innerHeight)),
          shown: "",
          bars: [...el.querySelectorAll<HTMLElement>("[data-chapter-progress]")],
          steps: [...el.querySelectorAll<HTMLElement>("[data-step-from]")].map((s) => ({
            el: s,
            from: Number(s.dataset.stepFrom),
            to: Number(s.dataset.stepTo),
          })),
        }))
        .sort((a, b) => a.top - b.top);
      anchors = [{ y: 0, t: 0 }];
      for (const c of chapters) anchors.push({ y: c.top, t: c.start }, { y: c.top + c.range, t: c.end });
    };

    /** Film time for a scroll position (piecewise linear through the anchors). */
    const timeAt = (y: number) => {
      let prev = anchors[0];
      if (!prev) return 0;
      for (const a of anchors) {
        if (y <= a.y) return a.y === prev.y ? a.t : prev.t + ((y - prev.y) / (a.y - prev.y)) * (a.t - prev.t);
        prev = a;
      }
      return prev.t;
    };

    /** Chapter progress bars and caption step states; writes only what changed. */
    const updateChapters = (y: number) => {
      for (const c of chapters) {
        const p = clamp((y - c.top) / c.range, 0, 1);
        const shown = p.toFixed(3);
        if (shown === c.shown) continue;
        c.shown = shown;
        // A transform on the bar alone: a custom property on the section would restyle the
        // whole chapter every frame.
        for (const bar of c.bars) bar.style.transform = `scaleX(${shown})`;
        for (const s of c.steps) {
          const state = p < s.from ? "before" : p > s.to ? "after" : "active";
          if (s.el.dataset.state !== state) s.el.dataset.state = state;
        }
      }
    };

    /** Dip to black around hard cuts so scene changes never snap. */
    const updateDip = (t: number) => {
      let d = 0;
      for (const cut of STORY_VIDEO.cuts) d = Math.max(d, 1 - Math.abs(t - cut) / STORY_VIDEO.dipWindow);
      const opacity = Math.round(clamp(d, 0, 1) * 0.92 * 100) / 100;
      if (opacity !== dipShown) {
        dipShown = opacity;
        dip.style.opacity = String(opacity);
      }
    };

    // Two still layers cross-fade while the film is downloading.
    let stillFront = stillA;
    let stillBack = stillB;
    let stillWanted = "";
    const showStill = (t: number) => {
      let src: string = STORY_VIDEO.stills[0].src;
      for (const s of STORY_VIDEO.stills) if (s.t <= t + 0.05) src = s.src;
      if (src === stillWanted) return;
      stillWanted = src;
      const layer = stillBack;
      layer.src = src;
      void layer
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (cancelled || stillWanted !== src) return;
          layer.style.opacity = "1";
          stillFront.style.opacity = "0";
          stillBack = stillFront;
          stillFront = layer;
        });
    };

    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      const t = clamp(timeAt(y), 0, maxTime);
      updateChapters(y);
      updateDip(t);
      wantFrame = Math.min(lastFrame, Math.round(t * fps));
      if (film) film.show(wantFrame);
      else showStill(t);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // Re-measure only when the page actually changes size (window resizes included); a
    // phone's address bar showing or hiding mid-scroll doesn't force a layout.
    const onResize = () => {
      measure();
      for (const c of chapters) c.shown = "";
      schedule();
    };

    measure();
    tick();
    window.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);

    // Warm the still cache in idle time so placeholders swap instantly.
    const warm = () => STORY_VIDEO.stills.forEach((s) => (new Image().src = s.src));
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idleId = hasIdle ? window.requestIdleCallback(warm) : window.setTimeout(warm, 1500);

    const small = window.matchMedia("(max-width: 767px), (max-height: 540px)").matches;
    const src = small ? STORY_VIDEO.sources.small : STORY_VIDEO.sources.large;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const setProgress = (p: number) => stage.style.setProperty("--load", p.toFixed(3));

    /** Downloads the film, reporting progress to the loader line. */
    const download = async () => {
      const res = await fetch(src);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled) {
          void reader.cancel();
          throw new Error("cancelled");
        }
        chunks.push(value);
        received += value.byteLength;
        if (total) setProgress(received / total);
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    };

    const markReady = () => {
      if (cancelled) return;
      stage.dataset.ready = "true";
      delete stage.dataset.loading;
    };

    /** Fallback engine: seeks the <video> (from the downloaded bytes, else streamed). */
    const startVideo = async (bytes: Uint8Array<ArrayBuffer> | null) => {
      if (bytes) objectUrl = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
      video.preload = "auto";
      video.src = objectUrl ?? src;
      video.load();
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      // iOS only decodes frames after playback has started once.
      try {
        await video.play();
        video.pause();
      } catch {
        // Autoplay restrictions don't matter for muted seeking.
      }
      if (cancelled) return;
      video.addEventListener("seeked", markReady, { once: true });
      canvas.hidden = true;
      stage.dataset.engine = "video";
      film = createSeekingFilm(video, fps);
      film.show(wantFrame);
    };

    const load = async () => {
      if (connection?.saveData) return; // Respect data saver: keep the stills.
      stage.dataset.loading = "true";
      let bytes: Uint8Array<ArrayBuffer> | null = null;
      try {
        bytes = await download();
      } catch {
        // Stream it into the <video> with range requests instead.
      }
      if (cancelled) return;
      setProgress(1);
      if (bytes) {
        const data = bytes;
        const decoded = await createDecodedFilm(canvas, data, wantFrame, () => {
          // The decoder kept failing mid-scroll: hand over to the <video>.
          film = null;
          if (!cancelled) void startVideo(data);
        });
        if (cancelled) return decoded?.dispose();
        if (decoded) {
          film = decoded;
          canvas.hidden = false;
          stage.dataset.engine = "decoded";
          markReady();
          film.show(wantFrame);
          return;
        }
      }
      await startVideo(bytes);
    };
    void load();

    const onReducedChange = () => {
      if (reduced.matches) window.location.reload();
    };
    reduced.addEventListener("change", onReducedChange);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      delete root.dataset.film;
      window.removeEventListener("scroll", schedule);
      ro.disconnect();
      film?.dispose();
      video.removeEventListener("seeked", markReady);
      reduced.removeEventListener("change", onReducedChange);
      if (hasIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <div ref={stageRef} className="story-stage pointer-events-none fixed inset-x-0 top-0 -z-10 bg-black" aria-hidden>
      <div className="story-stage-frame absolute inset-x-0 top-0 overflow-hidden">
        {/* First frame is server-rendered so the hero paints instantly (LCP). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static still, already sized for the stage */}
        <img src={STORY_VIDEO.stills[0].src} alt="" fetchPriority="high" decoding="async" className="story-placeholder absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element -- cross-faded imperatively while the film loads */}
        <img ref={stillARef} alt="" decoding="async" className="story-still-layer story-placeholder absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element -- cross-faded imperatively while the film loads */}
        <img ref={stillBRef} alt="" decoding="async" className="story-still-layer story-placeholder absolute inset-0 h-full w-full object-cover" />
        {/* Decoded-film engine draws here; the <video> is the fallback engine. */}
        <canvas ref={canvasRef} hidden className="story-video absolute inset-0 h-full w-full object-cover" />
        <video
          ref={videoRef}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          className="story-video absolute inset-0 h-full w-full object-cover"
        />
        <div ref={dipRef} className="absolute inset-0 bg-black opacity-0" />
        {/* Legibility: header fade, caption side, and bottom blend into the page. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="story-caption-shade absolute inset-0" />
        <div className="story-fade-bottom absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      <div className="story-loader absolute inset-x-0 top-16 h-0.5 lg:top-[72px]">
        <div className="h-full origin-left bg-primary/80" />
      </div>
    </div>
  );
}
