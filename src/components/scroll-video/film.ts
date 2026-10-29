import { parseFilm, type FilmTrack } from "./mp4";

/** Shows film frames for the stage; `show` is called once per animation frame while scrolling. */
export interface Film {
  show(frame: number): void;
  dispose(): void;
}

/** Decoded frames kept around the current one (YUV, ≈2.2 MB each at 1600×900). */
const MAX_CACHED = 12;
/** Decodes queued at once: short enough that stale requests can never pile up. */
const MAX_IN_FLIGHT = 4;
/** Frames are decoded this many animation frames ahead, at the current scroll speed. */
const LOOKAHEAD_TICKS = 3;
/** No output for this long while decodes are pending means the decoder is stuck. */
const STALL_MS = 50;

/**
 * Decodes the film with WebCodecs and draws frames onto a canvas.
 *
 * A seeking <video> shows the new frame a frame or more after the scroll that asked for
 * it, and only ~25–30 times a second. Here the frames around the scroll position, and the
 * ones the current scroll speed will reach next, are decoded ahead of time, so the frame
 * for this animation frame is usually already in memory and drawn in the same frame as
 * the scroll. A frame that isn't ready yet is drawn as soon as it decodes, and until then
 * the nearest decoded frame stands in; a late frame never replaces a closer one.
 *
 * GPU cost: frames stay as decoded VideoFrames until drawn, so only frames that reach the
 * screen pay for the YUV → RGB conversion, and at most one is drawn per animation frame.
 * Converting every decoded frame up front (e.g. to ImageBitmaps) kept Chrome's GPU thread
 * busy enough to drop compositor frames during fast scrolls.
 *
 * Resolves to null when WebCodecs or the codec isn't available, or the first frame can't
 * be decoded. `onFail` fires if the decoder keeps failing later on.
 */
export async function createDecodedFilm(
  canvas: HTMLCanvasElement,
  bytes: Uint8Array,
  first: number,
  onFail: () => void,
): Promise<Film | null> {
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") return null;
  let track: FilmTrack;
  try {
    track = parseFilm(bytes);
  } catch {
    return null;
  }
  const config: VideoDecoderConfig = {
    codec: track.codec,
    description: track.description,
    codedWidth: track.width,
    codedHeight: track.height,
    optimizeForLatency: true,
  };
  const support = await VideoDecoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) return null;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  canvas.width = track.width;
  canvas.height = track.height;

  const { frames, frameDuration } = track;
  const cache = new Map<number, VideoFrame>();
  /** Decodes submitted whose output hasn't arrived. */
  const inFlight = new Set<number>();
  let maxCached = MAX_CACHED;
  let decoder: VideoDecoder | null = null;
  let failures = 0;
  let stalls = 0;
  let flushing = false;
  let stallTimer = 0;
  let drawRaf = 0;
  let disposed = false;
  let want = Math.min(Math.max(first, 0), frames.length - 1);
  let drawn = -1;
  /** Frames per animation frame, smoothed; its sign is the scroll direction. */
  let velocity = 0;
  let lastShow = 0;
  /** Settles startup: true once the first frame is drawn, false if decoding gives up. */
  let starting: ((ok: boolean) => void) | null = null;

  const distance = (frame: number) => Math.abs(frame - want);

  /** Draws the decoded frame nearest the wanted one, if it beats what's on screen. */
  const drawNearest = () => {
    let best = -1;
    for (const frame of cache.keys()) if (best < 0 || distance(frame) < distance(best)) best = frame;
    if (best < 0 || (drawn >= 0 && distance(best) >= distance(drawn))) return;
    ctx.drawImage(cache.get(best)!, 0, 0, canvas.width, canvas.height);
    drawn = best;
    starting?.(true);
  };
  // Decoder output can arrive several times per animation frame; draw once, before paint.
  const requestDraw = () => {
    if (!drawRaf) {
      drawRaf = requestAnimationFrame(() => {
        drawRaf = 0;
        drawNearest();
      });
    }
  };

  /**
   * Frames worth having next, most urgent first: where the next few animation frames will
   * land at the current speed. Slow scrolling also keeps the neighbours on both sides for
   * a change of direction; fast scrolling skips the in-between frames it will never show.
   */
  const plan = () => {
    const dir = velocity < 0 ? -1 : 1;
    const step = Math.max(1, Math.round(Math.abs(velocity)));
    const queue = [want];
    for (let i = 1; i <= LOOKAHEAD_TICKS; i++) queue.push(want + dir * step * i);
    if (step <= 2) queue.push(want + dir, want - dir, want - 2 * dir);
    return queue.filter((f) => f >= 0 && f < frames.length);
  };

  /** Closes the cached frames farthest from the scroll position (never ones in `keep`). */
  const trim = (keep: number[]) => {
    if (cache.size <= maxCached) return;
    const dir = velocity < 0 ? -1 : 1;
    const cost = (f: number) => distance(f) * (Math.sign(f - want) === dir ? 0.5 : 1);
    const spare = [...cache.keys()].filter((f) => !keep.includes(f)).sort((a, b) => cost(b) - cost(a));
    for (const f of spare.slice(0, cache.size - maxCached)) {
      cache.get(f)!.close();
      cache.delete(f);
    }
  };

  const fail = () => {
    if (disposed) return;
    if (starting) return starting(false);
    film.dispose();
    onFail();
  };

  const output = (videoFrame: VideoFrame) => {
    const frame = Math.round(videoFrame.timestamp / frameDuration);
    inFlight.delete(frame);
    failures = 0;
    stalls = 0;
    if (disposed) return videoFrame.close();
    cache.get(frame)?.close();
    cache.set(frame, videoFrame);
    // The first frame goes up at once (rAF doesn't run in a background tab).
    if (drawn < 0) drawNearest();
    else if (distance(frame) < distance(drawn)) requestDraw();
    pump();
  };

  const ensureDecoder = () => {
    if (decoder) return decoder;
    try {
      const d: VideoDecoder = new VideoDecoder({
        output,
        // Closed by the error (e.g. the browser reclaimed it in a background tab); a new one
        // is made the next time a frame is needed.
        error: () => {
          if (decoder !== d) return;
          decoder = null;
          inFlight.clear();
          if (++failures >= 3) fail();
          else queueMicrotask(pump);
        },
      });
      d.configure(config);
      decoder = d;
    } catch {
      if (++failures >= 3) fail();
    }
    return decoder;
  };

  // Nothing out for a while although decodes are pending. Some hardware decoders hold back
  // their last frame until more input arrives (a flush releases it); others run out of
  // output buffers while decoded frames are held, so a second stall releases cached frames
  // and keeps the cache smaller from then on.
  const armStallCheck = () => {
    window.clearTimeout(stallTimer);
    if (!inFlight.size) return;
    stallTimer = window.setTimeout(() => {
      const d = decoder;
      if (disposed || !d || !inFlight.size) return;
      if (++stalls >= 2 && cache.size > 1) {
        maxCached = Math.max(2, cache.size >> 1);
        trim([want]);
      }
      if (!flushing && d.decodeQueueSize === 0) {
        flushing = true;
        d.flush()
          .catch(() => undefined)
          .finally(() => {
            flushing = false;
            pump();
          });
      }
      armStallCheck();
    }, STALL_MS);
  };

  function pump() {
    if (disposed) return;
    const queue = plan();
    for (const frame of queue) {
      if (inFlight.size >= MAX_IN_FLIGHT) break;
      if (cache.has(frame) || inFlight.has(frame)) continue;
      const d = ensureDecoder();
      if (!d) break;
      const { offset, size } = frames[frame];
      inFlight.add(frame);
      d.decode(
        new EncodedVideoChunk({
          type: "key",
          timestamp: Math.round(frame * frameDuration),
          data: bytes.subarray(offset, offset + size),
        }),
      );
    }
    armStallCheck();
    trim(queue);
  }

  const film: Film = {
    show(frame) {
      const now = performance.now();
      const delta = frame - want;
      velocity = now - lastShow > 100 ? delta : velocity * 0.6 + delta * 0.4;
      lastShow = now;
      want = frame;
      drawNearest();
      pump();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(stallTimer);
      cancelAnimationFrame(drawRaf);
      if (decoder && decoder.state !== "closed") decoder.close();
      decoder = null;
      for (const videoFrame of cache.values()) videoFrame.close();
      cache.clear();
    },
  };

  const ok = await new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => starting?.(false), 4000);
    starting = (value) => {
      window.clearTimeout(timeout);
      starting = null;
      resolve(value);
    };
    pump();
  });
  if (!ok || disposed) {
    film.dispose();
    return null;
  }
  return film;
}

/**
 * Fallback: seeks a <video> (all-intra, so each seek is one frame decode). Seeks are never
 * stacked; the moment one lands, the next goes to wherever the scroll position is now.
 */
export function createSeekingFilm(video: HTMLVideoElement, fps: number): Film {
  let want = 0;
  let seekFrame = -1;
  // Aims a quarter frame in so rounding can't land on the previous frame.
  const seekTo = (frame: number) => {
    seekFrame = frame;
    video.currentTime = (frame + 0.25) / fps;
  };
  const onSeeked = () => {
    if (want !== seekFrame) seekTo(want);
  };
  video.addEventListener("seeked", onSeeked);
  return {
    show(frame) {
      want = frame;
      if (!video.seeking && frame !== seekFrame) seekTo(frame);
    },
    dispose() {
      video.removeEventListener("seeked", onSeeked);
    },
  };
}
