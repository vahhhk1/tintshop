/**
 * Scroll-driven brand film (public/video). The whole homepage is one continuous
 * timeline: chapters pin the viewport for their key scene, and the content between
 * chapters keeps playing the footage that leads into the next one. Every chapter
 * after the first starts on a scene cut, which is softened with a dip to black.
 */
export const STORY_VIDEO = {
  /** Start time of the last frame of the 25 fps encode (662 frames). */
  duration: 26.44,
  fps: 25,
  /**
   * All-intra H.264 (every frame is a keyframe, no B-frames): any frame decodes on its
   * own, so a scroll-driven seek costs one frame decode instead of up to a GOP's worth.
   * Re-encode under a new file name to bust caches.
   */
  sources: {
    /** Phones and small/short screens. */
    small: "/video/story-720-v3.mp4",
    large: "/video/story-900-v3.mp4",
  },
  /** Hard cuts in the source footage (seconds). */
  cuts: [9.06, 19.84, 22.05, 25.18],
  /** Half-width of the dip-to-black around each cut (seconds of film). */
  dipWindow: 0.24,
  /** Stills used while the film downloads and for reduced-motion visitors. */
  stills: [
    { t: 0, src: "/video/stills/frame-00.webp" },
    { t: 1.4, src: "/video/stills/frame-01.webp" },
    { t: 3.0, src: "/video/stills/frame-02.webp" },
    { t: 5.6, src: "/video/stills/frame-03.webp" },
    { t: 8.2, src: "/video/stills/frame-04.webp" },
    { t: 10.2, src: "/video/stills/frame-05.webp" },
    { t: 12.8, src: "/video/stills/frame-06.webp" },
    { t: 15.2, src: "/video/stills/frame-07.webp" },
    { t: 18.2, src: "/video/stills/frame-08.webp" },
    { t: 20.8, src: "/video/stills/frame-09.webp" },
    { t: 23.6, src: "/video/stills/frame-10.webp" },
    { t: 26.2, src: "/video/stills/frame-11.webp" },
  ],
} as const;

export interface StoryChapterTiming {
  id: string;
  /** Film time (seconds) at the start and end of the pinned section. */
  start: number;
  end: number;
  /** Scroll length of the pinned section (desktop; phones use 80%). */
  height: string;
  /** Still shown for reduced-motion visitors. */
  still: string;
}

/*
 * Scenes: 0–2.4 windscreen · 2.4–4.4 side windows · 4.4–7.2 rear glass · 7.2–9.06 side
 * windows (heat) | 9.06–12 body · 12–14 rims · 14–16.5 headlights · 16.5–19.84 dash
 * | 19.84–22.05 seats | 22.05–25.18 tint & coating | 25.18–26.44 closing shot.
 * Gaps between one chapter's end and the next chapter's start play under the content.
 */
export const CHAPTERS = {
  hero: { id: "story-intro", start: 0, end: 2.4, height: "220vh", still: "/video/stills/frame-01.webp" },
  glass: { id: "story-glass", start: 2.5, end: 8.2, height: "380vh", still: "/video/stills/frame-02.webp" },
  protect: { id: "story-protect", start: 9.06, end: 16.0, height: "380vh", still: "/video/stills/frame-05.webp" },
  interior: { id: "story-interior", start: 16.5, end: 21.6, height: "300vh", still: "/video/stills/frame-08.webp" },
  finale: { id: "story-finale", start: 22.05, end: 24.6, height: "240vh", still: "/video/stills/frame-10.webp" },
  outro: { id: "story-outro", start: 25.18, end: 26.44, height: "200vh", still: "/video/stills/frame-11.webp" },
} satisfies Record<string, StoryChapterTiming>;
